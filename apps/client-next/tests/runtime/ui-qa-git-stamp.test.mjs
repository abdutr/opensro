/*
===========================================================================

ui-qa-git-stamp.test.mjs - the review catalogue sees commits and branch switches

The review server keeps its catalogue until an input changes; its git state
is stamped per request (catalog.mjs gitStamp). The stamp must move on a
commit, on a branch switch and on a commit made on the new branch, and stay
still when nothing changed, or old review judgments would apply to new code.
An unstaged edit moves no stamp, so the dirty flag is read per request
(checkoutDirty) and must see it.

===========================================================================
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { root } from "../../tools/project.mjs";

const { checkoutDirty, gitStamp } = await import(
	pathToFileURL( path.join( root, "tools/ui-qa/catalog.mjs" ) ).href
);

/*
================
scratchRepository

A throwaway repository with one commit on main; its identity is local to it.
================
*/
function scratchRepository() {
	const directory = mkdtempSync( path.join( tmpdir(), "uiqa-git-stamp-" ) );
	const git = ( ...args ) =>
		execFileSync( "git", [ "-c", "user.name=stamp", "-c", "user.email=stamp@example.invalid", ...args ], {
			cwd: directory,
			stdio: "pipe"
		} );
	git( "init", "-q", "-b", "main" );
	writeFileSync( path.join( directory, "a.txt" ), "1" );
	git( "add", "a.txt" );
	git( "commit", "-q", "-m", "one" );
	return { directory, git };
}

test("the git stamp moves on a commit, a branch switch and a commit on the new branch", t => {
	const { directory, git } = scratchRepository();
	t.after( () => rmSync( directory, { recursive: true, force: true } ) );
	const first = gitStamp( directory );
	assert.equal( gitStamp( directory ), first, "an unchanged checkout keeps its stamp" );
	writeFileSync( path.join( directory, "a.txt" ), "2" );
	git( "commit", "-q", "-am", "two" );
	const committed = gitStamp( directory );
	assert.notEqual( committed, first, "a commit moves the stamp" );
	git( "checkout", "-q", "-b", "other" );
	const switched = gitStamp( directory );
	assert.notEqual( switched, committed, "a branch switch moves the stamp" );
	writeFileSync( path.join( directory, "a.txt" ), "3" );
	git( "commit", "-q", "-am", "three" );
	assert.notEqual( gitStamp( directory ), switched, "a commit on the new branch moves the stamp" );
});

test("the dirty flag sees an unstaged edit that the stamp does not", t => {
	const { directory } = scratchRepository();
	t.after( () => rmSync( directory, { recursive: true, force: true } ) );
	const clean = gitStamp( directory );
	assert.equal( checkoutDirty( directory ), false, "a fresh commit is clean" );
	writeFileSync( path.join( directory, "a.txt" ), "edited" );
	assert.equal( gitStamp( directory ), clean, "an unstaged edit keeps the stamp" );
	assert.equal( checkoutDirty( directory ), true, "the edit is dirty" );
});
