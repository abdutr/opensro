/*
===========================================================================
fixture-items.ts - the shipped items the QA recipes put in bags and stalls

Every recipe item names a real v1.150 itemdata row: its RefObjID, its
codename and the type word its TypeID1-4 pack to. Production keys icons,
tooltips and behaviour on both, so a RefObjID dressed in another item's
type word shows the bench a state no client could reach.
tests/runtime/ui-qa-fixture-items.test.mjs checks every entry against the
shipped itemdata, and every FIXTURE_REFERENCES entry against characterdata.
===========================================================================
*/

/*
================
FixtureItem
================
*/
export interface FixtureItem {
	readonly refObjId: number;
	readonly codename: string;
	readonly typeFlags: number;
	readonly icon: string;
}

export const FIXTURE_ITEMS = {
	// 3/3/1/1: the HP recovery herb.
	hpHerb: {
		refObjId: 4,
		codename: "ITEM_ETC_HP_POTION_01",
		typeFlags: 0x08ec,
		icon: "item/etc/hp_potion_01.ddj"
	},
	// 3/3/13/0: the Item Mall skill restoration potion.
	skillRestorationPotion: {
		refObjId: 3828,
		codename: "ITEM_MALL_SKILL_RESTORATION_POTION",
		typeFlags: 0x06ec,
		icon: "item/etc/mall_skill_restoration_potion.ddj"
	},
	// 3/3/9/0: a quest skill-point potion.
	questSkillPointPotion: {
		refObjId: 3673,
		codename: "ITEM_QSP_ALL_POTION_1_01",
		typeFlags: 0x04ec,
		icon: "item/etc/qsp_all_potion_1_01.ddj"
	},
	// 3/3/1/6: the pet revival item the "revive" confirmation uses.
	petRevival: {
		refObjId: 7552,
		codename: "ITEM_COS_P_REVIVAL",
		typeFlags: 0x30ec,
		icon: "cos/item_cos_p_revival.ddj"
	},
	// 3/3/13/12: the pet lease extension the "renew" confirmation uses.
	petExtension: {
		refObjId: 8985,
		codename: "ITEM_COS_P_EXTENSION",
		typeFlags: 0x66ec,
		icon: "cos/item_cos_p_extension.ddj"
	},
	// 3/2/1/2: a pickup pet summoner.
	rabbitSummoner: {
		refObjId: 10366,
		codename: "ITEM_COS_P_RABBIT_SCROLL",
		typeFlags: 0x10cc,
		icon: "cos/item_cos_p_rabbit_scroll.ddj"
	},
	// 3/3/13/14: the Gold Time premium package.
	goldTime: {
		refObjId: 10130,
		codename: "ITEM_MALL_PREMIUM_GOLDTIME",
		typeFlags: 0x76ec,
		icon: "item/etc/mall_premium_goldtime.ddj"
	},
	// 3/3/3/1: the ordinary return scroll (a Gold Time limited use).
	returnScroll: {
		refObjId: 61,
		codename: "ITEM_ETC_SCROLL_RETURN_01",
		typeFlags: 0x09ec,
		icon: "item/etc/scroll_return_01.ddj"
	},
	// 3/3/3/3: the reverse return scroll (a Gold Time limited use).
	reverseReturnScroll: {
		refObjId: 3795,
		codename: "ITEM_MALL_REVERSE_RETURN_SCROLL",
		typeFlags: 0x19ec,
		icon: "item/etc/mall_reverse_return_scroll.ddj"
	},
	// 3/1/6/2: a Chinese sword.
	sword: {
		refObjId: 3632,
		codename: "ITEM_CH_SWORD_01_A_DEF",
		typeFlags: 0x132c,
		icon: "item/china/weapon/sword_01.ddj"
	}
} as const satisfies Record<string, FixtureItem>;

/*
================
FixtureReference

A shipped characterdata row a recipe places in the world: an NPC or a COS.
================
*/
export interface FixtureReference {
	readonly refObjId: number;
	readonly codename: string;
}

export const FIXTURE_REFERENCES = {
	// The Jangan ferryman: the ferry recipe's own NPC, and the stand-in the
	// generic service-NPC recipes keep (they test menus, not the NPC).
	ferryman: { refObjId: 2011, codename: "NPC_CH_FERRY" },
	// Jangan's fortress official (FORTRESS_JANGAN).
	chFortressOfficial: { refObjId: 19520, codename: "NPC_CH_FORTRESS_OFFICIAL" },
	// Jangan's specialty trader, who sells trade goods into a transport.
	chSpecialTrader: { refObjId: 2010, codename: "NPC_CH_SPECIAL" },
	// A trade transport (COS band 2).
	transport: { refObjId: 3914, codename: "COS_T_DHORSE3" }
} as const satisfies Record<string, FixtureReference>;
