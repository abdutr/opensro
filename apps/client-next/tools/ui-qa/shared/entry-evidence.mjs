/*
===========================================================================
entry-evidence.mjs - target-specific witnesses for synthetic UI mounts

These are production semantic identities, not new window implementations.
Every required control must be present. A companion or prerequisite cannot
stand in for the requested surface. This does not prove visible menu entry.
===========================================================================
*/

const { uiPanels, panelCloseId } = await import( "../../../src/engine/foundation/ui/panels.ts" );

/*
================
ENTRY_WITNESSES

Each target's own controls, written by hand: one or two the window publishes
and no other surface does. A registry panel's close control is not listed
here; panelWitnesses derives it from the registry (panels.ts panelCloseId),
so a renamed close id fails in one place.
================
*/
/** @type {Record<string, readonly string[]>} */
export const ENTRY_WITNESSES = {
	"Academy": [ "academy-invite", "select-window:Academy" ],
	"Academy Matching": [ "academy-search", "academy-refresh" ],
	"Actions": [ "action:1000", "select-window:Actions" ],
	"Alchemy": [ "alchemy-mode:compound", "alchemy-start" ],
	"Auto Potion": [ "potion-enable:hp", "potion-percent:hp" ],
	"Blocking": [ "blocking-list", "blocking-add" ],
	"COS inventory": [ "window-drag:COS inventory", "cos-tab:0" ],
	"Character": [ "stat-str", "stat-int" ],
	"Chat": [ "chat-channel:1", "chat-send" ],
	"Experimental": [ "experimental-tab:0", "experimental-render-scale:100" ],
	"Fortress war application": [ "fortress-war-close", "fortress-war-slot:1" ],
	"Fortress war schedule": [ "fortress-schedule-close", "fortress-schedule-prev" ],
	"Fortress tax": [ "fortress-tax-close", "fortress-tax-help:19" ],
	"Fortress production": [ "fortress-production-close", "window-drag:Fortress production" ],
	"Game Guide": [ "guide-sidebar", "guide-up" ],
	"Guild": [ "guild-tab:0", "guild-tab:1" ],
	// Guild tools is an intentional registry alias of the Guild owner.
	"Guild tools": [ "guild-tab:0", "guild-tab:1" ],
	"Inventory": [ "inventory-page:0", "inventory-gold" ],
	"Job ranking": [ "job-rank-close", "job-rank-prev" ],
	"Magic Pop": [ "gacha-prize:1", "gacha-prize:2" ],
	"Magic option": [ "magic-option-close", "magic-option-slot" ],
	"Map": [ "map-pan", "map-follow" ],
	"Option": [ "option-tab:0", "option-ok" ],
	"Party": [ "party-invite", "select-window:Party" ],
	"Party Matching": [ "party-match:purpose", "party-search-name" ],
	"Quests": [ "quest-scroll-up", "quest-scroll-thumb" ],
	"Shop": [ "window-drag:Shop", "shop-repair:GDR_STORE_BTN_REPAIRALL" ],
	"Skills": [ "skill-scroll-up", "skill-scroll-thumb" ],
	"Skin change": [ "skin-close", "skin:male" ],
	"Stall network": [ "stall-net-close", "stall-net-search" ],
	"Storage": [ "storage-slot:0", "storage-gold" ],
	"System": [ "system-restart", "system-exit" ],
	"Global chat": [ "wholechat-close", "wholechat-text" ],
	"Exchange": [ "exchange-close", "exchange-my:0" ],
	"Stall": [ "stall-close", "stall-slot:0" ]
};

// Registry names drawn by another panel's window, which owns their close.
const PANEL_ALIASES = /** @type {Record<string, string>} */ ({ "Guild tools": "Guild" });

/*
================
panelWitnesses

The close control a registry panel publishes while it shows. A window that
draws its own close control (its hand witnesses name one, as the fortress
windows' "fortress-war-close" does) publishes no registry close; an alias
publishes its owner's.
================
*/
/** @param {string} name */
function panelWitnesses( name ) {
	if ( (ENTRY_WITNESSES[name] ?? []).some( id => id.endsWith( "-close" ) ) ) return [];
	const panel = uiPanels().find( row => row === (PANEL_ALIASES[name] ?? name) );
	return panel ? [ panelCloseId( panel ) ] : [];
}

/*
================
entryEvidence

Unknown targets fail closed. Presence proves only this mounted presentation;
disabled controls are valid witnesses, not proof that their action is allowed.
================
*/
/** @param {string} name @param {readonly {id: string}[]} controls */
export function entryEvidence( name, controls ) {
	const witnesses = ENTRY_WITNESSES[name] ?? [];
	// Unknown targets stay unknown: a derived close id alone admits nothing.
	const required = witnesses.length ? [ ...panelWitnesses( name ), ...witnesses ] : witnesses;
	const ids = new Set( controls.map( control => control.id ) );
	const missing = required.filter( id => !ids.has( id ) );
	return {
		required,
		missing,
		admitted: required.length > 0 && missing.length === 0,
		entryFlow: "unverified; synthetic presentation admission"
	};
}
