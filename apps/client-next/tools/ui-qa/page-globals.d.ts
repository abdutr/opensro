/*
===========================================================================

page-globals.d.ts - what the review frame exposes inside the page

The probes run code in the frame through Playwright's evaluate, reading the
API frame.ts installs on window. Typed from frame.ts itself, so a change to
that API breaks the probes' type check (verify:ui-qa-types).

===========================================================================
*/

interface Window {
	__uiQa: import("./frame.ts").UiQaApi;
}
