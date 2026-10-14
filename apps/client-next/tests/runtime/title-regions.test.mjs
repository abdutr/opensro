/*
===========================================================================

title-regions.test.mjs - the title's region streaming and the region cache

The title draws the 3x3 around its camera's region and moves it as the
camera crosses region borders (CGWorld_OnUpdate 9217B0, TimedValue_Advance
4DF160); terrain a scene leaves waits in the native idle cache of 16
regions (RegionCacheMap 414EC0). Fakes stand in for the asset owner and the
renderer; the modules under test are the shipped sources.

===========================================================================
*/
import "../helpers/native-source-loader.mjs";
import { pathToFileURL as sourceFileUrl } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { root } from "../../tools/project.mjs";

/*
================
load
================
*/
async function load( file ) {
	return import( sourceFileUrl( path.join( root, file ) ).href );
}
const { createTerrainParts } = await load( "src/engine/foundation/assets/terrain-parts.ts" );
const { cameraRegion, createTitleRegions } = await load( "src/engine/runtime/frontend/stage/regions.ts" );

const ORIGIN = 0x694e;

/*
================
region
================
*/
function region( x, z ) {
	return x | (z << 8);
}

/*
================
fakeAssets

An asset owner whose requests finish when the test says so. Catalogue
requests answer at once with every region listed as outdoor.
================
*/
function fakeAssets() {
	let serial = 0;
	const open = new Map(), done = new Map(), cancelled = [];
	const assets = {
		available: () => 8,
		request( url, size, kind ) {
			const id = ++serial, parsed = new URL( url ), hash = new URLSearchParams( parsed.hash.slice( 1 ) );
			const row = { id, path: parsed.pathname, kind, part: hash.get( "part" ), anchor: hash.get( "anchor" ) };
			if ( parsed.pathname === "/assets/world/world-region-catalog.json" ) {
				const regionsById = {};
				for ( let z = 100; z < 110; z++ ) {
					for ( let x = 70; x < 90; x++ ) {
						const key = `0x${region( x, z ).toString( 16 ).padStart( 4, "0" )}`;
						regionsById[key] = [ {
							area: "constantinople",
							source: "title",
							bundlePublicPath: `/assets/world/constantinople/route.json`
						}, {
							area: "outdoor",
							source: "mission-outdoor-global",
							bundlePublicPath: `/assets/r/${key}.json`
						} ];
					}
				}
				done.set( id, {
					kind: "bytes",
					buffer: new TextEncoder().encode( JSON.stringify( { regionsById } ) ).buffer
				} );
			} else open.set( id, row );
			return id;
		},
		take( id ) {
			const result = done.get( id );
			done.delete( id );
			return result;
		},
		cancel( id ) {
			cancelled.push( id );
			open.delete( id );
			done.delete( id );
		}
	};
	/*
	================
	finish

	Completes every open request whose row passes filter.
	================
	*/
	function finish( filter = () => true ) {
		for ( const [id, row] of [ ...open ] ) {
			if ( !filter( row ) ) continue;
			open.delete( id );
			const key = Number.parseInt( row.path.match( /0x([0-9a-f]{4})/ )[1], 16 );
			const originRegion = Number.parseInt( row.anchor, 16 );
			done.set(
				id,
				row.part === "terrain" ?
					{
						kind: "world",
						world: {
							sceneId: `terrain:${key}`,
							takeWorld: () => ({
								scene: { originRegion, groups: [ { terrainSector: key } ] },
								bytes: 1
							})
						}
					} :
					{ kind: "world", world: { sceneId: `objects:${key}` }, images: [] }
			);
		}
	}
	return { assets, open, cancelled, finish };
}

/*
================
fakeRenderer
================
*/
function fakeRenderer() {
	const adopted = [];
	return {
		adopted,
		adoptWorld( world, detail, parts ) {
			adopted.push( { sceneId: world.sceneId, detail, regions: parts.map( part => part.region ) } );
		},
		setWorldTexture() {}
	};
}

/*
================
camera

A frontend camera whose target is at (x, z) in the coordinates of the
key region ORIGIN, as frontendCameraView builds it.
================
*/
function camera( x, z ) {
	return { originRegion: ORIGIN, eye: [ x, 100, z - 30 ], target: [ x, 0, z ], fov: 1, near: 1, far: 3500 };
}

test("the camera's region steps by one per 1920 units, below zero too", () => {
	assert.equal( cameraRegion( camera( 0, 0 ) ), region( 78, 105 ) );
	assert.equal( cameraRegion( camera( 1919.9, 1919.9 ) ), region( 78, 105 ) );
	assert.equal( cameraRegion( camera( 1920, 0 ) ), region( 79, 105 ) );
	assert.equal( cameraRegion( camera( 8319, 468 ) ), region( 82, 105 ) );
	assert.equal( cameraRegion( camera( 5499, -99 ) ), region( 80, 104 ) );
	assert.equal( cameraRegion( camera( -0.5, 2158 ) ), region( 77, 106 ) );
});

