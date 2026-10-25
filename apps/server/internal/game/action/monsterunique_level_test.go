/*
===========================================================================

monsterunique_level_test.go - unique equipment rolls at the shard's top level

Port-only, not native (owner 2026-10-25): SRO_UNIQUE_MAX_LEVEL_LOOT rolls a
unique's equipment tables at the highest installed level instead of the
unique's own level, so Tiger Girl (level 20) leaves degree-9 gear at the
native cap and the same rule yields degree-11 gear once the cap-110 catalog
moves the top. Off is the native unique-level table.

===========================================================================
*/
package action

import (
	"strings"
	"testing"

	"opensro.online/server/internal/game/progression"
	"opensro.online/server/internal/game/world/monster"
	"opensro.online/server/internal/game/world/simulation"
)

/*
================
TestUniqueDropTableLevel

The rule's arithmetic: a unique rolls at the top level, an ordinary monster
keeps its own, a unique above the top keeps its own, and off is native.
================
*/
func TestUniqueDropTableLevel(t *testing.T) {
	unique := monster.Instance{Ref: monster.MonsterRef{Level: 20, MonsterType: 3}}
	ordinary := monster.Instance{Ref: monster.MonsterRef{Level: 20, MonsterType: 0}}
	above := monster.Instance{Ref: monster.MonsterRef{Level: 94, MonsterType: 3}}
	for _, tc := range []struct {
		name  string
		rules progression.UniqueRules
		mob   monster.Instance
		want  uint8
	}{
		{"unique at the cap", progression.UniqueRules{MaxLevelLoot: true}, unique, 90},
		{"ordinary at the cap", progression.UniqueRules{MaxLevelLoot: true}, ordinary, 20},
		{"unique above the cap", progression.UniqueRules{MaxLevelLoot: true}, above, 94},
		{"unique native table", progression.UniqueRules{}, unique, 20},
	} {
		rt := Runtime{UniqueRules: tc.rules}
		if got := rt.uniqueDropTableLevel(tc.mob); got != tc.want {
			t.Fatalf("%s = %d, want %d", tc.name, got, tc.want)
		}
	}
}

/*
================
TestUniquePrepassRollsCapLevelEquipment

A level-20 unique's prepass leaves degree-9 equipment while the rule is on
and its native degree-3 equipment off. The item is still the special
constructor's: +1..5, magic options, non-repairable.
================
*/
func TestUniquePrepassRollsCapLevelEquipment(t *testing.T) {
	for _, tc := range []struct {
		name  string
		rules progression.UniqueRules
		want  string
	}{
		{"cap level", progression.UniqueRules{MaxLevelLoot: true}, "_09_"},
		{"native", progression.UniqueRules{}, "_03_"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rt, _, c, target := newCombatTestRuntimeAtLevel(t, 1, 20)
			installLootReferences(t, rt)
			target.Ref.Codename, target.Ref.MonsterType = "MOB_CH_TIGERWOMAN", 3
			target.Nest.HasRarityOverride, target.Nest.RarityOverride = true, 3
			rt.UniqueRules = tc.rules
			rt.DropRoll = constantDropRoll(0)
			drops := rt.prepareUniqueDrops(uniqueDropContext{mob: target, owner: c.Name, now: rt.Now()})
			equipment := 0
			for _, drop := range drops {
				if drop.TypeFlags&0x7c != 0x2c {
					continue
				}
				equipment++
				if !strings.Contains(drop.Codename, tc.want) {
					t.Fatalf("prepass equipment %s, want a %s item", drop.Codename, tc.want)
				}
				if drop.Plus < 1 || drop.Plus > 5 || len(drop.MagicOptions) == 0 {
					t.Fatalf("special constructor properties lost: %+v", drop)
				}
			}
			if equipment == 0 {
				t.Fatal("unique prepass dropped no equipment")
			}
		})
	}
}

