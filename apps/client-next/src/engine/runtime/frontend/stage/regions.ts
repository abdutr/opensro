/*
===========================================================================

regions.ts - the title stage's region scenes, streamed as the camera moves

The native title draws the world regions around its scripted camera, not
one prebuilt route. CGWorld_OnUpdate 9217B0 holds the 3x3 around the
current region and, when that region changes, releases the old set and
requests the new one; TimedValue_Advance 4DF160 moves the current region
whenever the sampled camera position leaves [0, 1920) on x or z. Released
regions wait in the region cache's idle list (terrain-parts.ts).

Native loads regions synchronously, so the frame stalls while they decode
and the camera then resumes at real time (the move delta is clamped only
at 3 s, Application_PumpIdleFrame A0F51D). The port decodes in the asset
worker instead and reports which region's scene is drawn; the stage holds
the drawn camera until the camera's region is drawn, which shows the same
frozen frame and the same jump.

Scenes are the gameplay outdoor bundles (region-catalog.ts), decoded as
frontend scenes: no picking streams, the frontend clock, full terrain
detail (native CPSTitle 0x748630 disables terrain LOD).

===========================================================================
*/
import type { AssetOwner, AssetResult } from "@/engine/contracts/assets";
import type { Renderer } from "@/engine/contracts/runtime";
import type { WorldCamera } from "@/engine/contracts/scene";
import { createTerrainParts } from "@/engine/foundation/assets/terrain-parts";
import {
	missionRegion,
	outdoorRegion,
	parseRegionCatalog,
	REGION_CATALOG_PATH,
	type RegionCatalog
} from "@/engine/foundation/assets/region-catalog";

// One region's side in world units.
export const REGION_SIZE = 1920;
const CATALOG_REQUEST_BYTES = 16 << 20;
const OBJECTS_REQUEST_BYTES = 128 << 20;

type WorldResult = Extract<AssetResult, { kind: "world"; }>;
// The scene being loaded: its centre, the regions it composes, and its
// objects (the job, then the result).
type Loading = { readonly region: number; readonly regions: readonly number[]; job: number; result?: WorldResult; };

/*
================
cameraRegion

The region a frontend camera is in. The sampled position is the camera
target, in its key's region coordinates; native steps the region by one
per REGION_SIZE on x and z (TimedValue_Advance 4DF160), which is a floor.
================
*/
export function cameraRegion( camera: WorldCamera ): number {
	// Every frontend key names its region (frontend-camera.ts frontendCameraView).
	if ( camera.originRegion === undefined ) throw new Error( "Frontend camera has no region" );
	const x = (camera.originRegion & 255) + Math.floor( camera.target[0] / REGION_SIZE ),
		z = (camera.originRegion >>> 8) + Math.floor( camera.target[2] / REGION_SIZE );
	if ( x < 0 || x > 255 || z < 0 || z > 127 ) throw new Error( "Frontend camera left the world" );
	return x | (z << 8);
}

/*
================
createTitleRegions
================
*/
export function createTitleRegions( assets: AssetOwner, renderer: Renderer, base: string ) {
	let catalog: RegionCatalog | null = null, catalogJob: number | null = null;
	let wanted: number | null = null, drawn: number | null = null, sceneId: string | null = null;
	let loading: Loading | null = null;
	const terrain = createTerrainParts(
		assets,
		base,
		region => missionRegion( catalog, region )?.bundlePublicPath,
		region => outdoorRegion( catalog, region ),
		"frontend-world"
	);

	/*
	================
	drop

	Abandons the scene being loaded; its terrain parts stay with the cache.
	================
	*/
	function drop() {
		if ( !loading ) return;
		if ( loading.result ) { for ( const row of loading.result.images ?? [] ) row.image.close(); }
		else assets.cancel( loading.job );
		loading = null;
	}

	/*
	================
	start
	================
	*/
	function start( region: number ) {
		const path = missionRegion( catalog, region )?.bundlePublicPath;
		if ( !path ) throw new Error( `No published region ${region}` );
		if ( !path.startsWith( "/assets/" ) || path.includes( ".." ) || path.includes( "\\" ) ) {
			throw new Error( "World asset path is not published" );
		}
		const anchor = terrain.begin( region ), regions = terrain.neighbourhood( region );
		const objects = `${path}#anchor=${anchor.toString( 16 ).padStart( 4, "0" )}&part=objects`;
		loading = {
			region,
			regions,
			job: assets.request( new URL( objects, base ).href, OBJECTS_REQUEST_BYTES, "frontend-world" )
		};
		terrain.request( regions );
	}

	/*
	================
	admit
	================
	*/
	function admit( scene: Loading, result: WorldResult ) {
		let transferred = 0;
		try {
			renderer.adoptWorld( result.world, "full", terrain.parts( scene.regions ) );
			terrain.keep( scene.regions );
			sceneId = result.world.sceneId;
			drawn = scene.region;
			for ( const row of result.images ?? [] ) {
				transferred++;
				renderer.setWorldTexture( row.path, row.image );
			}
		} catch ( error ) {
			for ( const row of (result.images ?? []).slice( transferred ) ) row.image.close();
			throw error;
		}
	}

	/*
	================
	clear
	================
	*/
	function clear() {
		drop();
		if ( catalogJob !== null ) assets.cancel( catalogJob );
		catalogJob = null;
		terrain.clear();
		wanted = null;
		drawn = null;
		sceneId = null;
	}

	return {
		/*
		================
		follow

		The camera's region becomes the wanted scene. True when that scene
		is the one drawn, so the camera may be shown.
		================
		*/
		follow( camera: WorldCamera ): boolean {
			wanted = cameraRegion( camera );
			return drawn === wanted;
		},
		/*
		================
		step

		Throws on a failed load; the stage reports it.
		================
		*/
		step() {
			if ( catalogJob !== null ) {
				const result = assets.take( catalogJob );
				if ( result ) {
					catalogJob = null;
					if ( result.kind !== "bytes" ) {
						if ( result.kind === "image" ) result.image.close();
						throw new Error( `Region catalog: ${result.kind === "error" ? result.error : "not bytes"}` );
					}
					catalog = parseRegionCatalog( result.buffer );
				}
			}
			if ( wanted === null ) return;
			if ( !catalog ) {
				if ( catalogJob === null && assets.available() > 0 ) {
					catalogJob = assets.request( new URL( REGION_CATALOG_PATH, base ).href, CATALOG_REQUEST_BYTES );
				}
				return;
			}
			terrain.poll();
			// The camera moved on while a scene loaded: native would have
			// loaded each region as it was crossed; only the latest is shown.
			if ( loading && loading.region !== wanted ) drop();
			if ( !loading && drawn !== wanted && assets.available() > 0 ) start( wanted );
			if ( !loading ) return;
			if ( !loading.result ) {
				const result = assets.take( loading.job );
				if ( result ) {
					if ( result.kind !== "world" ) {
						if ( result.kind === "image" ) result.image.close();
						loading = null;
						throw new Error( `Region scene: ${result.kind === "error" ? result.error : "not a world"}` );
					}
					loading.result = result;
				}
			}
			terrain.request( loading.regions );
			if ( loading.result && terrain.ready( loading.regions ) ) {
				const scene = loading, result = loading.result;
				loading = null;
				admit( scene, result );
			}
		},
		/*
		================
		drawn

		The scene the renderer was given last, once it shows the wanted region.
		================
		*/
		drawn: () => drawn !== null && drawn === wanted ? sceneId : null,
		held: () => terrain.held(),
		clear
	};
}
