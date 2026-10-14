/*
===========================================================================
probe-support.mjs - request isolation and repository-root probe artifacts

The guard prevents external HTTP requests from pages, frames and workers in
the owned browser context. Its blocked list records attempts, not requests sent.
===========================================================================
*/
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UI_QA_ORIGIN } from "./settings.mjs";

export const UI_QA_REPOSITORY_ROOT = fileURLToPath( new URL( "../../../../", import.meta.url ) );

/*
================
reviewFrame

The workbench's game frame, loaded. Fails loudly instead of handing a probe
a null frame.
================
*/
/** @param {import("playwright-core").Page} page */
export async function reviewFrame( page ) {
	const viewport = page.locator( "#viewport-frame" );
	const frame = await (await viewport.elementHandle())?.contentFrame(), source = await viewport.getAttribute( "src" );
	if ( !frame || !source ) throw Error( "the review frame did not load" );
	await frame.waitForURL( new URL( source, page.url() ).href );
	return frame;
}

/*
================
artifactDirectory
================
*/
/** @param {string} [name] */
export function artifactDirectory( name = "" ) {
	const root = path.join( UI_QA_REPOSITORY_ROOT, "temp/artifacts/ui-qa" );
	const target = path.resolve( root, name );
	if ( target !== root && !target.startsWith( root + path.sep ) ) throw Error( "Artifact path leaves UI QA root" );
	return target;
}

/*
================
isLocalReviewRequest

Compare parsed origins: a prefix match could admit another port or host.
================
*/
/** @param {string} url */
export function isLocalReviewRequest( url ) {
	try {
		return new URL( url ).origin === UI_QA_ORIGIN;
	} catch {
		return false;
	}
}

/*
================
guardReviewRequests

Install before navigation. Routing disables the HTTP cache, so every probe
uses the same isolation policy and real workers still load local assets.
================
*/
/**
 * @typedef {{
 *   request(): { url(): string },
 *   continue(): Promise<unknown>,
 *   abort( errorCode?: string ): Promise<unknown>
 * }} GuardedRoute
 */
/**
 * @param {{ route( url: string, handler: ( route: GuardedRoute ) => unknown ): Promise<unknown> }} context
 *   A Playwright BrowserContext, or any context that routes the same way.
 * @param {string[]} blocked
 */
export async function guardReviewRequests( context, blocked ) {
	await context.route( "**/*", async route => {
		const url = route.request().url();
		if ( isLocalReviewRequest( url ) ) return route.continue();
		blocked.push( url );
		await route.abort( "blockedbyclient" );
	} );
}
