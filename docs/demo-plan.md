# Monad Testnet Agent Vault Demo Plan

## Goal

Present a standalone GridPlus-powered dapp where a fresh EOA on Monad testnet becomes an agent wallet through EIP-7702. The backend stores markets and agent prompts in SQLite, fetches each market's context API, and runs agents that trade through the user's delegated EOA.

The demo removes x402 from the core path. The agent no longer buys data from a payment server. It reads market context from the API configured in SQLite and makes a bounded trading decision.

## Live Demo Flow

1. Open a GridPlus device session through the production signing provider.
2. Pair the dapp session with the device by pairing code.
3. Enable the vault by signing EIP-7702 authorization for a fresh Monad testnet EOA.
4. Show markets stored in SQLite, including each market's context API URL.
5. Show agents stored in SQLite, each with an owner address, market, prompt, budget, spent amount, interval, and status.
6. Run one selected backend agent:
   - `RegistryScanner` loads active agents from SQLite.
   - `ContextFetcher` calls the market context API.
   - `DecisionAgent` evaluates the context against the stored prompt.
   - `PolicyGuard` checks budget, interval, market, token, expiry, nonce, and revoke state.
   - `TradeExecutor` calls the delegated EOA to trade against the Augur or Augur-compatible market.
7. Show a successful testnet transaction when live execution is enabled.
8. Show blocked over-limit, wrong-market, or revoked execution before spend.
9. Revoke an agent.
10. Clear EIP-7702 delegation.

## Testnet Constants

- Network: `eip155:10143`
- Chain ID: `10143`
- Native token: `MON`
- Public RPC: `https://testnet-rpc.monad.xyz`
- Explorer: `https://testnet.monadscan.com`

Token, Augur, and market contract addresses must be configured only after verification on Monad testnet. If no verified Augur deployment is available, the demo should deploy and label a minimal Augur-compatible market adapter.

## SQLite Demo State

SQLite stores presentation and runner state:

- markets
- agents
- agent runs
- agent memory
- LLM traces
- context snapshots

The public demo can keep this as a local or single-instance database. On Render, the API needs a persistent disk if state should survive restarts.

## Device Presentation

The public demo labels the signer as a GridPlus device. A physical device and the hosted device at [simulator.gridplus.io](https://simulator.gridplus.io) both use the production GridPlus environment:

- Device signing relay: `https://signing.gridpl.us`
- Hosted simulator: `https://simulator.gridplus.io`
- Production simulator MQTT: `wss://mqtt.gridplus.io/ws`
- Simulator provisioning API: `https://api.gridplus.io/provision`

The hosted simulator connects to production MQTT. The Monad Agent Vault API talks to the production GridPlus signing relay, which forwards requests over the production MQTT path. The demo does not run a local simulator.

The dapp does not collect a GridPlus password. The API opens or resumes a provider-backed SDK session using demo config plus stored SDK client state. Pairing is completed with the pairing code shown by the device.

## Presentation UI

The first screen should show:

- Monad testnet status.
- GridPlus device status.
- Active EIP-7702 delegation status.
- Agent Registry table.
- Selected agent details.
- Market context payload.
- Last decision trace.
- Budget and spend state.
- Timeline of pair, delegate, run, trade, block, revoke, and cleanup actions.
