/*
===========================================================================

gmmobkill_test.go - /MOBKILL

Mode 0 kills through the ordinary settlement (reward, then the public dead
frame and the actor's private progression); mode 1 kills with no reward at
all. Both end the monster through the ordinary defeat lifecycle, and a
refused command changes nothing.

===========================================================================
*/
package action

import (
	"testing"

	"opensro.online/server/internal/game/enterworld"
	"opensro.online/server/internal/game/item/wire"
)

type mobKillFixture struct {
	rt    *Runtime
	clock *fakeClock
	gm    *enterworld.Character
	gid   uint32
	calls int
}

func newMobKillFixture(t *testing.T) *mobKillFixture {
	t.Helper()
	rt, clock, gm, target := newCombatTestRuntime(t, 1)
	gm.GMPrivilege = true
	if err := rt.admitPopulationSession(testDivision, gm.Name, 1); err != nil {
		t.Fatal(err)
	}
	f := &mobKillFixture{rt: rt, clock: clock, gm: gm, gid: target.Gid}
	rt.UpdateExperience = func(*enterworld.Character, int64, int64, uint32) ([]wire.Frame, bool) {
		f.calls++
		return []wire.Frame{{Opcode: wire.OpExpUpdate, Payload: []byte{0xA5}}}, true
	}
	return f
}

// opcodes returns every opcode the tick delivered, by recipient (0 = public).
func (f *mobKillFixture) opcodes(t *testing.T) (public, private []uint16) {
	t.Helper()
	for _, batch := range f.rt.TickHook()(f.clock.Now().UnixMilli()) {
		for _, frame := range batch.Frames {
			if batch.OnlyCharacterID == f.gm.ID {
				private = append(private, frame.Opcode)
			} else if batch.SourceGID == enterworld.ObjectIDForCharacter(f.gm) {
				public = append(public, frame.Opcode)
			}
		}
	}
	return public, private
}

func hasOp(ops []uint16, op uint16) bool {
	for _, o := range ops {
		if o == op {
			return true
		}
	}
	return false
}

/*
================
TestGMMobKillWithRewardsPaysTheGM
================
*/
func TestGMMobKillWithRewardsPaysTheGM(t *testing.T) {
	f := newMobKillFixture(t)
	if !f.rt.KillGMMonster(testDivision, f.gm.Name, f.gid, true) {
		t.Fatal("the kill was refused")
	}
	if f.calls != 1 {
		t.Fatalf("the GM was paid %d times, want once", f.calls)
	}
	if row, ok := f.rt.Monsters.Get(testDivision, f.gid); !ok || row.CurrentHP != 0 {
		t.Fatalf("monster after the kill = %+v/%v, want retained dead", row, ok)
	}
	public, private := f.opcodes(t)
	if !hasOp(public, wire.OpObjectStateRefresh) {
		t.Fatalf("no public LIFE-dead frame: %v", public)
	}
	if !hasOp(private, wire.OpExpUpdate) {
		t.Fatalf("no private progression for the GM: %v", private)
	}
	f.rt.TickHook()(f.clock.At(monsterDeathPresentationRetention).UnixMilli())
	if _, ok := f.rt.Monsters.Get(testDivision, f.gid); ok {
		t.Fatal("the corpse outlived the death-presentation retention")
	}
}

/*
================
TestGMMobKillWithoutRewardsPaysNobody
================
*/
func TestGMMobKillWithoutRewardsPaysNobody(t *testing.T) {
	f := newMobKillFixture(t)
	if !f.rt.KillGMMonster(testDivision, f.gm.Name, f.gid, false) {
		t.Fatal("the kill was refused")
	}
	if f.calls != 0 {
		t.Fatalf("a no-reward kill paid %d times", f.calls)
	}
	public, private := f.opcodes(t)
	if !hasOp(public, wire.OpObjectStateRefresh) || len(private) != 0 {
		t.Fatalf("frames public=%v private=%v, want only the public LIFE-dead frame", public, private)
	}
	if row, ok := f.rt.Monsters.Get(testDivision, f.gid); !ok || row.CurrentHP != 0 {
		t.Fatalf("monster after the kill = %+v/%v, want retained dead", row, ok)
	}
}

/*
================
TestGMMobKillRefusals
================
*/
func TestGMMobKillRefusals(t *testing.T) {
	for _, rewards := range []bool{true, false} {
		f := newMobKillFixture(t)
		if f.rt.KillGMMonster(testDivision, f.gm.Name, f.gid+1000, rewards) {
			t.Fatal("an unknown target was killed")
		}
		if f.rt.KillGMMonster(testDivision, "nobody", f.gid, rewards) {
			t.Fatal("an unknown GM was honored")
		}
		f.gm.GMPrivilege = false
		if f.rt.KillGMMonster(testDivision, f.gm.Name, f.gid, rewards) {
			t.Fatal("a non-GM killed a monster")
		}
		f.gm.GMPrivilege = true
		if row, _ := f.rt.Monsters.Get(testDivision, f.gid); row.CurrentHP == 0 {
			t.Fatal("a refused command changed the monster")
		}
		if !f.rt.KillGMMonster(testDivision, f.gm.Name, f.gid, rewards) {
			t.Fatal("the control kill was refused")
		}
		if f.rt.KillGMMonster(testDivision, f.gm.Name, f.gid, rewards) {
			t.Fatal("a dead monster was killed again")
		}
		if f.calls > 1 {
			t.Fatalf("the GM was paid %d times", f.calls)
		}
	}
}
