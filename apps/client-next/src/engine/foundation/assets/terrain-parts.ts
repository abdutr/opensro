/*
===========================================================================

terrain-parts.ts - the outdoor regions' terrain an outdoor stream keeps

An outdoor scene is a centre region and its neighbours. Their terrain is
most of a scene's bytes, and a crossing keeps six of the nine regions, so
each region's terrain is requested once as its own part and composed into
every scene that covers it.

Parts share coordinates only within one anchor: the region whose corner
is the scene origin. The anchor stays put while the camera moves within
ANCHOR_RANGE regions of it; a farther scene picks a new anchor and every
part is requested again. Each instance owns its anchor, its parts and the
asset jobs that fetch them. The world stream and the title stage each
create one.

Retention follows the native region cache: the regions a scene composes
stay live, and a region the scene leaves waits in an idle list of
IDLE_REGIONS, most recently released first, until it is used again or
pushed out.

===========================================================================
*/
import type { AssetOwner } from "@/engine/contracts/assets";
import type { WorldTerrainPart } from "@/engine/contracts/world-admission";
import { assetFailure } from "@/engine/foundation/assets/asset-recovery";

// Regions an anchor serves on either axis. At 8 regions (15360 units) a
// float32 coordinate still resolves 0.002 units, far below a pixel.
const ANCHOR_RANGE = 8;
// Idle regions the native cache keeps after their scene moves on:
// RegionCacheMap_Construct 414EC0 sets the limit (+0x24) to 16,
// ReleaseRef 415200 queues a released region and AcquireRef 415100
// revives it. Stepping back across the last border reuses the row just left.
const IDLE_REGIONS = 16;
// One region bundle is about a megabyte; the world request limit applies.
const TERRAIN_REQUEST_BYTES = 134217728;

