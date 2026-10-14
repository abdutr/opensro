/*
===========================================================================

ui-qa-imports.test.mjs - the UI review tools import in one direction

The review tools (tools/ui-qa) and the runtime tests share their recipes and
witnesses through tools/ui-qa/shared. Imports run one way: tests may use the
tools' shared modules, the tools never import from tests/, and the shipped
client (src/) imports neither. Imports are read with the compiler's own
pre-processor (static imports, re-exports and dynamic import() calls).

===========================================================================
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { root } from "../../tools/project.mjs";

const SOURCE = /\.(?:ts|mts|mjs)$/;

/*
================
files
================
*/
function files( directory ) {
	return readdirSync( path.join( root, directory ), { withFileTypes: true, recursive: true } )
		.filter( entry => entry.isFile() && SOURCE.test( entry.name ) )
		.map( entry => path.join( entry.parentPath, entry.name ) );
}

/*
================
importsOf

Each import of file, resolved to a repository path when it names a file
(relative, or the dev server's absolute /src/... and /tools/... form).
================
*/
function importsOf( file ) {
	const { importedFiles } = ts.preProcessFile( readFileSync( file, "utf8" ), true, true );
	return importedFiles.map( row => row.fileName ).map( name =>
		name.startsWith( "." ) ?
			path.relative( root, path.resolve( path.dirname( file ), name ) ).replaceAll( "\\", "/" ) :
			name.startsWith( "/" ) ?
			name.slice( 1 ) :
			name
	);
}

test("the review tools never import from tests/", () => {
	const offenders = files( "tools/ui-qa" ).flatMap( file =>
		importsOf( file ).filter( name => name.startsWith( "tests/" ) ).map( name =>
			`${path.relative( root, file )} -> ${name}`
		)
	);
	assert.deepEqual( offenders, [] );
});

test("the shipped client imports nothing from the review tools or tests", () => {
	const offenders = files( "src" ).flatMap( file =>
		importsOf( file ).filter( name => name.startsWith( "tools/" ) || name.startsWith( "tests/" ) ).map( name =>
			`${path.relative( root, file )} -> ${name}`
		)
	);
	assert.deepEqual( offenders, [] );
});

test("the runtime sweep takes its recipes from the tools' shared home", () => {
	const sweep = importsOf( path.join( root, "tests/runtime/ui-panel-sweep.test.mjs" ) );
	assert.ok( sweep.includes( "tools/ui-qa/shared/entry-recipes.mjs" ) );
	assert.ok( sweep.includes( "tools/ui-qa/shared/entry-evidence.mjs" ) );
});
