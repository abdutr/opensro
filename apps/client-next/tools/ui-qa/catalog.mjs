/*
===========================================================================
catalog.mjs - read-only resource reconciliation and review identity

Literal references are leads, never a claim that a resource is implemented.
Native and published trees remain under the existing path authorities.
===========================================================================
*/
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CLIENT_PUBLIC_ROOT } from "../../../../scripts/lib/generatedRoot.mjs";
import { clientV150ResinfoRoot, mediaExtractedRoot } from "../../../../scripts/build/world/paths.mjs";

const app = fileURLToPath( new URL( "../../", import.meta.url ) );
const checkout = path.resolve( app, "../.." );

/*
================
walk

Local on purpose: scripts/lib has no directory walker to share.
================
*/
function walk( directory, extensions ) {
	if ( !fs.existsSync( directory ) ) return [];
	return fs.readdirSync( directory, { withFileTypes: true } ).flatMap( row => {
		const full = path.join( directory, row.name );
		return row.isDirectory() ?
			walk( full, extensions ) :
			extensions.includes( path.extname( row.name ) ) ?
			[ full ] :
			[];
	} ).sort();
}

/*
================
hash
================
*/
function hash( value ) {
	return createHash( "sha256" ).update( value ).digest( "hex" );
}

/*
================
fileHash
================
*/
function fileHash( file ) {
	return fs.existsSync( file ) ? hash( fs.readFileSync( file ) ) : null;
}

/*
================
gitDirectories

A checkout's own git directory (a worktree's, named by its .git file) and
the common one that holds refs, resolved once per checkout.
================
*/
const gitDirectoryCache = new Map();
function gitDirectories( directory ) {
	let found = gitDirectoryCache.get( directory );
	if ( !found ) {
		const ask = flag =>
			path.resolve(
				directory,
				execFileSync( "git", [ "rev-parse", flag ], { cwd: directory, encoding: "utf8" } ).trim()
			);
		found = { own: ask( "--git-dir" ), common: ask( "--git-common-dir" ) };
		gitDirectoryCache.set( directory, found );
	}
	return found;
}

/*
================
readOrEmpty
================
*/
function readOrEmpty( file ) {
	try {
		return fs.readFileSync( file, "utf8" ).trim();
	} catch {
		return "";
	}
}

/*
================
modifiedAt
================
*/
function modifiedAt( file ) {
	try {
		return fs.statSync( file ).mtimeMs;
	} catch {
		return 0;
	}
}

/*
================
gitStamp

Changes whenever the checkout's codeSha can: what HEAD names now (read on
every call, so a branch switch is seen), the commit that ref points at (its
loose file, else the packed refs), and the index. No process is spawned
after the first call for a checkout. An unstaged edit outside the watched
root moves none of these, so the dirty flag is not cached behind this stamp:
the server reads checkoutDirty on every catalogue request.
================
*/
export function gitStamp( directory = checkout ) {
	const { own, common } = gitDirectories( directory );
	const head = readOrEmpty( path.join( own, "HEAD" ) );
	const ref = head.startsWith( "ref: " ) ? head.slice( 5 ) : "";
	const commit = ref ?
		readOrEmpty( path.join( common, ref ) ) || String( modifiedAt( path.join( common, "packed-refs" ) ) ) :
		head;
	return [ head, commit, modifiedAt( path.join( own, "index" ) ) ].join( "\n" );
}

/*
================
checkoutDirty

Whether the whole checkout has local changes, read now. A saved review or an
export records the state at that moment, not at the last catalogue build.
================
*/
export function checkoutDirty( directory = checkout ) {
	// --no-optional-locks: a plain status refreshes and rewrites the index,
	// which would move gitStamp and rebuild the catalogue on every request.
	return execFileSync( "git", [ "--no-optional-locks", "status", "--porcelain" ], {
		cwd: directory,
		encoding: "utf8"
	} )
		.trim() !== "";
}

