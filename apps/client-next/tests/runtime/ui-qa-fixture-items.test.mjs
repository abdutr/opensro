/*
===========================================================================

ui-qa-fixture-items.test.mjs - the QA bench's items are shipped items

Every FIXTURE_ITEMS entry must name a real v1.150 itemdata row: the codename
at its RefObjID, and the type word its TypeID1-4 pack to. A RefObjID dressed
in another item's type word would show the bench a state no client reaches.

===========================================================================
*/
import "../helpers/native-source-loader.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { listTextDataShardNamesSync, readTextDataRowsSync } from "../../../../scripts/build/shared/textDataIo.mjs";
import { retailTextdataRoot } from "../../../../scripts/build/world/paths.mjs";

const { FIXTURE_ITEMS, FIXTURE_REFERENCES } = await import( pathToFileURL( "tools/ui-qa/fixture-items.ts" ).href );

// itemdata and characterdata columns: 1 RefObjID, 2 codename, 9-12 TypeID1-4.
const COL_ID = 1, COL_CODENAME = 2, COL_TYPE_ID1 = 9;

/*
================
packTypeFlags

The client's item type word: TypeID1 << 2 | TypeID2 << 5 | TypeID3 << 7 |
TypeID4 << 11.
================
*/
function packTypeFlags( t1, t2, t3, t4 ) {
	return (t1 & 7) << 2 | (t2 & 3) << 5 | (t3 & 15) << 7 | (t4 & 31) << 11;
}

/*
================
shippedItems
================
*/
function shippedItems( table = "itemdata" ) {
	const items = new Map();
	const shards = table === "itemdata" ? /^itemdata_\d+\.txt$/i : /^characterdata_\d+\.txt$/i;
	for ( const name of listTextDataShardNamesSync( retailTextdataRoot, shards ) ) {
		for ( const row of readTextDataRowsSync( path.join( retailTextdataRoot, name ) ) ) {
			if ( row[0] !== "1" ) continue;
			const [t1, t2, t3, t4] = row.slice( COL_TYPE_ID1, COL_TYPE_ID1 + 4 ).map( Number );
			items.set( Number( row[COL_ID] ), {
				codename: row[COL_CODENAME],
				typeFlags: packTypeFlags( t1, t2, t3, t4 )
			} );
		}
	}
	return items;
}

test("every QA fixture item is the shipped row its RefObjID names", () => {
	const items = shippedItems();
	assert.ok( items.size > 1000, "itemdata loaded" );
	for ( const [role, item] of Object.entries( FIXTURE_ITEMS ) ) {
		const shipped = items.get( item.refObjId );
		assert.ok( shipped, `${role}: RefObjID ${item.refObjId} is not in itemdata` );
		assert.equal( shipped.codename, item.codename, `${role}: codename` );
		assert.equal(
			item.typeFlags,
			shipped.typeFlags,
			`${role}: type word ${item.typeFlags.toString( 16 )} vs ${shipped.typeFlags.toString( 16 )}`
		);
	}
});

test("every QA fixture NPC and COS is the shipped character row its RefObjID names", () => {
	const references = shippedItems( "characterdata" );
	assert.ok( references.size > 1000, "characterdata loaded" );
	for ( const [role, reference] of Object.entries( FIXTURE_REFERENCES ) ) {
		assert.equal( references.get( reference.refObjId )?.codename, reference.codename, role );
	}
});