/*
================
createTerrainParts

bundleOf names the published bundle of a region, or undefined when the
catalogue has none. outdoor is true when a region has an outdoor bundle:
the asset worker resolves only those as neighbours. decode is the asset
kind the parts load as: "frontend-world" for a frontend stage's scenes.
================
*/
export function createTerrainParts(
	assets: Pick<AssetOwner, "available" | "request" | "take" | "cancel">,
	origin: string,
	bundleOf: ( region: number ) => string | undefined,
	outdoor: ( region: number ) => boolean,
	decode: "world" | "frontend-world" = "world"
) {
	let anchor: number | null = null;
	const parts = new Map<number, WorldTerrainPart>();
	const jobs = new Map<number, number>();
	// The regions the admitted scene composes, and the released ones the
	// cache still holds, most recently released first.
	let live = new Set<number>();
	let idle: number[] = [];

	/*
	================
	anchorFor

	The anchor a scene centred on region uses: the current one while it is
	near enough, else the region itself.
	================
	*/
	function anchorFor( region: number ): number {
		if (
			anchor !== null && Math.abs( (region & 255) - (anchor & 255) ) <= ANCHOR_RANGE &&
			Math.abs( (region >>> 8) - (anchor >>> 8) ) <= ANCHOR_RANGE
		) return anchor;
		return region;
	}

	/*
	================
	drop
	================
	*/
	function drop( region: number ): void {
		const job = jobs.get( region );
		if ( job !== undefined ) assets.cancel( job );
		jobs.delete( region );
		parts.delete( region );
		live.delete( region );
		idle = idle.filter( held => held !== region );
	}

	/*
	================
	clear
	================
	*/
	function clear(): void {
		for ( const region of [ ...new Set( [ ...jobs.keys(), ...parts.keys() ] ) ] ) drop( region );
		live = new Set();
		idle = [];
		anchor = null;
	}
	/*
	================
	cancelPending

	A failed scene retires its outstanding requests, not its resident terrain.
	Sibling failures must not each consume another automatic retry attempt.
	================
	*/
	function cancelPending(): void {
		for ( const job of jobs.values() ) assets.cancel( job );
		jobs.clear();
	}

	return {
		anchorFor,
		cancelPending,
		/*
		================
		neighbourhood

		The regions an outdoor scene centred on region covers, in the order the
		asset worker resolves them (world/resources/resources.ts): the centre,
		then each published neighbour row by row.
		================
		*/
		neighbourhood( region: number ): number[] {
			const regions = [ region ];
			for ( let dz = -1; dz <= 1; dz++ ) {
				for ( let dx = -1; dx <= 1; dx++ ) {
					if ( !dx && !dz ) continue;
					const x = (region & 255) + dx, z = (region >>> 8) + dz;
					if ( x < 0 || x > 255 || z < 0 || z > 255 ) continue;
					const neighbour = x | (z << 8);
					if ( outdoor( neighbour ) ) regions.push( neighbour );
				}
			}
			return regions;
		},
		/*
		================
		begin

		Starts a scene centred on region and returns its anchor. A new anchor
		discards every part in the old coordinates.
		================
		*/
		begin( region: number ): number {
			const next = anchorFor( region );
			if ( next !== anchor ) {
				clear();
				anchor = next;
			}
			return next;
		},
		/*
		================
		request

		Asks for the missing parts of regions while more than reserve asset
		slots stay free.
		================
		*/
		request( regions: readonly number[], reserve = 0 ): void {
			if ( anchor === null ) return;
			for ( const region of regions ) {
				if ( parts.has( region ) || jobs.has( region ) ) continue;
				if ( assets.available() <= reserve ) return;
				const path = bundleOf( region );
				if ( !path ) throw new Error( `No published region ${region}` );
				const hex = anchor.toString( 16 ).padStart( 4, "0" );
				jobs.set(
					region,
					assets.request(
						new URL( `${path}#anchor=${hex}&part=terrain`, origin ).href,
						TERRAIN_REQUEST_BYTES,
						decode
					)
				);
			}
		},
		/*
		================
		poll

		Admits finished parts. A failed part throws: its scene cannot form.
		================
		*/
		poll(): void {
			for ( const [region, job] of jobs ) {
				const result = assets.take( job );
				if ( !result ) continue;
				jobs.delete( region );
				if ( result.kind !== "world" ) {
					if ( result.kind === "image" ) result.image.close();
					throw assetFailure(
						`Region ${region} terrain: ${result.kind === "error" ? result.error : "not a world"}`,
						result.kind === "error" && result.transient === true
					);
				}
				for ( const row of result.images ?? [] ) row.image.close();
				const prepared = result.world.takeWorld();
				if (
					prepared.scene.originRegion !== anchor ||
					prepared.scene.groups.some( group => group.terrainSector !== region )
				) throw new Error( `Region ${region} terrain is not in the anchor's coordinates` );
				parts.set( region, {
					region,
					origin: anchor,
					groups: prepared.scene.groups,
					bytes: prepared.bytes
				} );
			}
		},
		/*
		================
		ready
		================
		*/
		ready: ( regions: readonly number[] ) => regions.every( region => parts.has( region ) ),
		/*
		================
		parts
		================
		*/
		parts: ( regions: readonly number[] ) => regions.map( region => parts.get( region )! ),
		/*
		================
		pending
		================
		*/
		pending: () => jobs.size,
		/*
		================
		keep

		After a scene is admitted: its regions are live, every other held
		part joins the idle list (the ones just released at its front), the
		list keeps IDLE_REGIONS, and a job no live region needs is cancelled.
		================
		*/
		keep( regions: readonly number[] ): void {
			const next = new Set( regions );
			const released = [ ...live, ...parts.keys() ].filter( region =>
				!next.has( region ) && !idle.includes( region )
			);
			live = next;
			idle = [ ...new Set( [ ...released, ...idle ] ) ].filter( region => !next.has( region ) );
			for ( const region of idle.slice( IDLE_REGIONS ) ) drop( region );
			for ( const region of [ ...jobs.keys() ] ) {
				if ( !live.has( region ) && !parts.has( region ) ) drop( region );
			}
		},
		/*
		================
		held

		The regions whose terrain is resident, live first.
		================
		*/
		held: () => [ ...live ].filter( region => parts.has( region ) ).concat( idle ),
		clear
	};
}