/*
================
catalogInputs

The files and trees readCatalog reads outside the review server's watched
root (apps/client-next): the published layouts and native resinfo, the
define table and the font atlas. The git state is stamped by gitStamp. The
server watches these (recursively, so a file rewritten inside a tree is
seen) and stamps their mtimes per request as well; a directory's own mtime
moves only when an entry is created, removed or renamed.
================
*/
export function catalogInputs() {
	return [
		path.join( CLIENT_PUBLIC_ROOT, "assets/cif/layouts" ),
		clientV150ResinfoRoot,
		path.join( mediaExtractedRoot, "config/define.txt" ),
		path.join( CLIENT_PUBLIC_ROOT, "assets/fonts/native-ui-font-atlas.json" )
	];
}

/*
================
readCatalog

Recomputed on demand so a changed source or asset cannot retain an approval.
The font hash covers atlas metadata; image bytes are not certified by it.
================
*/
export function readCatalog() {
	const sources = [ ...walk( path.join( app, "src" ), [ ".ts", ".css" ] ), path.join( app, "index.html" ) ].map(
		file => ({
			file: path.relative( checkout, file ).replaceAll( "\\", "/" ),
			text: fs.readFileSync( file, "utf8" )
		})
	);
	const qa = [
		...walk( path.join( app, "tools/ui-qa" ), [ ".ts", ".mjs", ".html", ".css", ".json" ] ),
		...walk( path.join( app, "tests/helpers" ), [ ".mjs", ".mts" ] ).filter( file =>
			path.basename( file ).startsWith( "ui-entry-" )
		)
	];
	const layouts = path.join( CLIENT_PUBLIC_ROOT, "assets/cif/layouts" );
	const native = walk( clientV150ResinfoRoot, [ ".txt" ] );
	const published = walk( layouts, [ ".json" ] );
	const names = [ ...new Set( [ ...native, ...published ].map( file => path.parse( file ).name ) ) ].sort();
	const resources = names.map( name => {
		const source = native.find( file => path.parse( file ).name === name );
		const output = published.find( file => path.parse( file ).name === name );
		const layout = output ? JSON.parse( fs.readFileSync( output, "utf8" ) ) : null;
		const references = sources.filter( row => row.text.toLowerCase().includes( name.toLowerCase() ) ).map( row =>
			row.file
		);
		return {
			name,
			nativeHash: source ? fileHash( source ) : null,
			publishedHash: output ? fileHash( output ) : null,
			url: output ? `/assets/cif/layouts/${path.basename( output )}` : null,
			sections: (layout?.sections ?? []).map( section => ({
				name: section.name,
				nodes: (section.nodes ?? []).map( ( node, occurrence ) => ({
					id: node.id,
					name: node.name,
					type: node.type,
					rect: node.rect,
					occurrence
				}) )
			}) ),
			references
		};
	} );
	const codeSha = execFileSync( "git", [ "rev-parse", "HEAD" ], { cwd: checkout, encoding: "utf8" } ).trim();
	const sourceHash = hash(
		sources.map( row => row.file + "\0" + row.text ).join( "\0" ) +
			qa.map( file => path.relative( app, file ) + "\0" + fs.readFileSync( file, "utf8" ) ).join( "\0" )
	);
	const assetHash = hash( JSON.stringify( resources.map( row => [ row.name, row.nativeHash, row.publishedHash ] ) ) );
	const defineHash = fileHash( path.join( mediaExtractedRoot, "config/define.txt" ) );
	const fontHash = fileHash( path.join( CLIENT_PUBLIC_ROOT, "assets/fonts/native-ui-font-atlas.json" ) );
	const identity = { codeSha, sourceHash, assetHash, defineHash, fontHash };
	return {
		identity: { ...identity, fingerprint: hash( JSON.stringify( identity ) ), dirty: checkoutDirty() },
		// Repository-relative: the page never learns this machine's paths.
		roots: {
			checkout: ".",
			native: path.relative( checkout, clientV150ResinfoRoot ).replaceAll( "\\", "/" ),
			published: path.relative( checkout, layouts ).replaceAll( "\\", "/" )
		},
		limitations:
			"Literal references are triage only. Authored sections are not runtime windows. Font metadata hash does not certify every image byte.",
		resources
	};
}
