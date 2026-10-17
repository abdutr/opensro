# Local testing loop

This is the day-to-day browser testing routine after the initial setup in
[GETTING_STARTED.md](GETTING_STARTED.md). It runs the OpenSRO browser client
and local Agent/GameWorld stack. The licensed `SRO_Client.exe` is an asset
input only; it does not connect to OpenSRO.

## What runs where

```text
licensed v1.150 client
        |
        +-- assets prepare/build --> .generated/client-public/assets
        |                         --> apps/server/.generated/game-data
        |
browser (Vite, :5180) -- /api ---------> Agent (:8787)
                       -- /shards/<id> -> GameWorld transport
```

Vite proxies `/api` to the Agent and `/shards/<id>` to the appropriate
GameWorld, so the browser always uses its own origin.

## First local build

From the checkout, verify the licensed-client path and build the data once. If
the doctor reports missing extracted inputs, run `corepack pnpm assets prepare`
before the build:

```powershell
corepack pnpm assets doctor
corepack pnpm assets build full
corepack pnpm task build server-game-data
corepack pnpm assets ledger
corepack pnpm assets check integrity
```

`assets build full` is required on a fresh machine because it builds the
outdoor world as well as the rest of the browser projection. The resulting
trees are ignored and must never be committed. See
[ASSET_PIPELINE.md](ASSET_PIPELINE.md) for the asset inputs and outputs.

## Start a local game

Open three terminals at the checkout root.

### Terminal A: start the local Nomad agent

```powershell
go -C apps/server run ./cmd/operations/sro-nomad dev-agent
```

Leave this terminal running. `dev-agent` starts or safely reuses the pinned,
loopback-only Nomad instance. Do not start `nomad agent -dev` or the Agent and
GameWorld binaries directly.

### Terminal B: provision and deploy

For a brand-new local world, provision the development identity, account and
enabled shard once:

```powershell
go -C apps/server run ./cmd/operations/sro-bootstrap-development
```

Then build and deploy the server roles:

```powershell
go -C apps/server run ./cmd/operations/sro-nomad deploy -build
go -C apps/server run ./cmd/operations/sro-nomad status
```

`status` should report a running `sro-agent` and
`sro-gameworld-global-official`. Confirm readiness before opening the client:

```powershell
Invoke-WebRequest http://127.0.0.1:8787/readyz
Invoke-WebRequest http://127.0.0.1:8788/transport/readyz
```

### Terminal C: start the browser client

```powershell
corepack pnpm dev
```

Open <http://127.0.0.1:5180/>. A freshly bootstrapped development world uses
the account `tester` with password `123123`; create a character on
`global-official` before entering the world.

## Rebuild after a change

| Change | Command and browser action |
| --- | --- |
| Client TypeScript/CSS/UI only | Keep `corepack pnpm dev` running. Refresh the browser if Vite does not apply the change itself. No asset build is needed. |
| Go server code | Run `go -C apps/server run ./cmd/operations/sro-nomad deploy -build` in Terminal B, then check `status` and the readiness URLs. |
| Licensed-client input or asset-pipeline code | Run `corepack pnpm assets build full` for a first/full outdoor build, or `corepack pnpm assets build` when a prior full outdoor build is current. Complete the asset-projection checks below, then redeploy the server and reload the browser. |
| Source validation before sharing work | Run `corepack pnpm check source`. Run `corepack pnpm check` when assets or the pipeline changed. |

The asset commands write generated output only. A source-only change does not
need an asset rebuild.

After an asset build, refresh the server projection and verify the published
tree:

```powershell
corepack pnpm task build server-game-data
corepack pnpm assets ledger
corepack pnpm assets check integrity
```

## Stop and reset safely

Stop the managed jobs before stopping the foreground Nomad process:

```powershell
go -C apps/server run ./cmd/operations/sro-nomad stop
```

Wait for it to finish, then press `Ctrl+C` in Terminal A. This gives the
GameWorld a chance to shut down its database cleanly.

To begin with a new local world, keep the old state as a backup rather than
deleting it. Follow
[Resetting the local world](GETTING_STARTED.md#6-resetting-the-local-world),
then run the provision and deploy commands again.

## Useful checks

```powershell
# Asset inputs and external tools
corepack pnpm assets doctor

# Local fleet state
go -C apps/server run ./cmd/operations/sro-nomad status

# Source-only CI-equivalent gate
corepack pnpm check source

# Browser tests, with the local server stack and Vite already running
corepack pnpm --filter @sro/client-next test:browser
```

For a second simultaneous local stack, port offsets and an isolated shard
catalogue are documented in [Nomad operations](../apps/server/ops/nomad/README.md#A-second-local-stack).
