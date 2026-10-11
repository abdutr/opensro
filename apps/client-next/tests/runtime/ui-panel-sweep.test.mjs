/*
===========================================================================

ui-panel-sweep.test.mjs - every registered window publishes unique controls

BUG-064 hid in windows no test opened: a frame close button and the window's
own Cancel shared one control id. The fixture refuses duplicate ids on every
publication, so opening each registered panel through the production HUD
checks duplicate IDs in the mounted cases. Target-specific controls must appear;
an Inventory companion or NPC menu cannot stand in for the requested surface.
Recipes use direct activation or synthetic response snapshots; this sweep does
not prove the visible menu path or all states of each window.
SERVICE_WINDOWS adds the windows no registered panel opens (Global chat
crashed with a frame close and Cancel sharing "wholechat-exit").

===========================================================================
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { uiFixture } from "../helpers/ui-fixture.mjs";
const { uiPanels } = await import( "../../src/engine/foundation/ui/panels.ts" );
import { OPENERS, SERVICE_WINDOWS } from "../helpers/ui-entry-recipes.mjs";
import { entryEvidence } from "../helpers/ui-entry-evidence.mjs";

for ( const panel of [ ...uiPanels(), ...Object.keys( SERVICE_WINDOWS ) ] ) {
	test(`${panel} opens with unique control ids`, async t => {
		const f = uiFixture();
		t.after( () => f.dispose() );
		let now = 0;
		// A property, not a local: the closure assigns it, and a narrowed local
		// would read as never at the assertions.
		const seen = {
			/** @type {import("../../src/engine/contracts/ui.ts").UiSemantics | null} */ presentation: null
		};
		const step = () => {
			for ( let i = 0; i < 16; i++ ) seen.presentation = f.ui.step( f.state, now += 100 ) ?? seen.presentation;
		};
		step();
		const open = OPENERS[panel] ?? SERVICE_WINDOWS[panel] ??
			(() => f.ui.event( { kind: "activate", id: "open-window:" + panel } ));
		await open( f, step );
		step();
		const evidence = entryEvidence( panel, seen.presentation?.controls ?? [] );
		assert.ok( evidence.admitted, `${panel} is missing its own controls: ${evidence.missing.join( ", " )}` );
	});
}

test("companion Inventory and an official menu do not admit missing target windows", async t => {
	for ( const name of [ "Magic option", "Fortress war application" ] ) {
		const f = uiFixture();
		t.after( () => f.dispose() );
		const seen = {
			/** @type {import("../../src/engine/contracts/ui.ts").UiSemantics | null} */ presentation: null
		};
		let now = 0;
		const step = () => {
			for ( let i = 0; i < 16; i++ ) seen.presentation = f.ui.step( f.state, now += 100 ) ?? seen.presentation;
		};
		step();
		if ( name === "Magic option" ) f.ui.event( { kind: "activate", id: "open-window:Magic option" } );
		else {
			await OPENERS[name]( f, step );
			delete f.state.gameplay.fortress;
		}
		step();
		const controls = seen.presentation?.controls ?? [];
		assert.ok(
			controls.some( control => control.id === (name === "Magic option" ? "inventory-gold" : "npc-close") )
		);
		assert.equal( entryEvidence( name, controls ).admitted, false );
	}
});
