/*
===========================================================================

uniquerules_test.go - the default-on unique reward switches

All three switches ship ON (owner, 2026-10-20 and 2026-10-25) and only an
explicit off value restores the native rule, one switch at a time.

===========================================================================
*/
package progression

import "testing"

/*
================
TestUniqueRulesFromEnvDefaultsOn
================
*/
func TestUniqueRulesFromEnvDefaultsOn(t *testing.T) {
	t.Setenv(EnvUniqueGapExempt, "")
	t.Setenv(EnvUniquePopTicket, "")
	t.Setenv(EnvUniqueMaxLevelLoot, "")
	if rules := UniqueRulesFromEnv(); !rules.GapExempt || !rules.PopTicket || !rules.MaxLevelLoot {
		t.Fatalf("unset switches = %+v, want all on", rules)
	}
	for _, value := range []string{"on", "1", "true", "ON", "anything"} {
		t.Setenv(EnvUniqueGapExempt, value)
		t.Setenv(EnvUniquePopTicket, value)
		t.Setenv(EnvUniqueMaxLevelLoot, value)
		if rules := UniqueRulesFromEnv(); !rules.GapExempt || !rules.PopTicket || !rules.MaxLevelLoot {
			t.Fatalf("switches at %q = %+v, want all on", value, rules)
		}
	}
}

/*
================
TestUniqueRulesFromEnvExplicitOffIsNative

Each switch turns off alone: the other two stay on.
================
*/
func TestUniqueRulesFromEnvExplicitOffIsNative(t *testing.T) {
	for _, value := range []string{"off", "0", "false", "OFF", " False "} {
		t.Setenv(EnvUniqueGapExempt, value)
		t.Setenv(EnvUniquePopTicket, "on")
		t.Setenv(EnvUniqueMaxLevelLoot, "on")
		if rules := UniqueRulesFromEnv(); rules.GapExempt || !rules.PopTicket || !rules.MaxLevelLoot {
			t.Fatalf("gap switch at %q = %+v, want gap off and the rest on", value, rules)
		}
		t.Setenv(EnvUniqueGapExempt, "on")
		t.Setenv(EnvUniquePopTicket, value)
		if rules := UniqueRulesFromEnv(); !rules.GapExempt || rules.PopTicket || !rules.MaxLevelLoot {
			t.Fatalf("ticket switch at %q = %+v, want ticket off and the rest on", value, rules)
		}
		t.Setenv(EnvUniquePopTicket, "on")
		t.Setenv(EnvUniqueMaxLevelLoot, value)
		if rules := UniqueRulesFromEnv(); !rules.GapExempt || !rules.PopTicket || rules.MaxLevelLoot {
			t.Fatalf("max-level switch at %q = %+v, want max-level off and the rest on", value, rules)
		}
	}
}
