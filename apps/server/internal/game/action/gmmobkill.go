/*
===========================================================================

gmmobkill.go - GM /MOBKILL: kill the monster the GM has selected

The client sends subcommand 0x14 with the selected target's object id and a
mode word of 0 or 1 (GmCommand_ProcessChatSlashCommand @0x0050b754). The
mode meaning below is INFERENCE from community GM guides for the V-Sro
client; no server binary was read:

	mode 0 - kill the monster as a normal kill: EXP/SP, loot and the other
	         kill rewards go through the ordinary settlement
	mode 1 - kill the monster without any reward

Both modes end the monster through the ordinary population door and the
ordinary defeat lifecycle, so the corpse, its presentation time and its nest
respawn behave exactly as for a monster killed in combat.

===========================================================================
*/
package action

import (
	"opensro.online/server/internal/game/enterworld"
	"opensro.online/server/internal/game/item/wire"
	"opensro.online/server/internal/game/world/monster"
	"opensro.online/server/internal/game/world/simulation"
)

/*
================
KillGMMonster

Kills the live monster gid in the GM's own population. The GM is credited
with the HP it removed when rewards is true; with rewards false the hit is
unattributed and no settlement runs. A missing, dead or structure target
refuses the command: a fortress structure keeps standing in its destroyed
state under the fortress owner.
================
*/
func (rt *Runtime) KillGMMonster(division, name string, gid uint32, rewards bool) bool {
	if rt == nil || rt.deps == nil || rt.Monsters == nil {
		return false
	}
	unlock := rt.lockDivision(division)
	defer unlock()
	c := rt.findCharacter(division, name)
	if c == nil || c.DeletePending || !c.GMPrivilege || !enterworld.CharacterAlive(c) {
		return false
	}
	lease, admitted := rt.EntryPopulationLease(division, c.Name)
	if !admitted {
		return false
	}
	target, found := rt.Monsters.GetInPopulation(division, lease, gid)
	if !found || target.CurrentHP == 0 || target.Ref.Structure {
		return false
	}
	now := rt.Now().UnixMilli()
	plan := simulation.MonsterDamagePlan{GID: gid, ExpectedHP: target.CurrentHP, Damage: target.CurrentHP}
	var impacts []simulation.MonsterDamageResult
	var settlement monsterSettlement
	if rewards {
		plan.CreditGID = enterworld.ObjectIDForCharacter(c)
		roster := rt.monsterRewardRoster(division, c, now)
		commit := func() bool {
			impacts = rt.Monsters.ApplyDamageSequence(division, gid, target.CurrentHP, []simulation.MonsterDamagePlan{plan})
			if len(impacts) == 0 || !impacts[0].Fatal {
				return false
			}
			pose := monster.Pose{}
			if mover, exists := rt.Monsters.Mover(division, gid); exists {
				pose = mover.LivePoseAt(now, nil)
			}
			settlement = rt.settleMonsterInsideDoor(division, c, roster, impacts[0], pose, now)
			return true
		}
		if !rt.deps.UpdateManyDeferred(roster.characters, "gm-mobkill", commit) {
			return false
		}
	} else {
		impacts = rt.Monsters.ApplyDamageSequence(division, gid, target.CurrentHP, []simulation.MonsterDamagePlan{plan})
		if len(impacts) == 0 || !impacts[0].Fatal {
			return false
		}
	}
	public := []wire.Frame{monsterLifeDeadFrame(gid)}
	if rewards {
		public = append(public, rt.groundReferences(settlement.drops)...)
		for _, drop := range settlement.drops {
			public = append(public, wire.DropBroadcastFrames(drop.SpawnRow(true))...)
		}
		rt.announceSealDrops(division, target.Ref.Name, settlement.drops, now)
		public = append(public, settlement.public...)
	}
	rt.queueMonsterDefeat(division, gid, now+monsterDeathPresentationRetention.Milliseconds())
	batches := []simulation.DivisionFrames{{DivisionID: division, SourceGID: enterworld.ObjectIDForCharacter(c), Frames: simFrames(public)}}
	if private := wire.ProgressionPrivateFrames(settlement.actorFrames); len(private) > 0 {
		batches = append(batches, simulation.DivisionFrames{DivisionID: division, OnlyCharacterID: c.ID, Frames: simFrames(private)})
	}
	batches = append(batches, recipientDivisionFrames(division, settlement.others)...)
	rt.queueMonsterLegFrames(batches)
	return true
}

/*
================
queueMonsterLegFrames

Frames a kill committed outside an action session waits for the action tick,
like queueMonsterLegRecipients.
================
*/
func (rt *Runtime) queueMonsterLegFrames(batches []simulation.DivisionFrames) {
	if len(batches) == 0 {
		return
	}
	rt.monsterLegRecipientsMu.Lock()
	rt.monsterLegRecipients = append(rt.monsterLegRecipients, batches...)
	rt.monsterLegRecipientsMu.Unlock()
}