test("the title draws the 3x3 around the camera's region once all of it is resident", () => {
	const { assets, open, finish } = fakeAssets(), renderer = fakeRenderer();
	const regions = createTitleRegions( assets, renderer, "https://assets.test" );
	assert.equal( regions.follow( camera( 100, 100 ) ), false );
	regions.step();
	regions.step();
	const requested = [ ...open.values() ];
	assert.ok( requested.every( row => row.kind === "frontend-world" ), "every part loads as a frontend scene" );
	assert.ok( requested.every( row => !row.path.includes( "constantinople" ) ), "never the frontend route bundle" );
	assert.equal( requested.filter( row => row.part === "objects" ).length, 1 );
	assert.equal( requested.filter( row => row.part === "terrain" ).length, 9 );
	finish( row => row.part === "objects" );
	regions.step();
	assert.equal( renderer.adopted.length, 0, "objects alone do not form the scene" );
	finish();
	regions.step();
	assert.equal( renderer.adopted.length, 1 );
	assert.equal( renderer.adopted[0].detail, "full" );
	assert.deepEqual(
		[ ...renderer.adopted[0].regions ].sort( ( a, b ) => a - b ),
		[ 77, 78, 79 ].flatMap( x => [ 104, 105, 106 ].map( z => region( x, z ) ) ).sort( ( a, b ) => a - b )
	);
	assert.equal( regions.follow( camera( 1800, 100 ) ), true, "inside the drawn region" );
	assert.equal( regions.drawn(), "objects:" + region( 78, 105 ) );
});

test("a crossing holds the camera until the new 3x3 is drawn and loads only the added column", () => {
	const { assets, open, finish } = fakeAssets(), renderer = fakeRenderer();
	const regions = createTitleRegions( assets, renderer, "https://assets.test" );
	regions.follow( camera( 100, 100 ) );
	regions.step();
	regions.step();
	finish();
	regions.step();
	assert.equal( regions.follow( camera( 2000, 100 ) ), false, "the next region is not drawn yet" );
	assert.equal( regions.drawn(), null );
	regions.step();
	const terrain = [ ...open.values() ].filter( row => row.part === "terrain" );
	assert.deepEqual(
		terrain.map( row => Number.parseInt( row.path.match( /0x([0-9a-f]{4})/ )[1], 16 ) ).sort( ( a, b ) => a - b ),
		[ 104, 105, 106 ].map( z => region( 80, z ) ).sort( ( a, b ) => a - b ),
		"six of the nine regions are already resident"
	);
	finish();
	regions.step();
	assert.equal( regions.follow( camera( 2000, 100 ) ), true );
	assert.equal( renderer.adopted.length, 2 );
});

test("when the camera moves on before a scene lands, only the latest region is loaded", () => {
	const { assets, open, cancelled, finish } = fakeAssets(), renderer = fakeRenderer();
	const regions = createTitleRegions( assets, renderer, "https://assets.test" );
	regions.follow( camera( 100, 100 ) );
	regions.step();
	regions.step();
	finish();
	regions.step();
	regions.follow( camera( 2000, 100 ) );
	regions.step();
	const stale = [ ...open.values() ].find( row => row.part === "objects" );
	regions.follow( camera( 4000, 100 ) );
	regions.step();
	assert.ok( cancelled.includes( stale.id ), "the passed region's objects are cancelled" );
	finish();
	regions.step();
	assert.equal( renderer.adopted.at( -1 ).sceneId, "objects:" + region( 80, 105 ) );
	assert.equal( regions.follow( camera( 4000, 100 ) ), true );
});

test("a failed region load throws for the stage to report", () => {
	const { assets, open } = fakeAssets(), renderer = fakeRenderer();
	const regions = createTitleRegions( assets, renderer, "https://assets.test" );
	regions.follow( camera( 100, 100 ) );
	regions.step();
	regions.step();
	const objects = [ ...open.values() ].find( row => row.part === "objects" );
	const take = assets.take;
	assets.take = id => id === objects.id ? { kind: "error", error: "offline" } : take( id );
	assert.throws( () => regions.step(), /Region scene: offline/ );
});

test("terrain a scene leaves waits in an idle list of 16, most recent first, and is revived on reuse", () => {
	const { assets, open, finish } = fakeAssets();
	// No outdoor neighbours: each scene is its own region, so the list is easy to read.
	const parts = createTerrainParts(
		assets,
		"https://assets.test",
		r => `/assets/r/0x${r.toString( 16 )}.json`,
		() => false
	);
	// Eighteen regions within one anchor's range: east along one row, back along the next.
	const walk = [];
	for ( let x = 70; x <= 78; x++ ) walk.push( region( x, 105 ) );
	for ( let x = 78; x >= 70; x-- ) walk.push( region( x, 106 ) );
	for ( const centre of walk ) {
		parts.begin( centre );
		parts.request( [ centre ] );
		finish();
		parts.poll();
		parts.keep( [ centre ] );
	}
	const held = parts.held();
	assert.equal( held.length, 17, "one live region and 16 idle ones" );
	assert.equal( held[0], walk.at( -1 ) );
	assert.deepEqual( held.slice( 1 ), walk.slice( -17, -1 ).reverse() );
	// Walking back reuses an idle region without a request and revives it.
	const back = walk.at( -5 );
	parts.request( [ back ] );
	assert.equal( open.size, 0 );
	parts.keep( [ back ] );
	assert.equal( parts.held()[0], back );
	assert.equal( parts.held()[1], walk.at( -1 ), "the region just left heads the idle list" );
	assert.equal( parts.held().length, 17 );
	// A region pushed out of the list loads again.
	parts.request( [ walk[0] ] );
	assert.equal( open.size, 1 );
});
