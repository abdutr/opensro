/*
===========================================================================

region-catalog.ts - the published world region catalogue

The catalogue (/assets/world/world-region-catalog.json) lists, for each
region id, every bundle that covers it: the gameplay outdoor bundle and the
frontend routes (title, character creation) that overlap mission sectors.
Outdoor streams pick the gameplay bundle through missionRegion, so a
frontend route is never admitted as a region scene.

===========================================================================
*/

export const REGION_CATALOG_PATH = "/assets/world/world-region-catalog.json";

export interface RegionCatalogRow {
	readonly area?: string;
	readonly source?: string;
	readonly bundlePublicPath: string;
}
export type RegionCatalog = Readonly<Record<string, readonly RegionCatalogRow[]>>;

/*
================
regionKey
================
*/
export function regionKey( region: number ): string {
	return `0x${region.toString( 16 ).padStart( 4, "0" )}`;
}

/*
================
parseRegionCatalog
================
*/
export function parseRegionCatalog( bytes: ArrayBuffer ): RegionCatalog {
	const value = JSON.parse( new TextDecoder( "utf-8", { fatal: true } ).decode( bytes ) );
	if ( !value?.regionsById || typeof value.regionsById !== "object" || Array.isArray( value.regionsById ) ) {
		throw new Error( "Invalid region catalog" );
	}
	return value.regionsById;
}

/*
================
missionRegion

The gameplay bundle of a region. Catalogue order is not a scene-purpose
contract: title and creation routes overlap mission sectors.
================
*/
export function missionRegion( catalog: RegionCatalog | null, region: number ): RegionCatalogRow | undefined {
	const rows = catalog?.[regionKey( region )];
	return rows?.find( row => row.source === "mission-outdoor-global" ) ??
		rows?.find( row => row.area === "outdoor" ) ?? rows?.find( row => !row.area && !row.source );
}

/*
================
outdoorRegion

Whether a region has an outdoor bundle: the asset worker resolves only
those as a scene's neighbours.
================
*/
export function outdoorRegion( catalog: RegionCatalog | null, region: number ): boolean {
	return !!catalog?.[regionKey( region )]?.some( row => row.area === "outdoor" );
}
