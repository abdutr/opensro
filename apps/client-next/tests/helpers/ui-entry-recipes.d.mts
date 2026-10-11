/*
===========================================================================
ui-entry-recipes.d.mts - type boundary for shared synthetic fixture recipes
===========================================================================
*/
import type { UiEvent } from "../../src/engine/contracts/ui";

/** Partial mutable snapshots intentionally match the existing runtime fixture. */
export interface EntryFixture {
	state: any;
	ui: { event( event: UiEvent ): void; };
}
export type EntryRecipe = ( fixture: EntryFixture, step: () => void | Promise<void> ) => void | Promise<void>;
export const OPENERS: Record<string, EntryRecipe>;
export const SERVICE_WINDOWS: Record<string, EntryRecipe>;
