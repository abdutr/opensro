/*
===========================================================================
settings.mjs - one loopback endpoint for the review server and its probes

Keep this separate from the server observatory (apps/server-observatory),
which serves on port 5190. SRO_UI_QA_PORT moves the server and every probe
together when 5191 is taken (another checkout's dev server); the server
keeps strictPort, so a taken port fails instead of drifting.
===========================================================================
*/

// DEFAULT_UI_QA_PORT is the review server's port unless SRO_UI_QA_PORT says.
const DEFAULT_UI_QA_PORT = 5191;

/*
================
uiQaPort

The port from SRO_UI_QA_PORT (an integer 1024-65535), else the default. In
a page there is no environment: the page reads its own origin instead
(UI_QA_ORIGIN).
================
*/
function uiQaPort() {
	const raw = globalThis.process?.env?.SRO_UI_QA_PORT;
	if ( raw === undefined || raw === "" ) return DEFAULT_UI_QA_PORT;
	// Digits only: Number() alone would admit "0x1450", " 5196" and "5196.0".
	const port = /^[0-9]+$/.test( raw ) ? Number( raw ) : NaN;
	if ( !Number.isInteger( port ) || port < 1024 || port > 65535 ) {
		throw Error( `SRO_UI_QA_PORT must be an integer port from 1024 to 65535, not ${JSON.stringify( raw )}` );
	}
	return port;
}

export const UI_QA_PORT = uiQaPort();
// A page served by the review server is its own origin, whatever port the
// server was started on; Node (the server and the probes) builds it.
export const UI_QA_ORIGIN = globalThis.location?.protocol === "http:" ?
	globalThis.location.origin :
	`http://127.0.0.1:${UI_QA_PORT}`;
export const UI_QA_CATALOG_PATH = "/__uiqa/catalog";
