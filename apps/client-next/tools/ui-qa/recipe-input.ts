/*
===========================================================================
recipe-input.ts - fixture inputs through observed production semantics

Recipes may seed snapshots but must not invent input targets or menu permissions.
===========================================================================
*/
import type { RecipeContext } from "./extended";

/*
================
press
================
*/
export async function press(
	context: RecipeContext,
	id: string,
	kind: "activate" | "double-activate" | "right-activate" = "activate"
) {
	await context.step();
	const control = context.controls().find( row => row.id === id );
	if ( !control || control.disabled ) throw Error( `Required visible enabled control unavailable: ${id}` );
	context.ui.event( { kind, id } );
	await context.step();
}

/*
================
openPanel

Explicit direct presentation mount, not proof of a preceding hotkey/menu path.
================
*/
export async function openPanel( context: RecipeContext, name: string ) {
	await context.step();
	context.ui.event( { kind: "activate", id: "open-window:" + name } );
	await context.step();
}

/*
================
npc
================
*/
export function npc( context: RecipeContext, capabilities: number, name = "Service official" ) {
	context.state.entities = context.state.entities.filter( ( row: any ) => row.gid !== 99 );
	context.state.entities.push( { ...context.state.entities[0], gid: 99, refObjId: 2011, kind: "npc", name } );
	Object.assign( context.state.gameplay, {
		target: 99,
		targetCapabilities: capabilities,
		npcConversation: { phase: "menu", gid: 99, dialogueRevision: 1 }
	} );
}

/*
================
published
================
*/
export async function published( name: string ) {
	if ( !/^[a-zA-Z0-9-]+$/.test( name ) ) throw Error( "Invalid fixture data name" );
	const response = await fetch( `/assets/data/${name}.json` );
	if ( !response.ok ) throw Error( `Published fixture reference unavailable: ${name}` );
	return response.json();
}

export const herb = {
	slot: 14,
	refObjId: 3630,
	typeFlags: 0x8ec,
	quantity: 10,
	name: "HP recovery herb",
	icon: "item/etc/hp_potion_01.ddj",
	plus: 0,
	durability: 0,
	variance: "0",
	magic: []
};