/*
================
TestUniqueSealRewardsAreGuaranteed

A kill whose draws admit every seal leaves exactly one of each, of the top
degree, no matter how small the ordinary drop cap is: the seals are appended
after the cap like the ticket. A draw that admits none leaves the Star only.
================
*/
func TestUniqueSealRewardsAreGuaranteed(t *testing.T) {
	for _, tc := range []struct {
		name string
		roll uint32
		want map[string]int
	}{
		{"every seal", 0, map[string]int{"_09_A_RARE": 1, "_09_B_RARE": 1, "_09_C_RARE": 1}},
		{"star only", 7, map[string]int{"_09_A_RARE": 1}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rt, _, c, target := newCombatTestRuntimeAtLevel(t, 1, 20)
			installLootReferences(t, rt)
			target.Ref.Codename, target.Ref.MonsterType = "MOB_CH_TIGERWOMAN", 3
			target.Nest.HasRarityOverride, target.Nest.RarityOverride = true, 3
			rt.UniqueRules = progression.UniqueRules{MaxLevelLoot: true, SealDrops: true}
			rt.DropCap = 1
			rt.DropRoll = constantDropRoll(tc.roll)
			drops := rt.planMonsterKillLoot(c, target, monster.Pose{
				RegionID: target.Spawn.RegionID, X: target.Spawn.X, Y: target.Spawn.Y, Z: target.Spawn.Z,
			}, rt.Now().UnixMilli())
			got := map[string]int{}
			for _, drop := range drops {
				for suffix := range tc.want {
					if strings.HasSuffix(drop.Codename, suffix) {
						got[suffix]++
					}
				}
			}
			for suffix, want := range tc.want {
				if got[suffix] != want {
					t.Fatalf("%s drops %d, want %d (all seals %v)", suffix, got[suffix], want, got)
				}
			}
		})
	}
}

/*
================
TestUniqueSealSwitchOffIsNative

With the seal switch off the kill keeps the native rare roll only: a draw
that never rolls rare leaves no sealed equipment even with the top-level
table in force.
================
*/
func TestUniqueSealSwitchOffIsNative(t *testing.T) {
	rt, _, c, target := newCombatTestRuntimeAtLevel(t, 1, 20)
	installLootReferences(t, rt)
	target.Ref.Codename, target.Ref.MonsterType = "MOB_CH_TIGERWOMAN", 3
	target.Nest.HasRarityOverride, target.Nest.RarityOverride = true, 3
	rt.UniqueRules = progression.UniqueRules{MaxLevelLoot: true}
	rt.DropRoll = constantDropRoll(7)
	for _, drop := range rt.planMonsterKillLoot(c, target, monster.Pose{
		RegionID: target.Spawn.RegionID, X: target.Spawn.X, Y: target.Spawn.Y, Z: target.Spawn.Z,
	}, rt.Now().UnixMilli()) {
		if strings.HasSuffix(drop.Codename, "_RARE") {
			t.Fatalf("seal switch off left %s", drop.Codename)
		}
	}
}

/*
================
TestUniqueOrdinaryEquipmentTakesTheTopStrengthTier

A unique's ordinary (non-seal) pick under SRO_UNIQUE_MAX_LEVEL_LOOT comes
from the level's highest class: degree 9's C tier at the native cap, whose
required level and stats are the top of the three.
================
*/
func TestUniqueOrdinaryEquipmentTakesTheTopStrengthTier(t *testing.T) {
	rt, _, _, target := newCombatTestRuntimeAtLevel(t, 1, 20)
	installLootReferences(t, rt)
	target.Ref.Codename, target.Ref.MonsterType = "MOB_CH_TIGERWOMAN", 3
	target.Nest.HasRarityOverride, target.Nest.RarityOverride = true, 3
	rt.UniqueRules = progression.UniqueRules{MaxLevelLoot: true}
	rt.DropRoll = constantDropRoll(7)
	item, ok := rt.prepareEquipmentDropKind(target, simulation.Spawn{}, target.Ref.Codename, rt.Now(), false)
	if !ok {
		t.Fatal("ordinary unique equipment pick failed")
	}
	if !strings.Contains(item.Codename, "_09_") || !strings.HasSuffix(item.Codename, "_C") {
		t.Fatalf("ordinary unique pick %s, want the degree-9 C tier", item.Codename)
	}
}
