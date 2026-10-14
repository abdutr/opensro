/*
===========================================================================

ui-harness.ts - the production UI built from named parts

createUi takes eighteen positional parameters (the known-debt signature in
runtime/ui/ui.ts). The runtime sweep's fixture (tests/helpers/ui-fixture.mjs)
and the review frame (tools/ui-qa/frame.ts) both build the real UI outside
the runtime; they name what they supply here, and this is the one place
that knows the positional order. A change to createUi's signature is fixed
here once, and each option's type follows the parameter it fills.

===========================================================================
*/
import { createUi } from "../../../src/engine/runtime/ui/ui.ts";

type UiParameters = Parameters<typeof createUi>;

/*
================
UiHarnessOptions

The six parts every builder supplies, and the optional hooks it may name;
an omitted hook takes createUi's own default.
================
*/
export interface UiHarnessOptions {
	assets: UiParameters[0];
	commands: UiParameters[1];
	publish: UiParameters[2];
	texture: UiParameters[3];
	base: UiParameters[4];
	apiBase: UiParameters[5];
	clickSound?: UiParameters[6];
	sound?: UiParameters[7];
	loadingVariant?: UiParameters[8];
	chooseTip?: UiParameters[9];
	saveOptions?: UiParameters[10];
	audioPreference?: UiParameters[11];
	saveSight?: UiParameters[12];
	saveBindings?: UiParameters[13];
	saveVideo?: UiParameters[14];
	saveBlocks?: UiParameters[15];
	saveQuickslots?: UiParameters[16];
	extensions?: UiParameters[17];
}

/*
================
createUiHarness
================
*/
export function createUiHarness( options: UiHarnessOptions ): ReturnType<typeof createUi> {
	return createUi(
		options.assets,
		options.commands,
		options.publish,
		options.texture,
		options.base,
		options.apiBase,
		options.clickSound,
		options.sound,
		options.loadingVariant,
		options.chooseTip,
		options.saveOptions,
		options.audioPreference,
		options.saveSight,
		options.saveBindings,
		options.saveVideo,
		options.saveBlocks,
		options.saveQuickslots,
		options.extensions
	);
}
