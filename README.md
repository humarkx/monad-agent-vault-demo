# GridPlus Monad Agent Vault Demo

Standalone public demo for a Monad mainnet-only GridPlus Agent Vault.

The demo shows a fresh GridPlus-controlled EOA delegating to an `AgentVaultDelegate` through EIP-7702, signing a spending mandate, and letting deterministic agents pay an x402-style service with tiny USDC payments on Monad mainnet.

## Structure

```text
apps/dapp        Vite React dashboard
apps/api         Hono API, GridPlus SDK, agent runner, x402-style service
contracts        Foundry contracts
packages/shared  Shared schemas, constants, and policy logic
docs             Demo plan and runbook
```

## Mainnet Safety

- Use a fresh demo EOA controlled by GridPlus.
- Keep tiny MON and USDC balances only.
- Do not use treasury, production, or personal high-value wallets.
- Demo network, RPC, GridPlus production endpoints, simulator device ID, and the GridPlus app secret are hardcoded for this local demo.
- Sponsor and agent private keys are intentionally unset until tiny funded demo-only keys are added.
- Clear EIP-7702 delegation after the demo.
- Device signing uses the production GridPlus signing environment by default. Use a physical device or the hosted device at [simulator.gridplus.io](https://simulator.gridplus.io) with the same dapp flow.
- The dapp does not ask for a GridPlus password. It connects by device ID, pairs by pairing code, and the API stores SDK client state plus an ignored app secret locally.
- Hosted simulator MQTT is production Web MQTT at `wss://mqtt.gridplus.io/ws`. The standalone demo API remains local/public-preview orchestration, while device requests go through the production GridPlus Connect API secure relay at `https://api.gridplus.io/api/v1/secure`.

## Quick Start

```bash
pnpm install
pnpm dev
```

Open the dapp at `http://localhost:5173`. The API defaults to `http://localhost:10000`.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

Foundry is required for Solidity tests:

```bash
forge test -vvv
```

## Render Deploy

This repo includes `render.yaml` with two services:

- `monad-agent-vault-api`: Node web service for the Hono API.
- `monad-agent-vault-dapp`: static Vite site that serves `apps/dapp/dist`.

After pushing to GitHub, open Render and create a new Blueprint from `https://github.com/humarkx/monad-agent-vault-demo`. Render will build both services from `main`. The dapp is hardcoded to call `https://monad-agent-vault-api.onrender.com` outside localhost.

The Render build commands intentionally use `corepack pnpm ...` instead of `corepack enable`. Render's Node images can expose global package-manager shims on a read-only filesystem, and `corepack enable` attempts to replace those shims.
