/*
===========================================================================
vite.config.mjs - local-only review server, independent of game bootstrap

No game/API proxy, no release entry, and no writes to shared assets.
===========================================================================
*/
import fs from "node:fs";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { publishedAssets } from "../published-assets.mjs";
import { clientBuildDefinitions } from "../build-metadata.mjs";
import { UI_QA_PORT, UI_QA_CATALOG_PATH } from "./settings.mjs";
import { catalogInputs, readCatalog } from "./catalog.mjs";

/*
================
reviewServer
================
*/
function reviewServer() {
	return {
		name: "local-ui-review",
		configureServer( server ) {
			// The catalogue walks every source and asks git twice: build it once
			// and again only after an input changes, never per request. Sources
			// under this root reach the watcher. Inputs outside it (assets, the
			// define table, the font atlas, git state) are stamped by mtime on
			// each request: Vite's watcher ignores .git, so a commit or an index
			// change would otherwise keep an old fingerprint.
			const inputs = catalogInputs();
			const stamp = () =>
				inputs.map( input => {
					try {
						return fs.statSync( input ).mtimeMs;
					} catch {
						return 0;
					}
				} ).join( "," );
			let catalog = null, catalogStamp = "";
			server.watcher.add( inputs );
			server.watcher.on( "all", () => {
				catalog = null;
			} );
			server.middlewares.use( ( request, response, next ) => {
				response.setHeader(
					"Content-Security-Policy",
					`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:${UI_QA_PORT}; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'self'`
				);
				if ( request.url === "/" ) {
					response.writeHead( 302, { Location: "/tools/ui-qa/index.html" } );
					return response.end();
				}
				// The client's game routes: the Agent API and the shards' edge
				// routes (vite.config.mjs shardRoutes, "/shards/<id>").
				if ( request.url?.startsWith( "/api/" ) || request.url?.startsWith( "/shards/" ) ) {
					response.writeHead( 403 );
					return response.end( "No game connection in UI review" );
				}
				if ( request.url !== UI_QA_CATALOG_PATH ) return next();
				if ( request.method !== "GET" ) {
					response.writeHead( 405 );
					return response.end();
				}
				try {
					const current = stamp();
					if ( current !== catalogStamp ) catalog = null;
					catalogStamp = current;
					catalog ??= JSON.stringify( readCatalog() );
					response.writeHead( 200, { "Content-Type": "application/json", "Cache-Control": "no-store" } );
					response.end( catalog );
				} catch ( error ) {
					// The cause, with its machine paths, stays in the server log.
					server.config.logger.error( `UI QA catalogue failed: ${String( error )}` );
					response.statusCode = 500;
					response.end( JSON.stringify( { error: "UI QA catalogue unavailable" } ) );
				}
			} );
		}
	};
}

export default defineConfig( ( { command } ) => {
	if ( command !== "serve" ) throw Error( "UI review is a developer server, not a release build" );
	return {
		root: fileURLToPath( new URL( "../../", import.meta.url ) ),
		publicDir: false,
		define: clientBuildDefinitions(),
		server: { host: "127.0.0.1", port: UI_QA_PORT, strictPort: true },
		plugins: [ reviewServer(), publishedAssets() ],
		resolve: { alias: { "@": fileURLToPath( new URL( "../../src", import.meta.url ) ) } }
	};
} );
