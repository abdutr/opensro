/*
===========================================================================

uniquelevel.go - the level a unique's equipment tables roll at

Port-only, not native (owner 2026-10-25). A unique's reward tables are
built for its own level, so a capped hunter looting Tiger Girl (level 20)
received degree-3 gear even once the level-gap exemption admitted the
kill. The owner's rule: a unique's equipment rolls at the highest level
the installed catalog fills. Native content ends at level 90 (degree 9);
the optional cap-110 catalog (cap110.go) lifts it to level 110 (degree
11), so a cap change moves unique loot with it and no degree is named
here.

===========================================================================
*/
package loot

// expansionMonsterLevelCap is the highest monster level the optional
// cap-110 catalog adds; the level cap's own expansion level.
const expansionMonsterLevelCap uint8 = 110

// cap110Installed reports that InitCap110 published the expansion catalog.
// The catalog itself is the same kind of startup-owned table.
var cap110Installed bool

/*
================
UniqueDropLevel

The level a unique's equipment tables roll at: the native cap, raised to
the expansion cap while the cap-110 catalog is installed and its top class
row carries gear. A cap with no gear at the top keeps the native level, so
a misconfigured deployment still drops something rather than nothing.
================
*/
func UniqueDropLevel() uint8 {
	if cap110Installed {
		if _, ok := SpecialEquipmentGroup(expansionMonsterLevelCap); ok {
			return expansionMonsterLevelCap
		}
	}
	return nativeMonsterLevelCap
}
