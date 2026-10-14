/*
===========================================================================

verify-ui-qa-types.mjs - the UI review tools type-check, with no debt

Runs the compiler over tools/ui-qa/tsconfig.json: the review workbench,
its frame, recipes and fixtures, and the Node probes and dev server, all of
them, TypeScript and JavaScript, against the client sources they drive.
Any error inside tools/ui-qa fails. There is no ledger: the tools came in
clean and stay clean.

The program loads Node's types for the probes, which changes a few browser
types in src/ (timer handles); src/ is judged by `pnpm typecheck`, so only
errors in tools/ui-qa count here, as tools/verify-test-types.mjs does for
tests/.

===========================================================================
*/
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientRoot = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), ".." );
const tsc = path.join( clientRoot, "node_modules", "typescript", "bin", "tsc" );
const TOOL_ERROR = /^(tools\/ui-qa\/[^(]+)\(\d+,\d+\): error TS\d+/;

/*
================
main
================
*/
function main() {
	const result = spawnSync( process.execPath, [ tsc, "--noEmit", "-p", "tools/ui-qa/tsconfig.json" ], {
		cwd: clientRoot,
		encoding: "utf8"
	} );
	if ( result.error ) throw result.error;
	const errors = result.stdout.split( /\r?\n/ ).filter( line => TOOL_ERROR.test( line.replaceAll( "\\", "/" ) ) );
	// An error tsc reports with no location (a bad config) fails as well.
	const unplaced = result.stdout.split( /\r?\n/ ).filter( line => /^error TS\d+/.test( line ) );
	for ( const line of [ ...errors, ...unplaced ] ) console.error( line );
	if ( errors.length || unplaced.length ) {
		console.error( `verify:ui-qa-types: ${errors.length + unplaced.length} error(s) in the UI review tools` );
		process.exit( 1 );
	}
	console.log( "verify:ui-qa-types: PASS" );
}

main();
