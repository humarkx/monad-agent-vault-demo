# AI Agent Paid Event Intelligence Demo Plan

## Goal

Build a legitimate Monad testnet demo where users register agent prompts and budgets, then a backend runner executes those agents against prediction-market contracts through each user's EIP-7702 delegated EOA.

The demo no longer depends on an x402 server. Each market stores a context API URL in the backend database. The runner fetches that context, passes it to the agent prompt, records the trace, and submits a constrained trade when the agent's policy allows it.

## Product Story

GridPlus turns a hardware-controlled EOA into a bounded agent wallet.

The user flow is:

1. The user pairs a GridPlus device or hosted production simulator.
2. The user delegates a fresh Monad testnet EOA to `AgentVaultDelegate` through EIP-7702.
3. The user registers an agent for one market with a prompt, max spend, interval, and trading policy.
4. The backend stores offchain agent details in SQLite and stores only commitments or enforcement data onchain.
5. The backend runner scans due agents, fetches each market's context API, and evaluates the prompt.
6. The runner calls the delegated EOA to trade against the configured Augur or Augur-compatible market contract.
7. The delegated EOA enforces spend caps, interval limits, nonces, expiry, token allowlists, market allowlists, and revocation.
8. The dapp shows the agent registry, context payload, model decision, trade attempt, transaction result, and remaining budget.

The crisp pitch:

Users register onchain prompts and test-collateral budgets. Backend agents scan a local registry, fetch market context APIs, and trade FOR/AGAINST shares through EIP-7702 delegated wallets, with max spend enforced onchain by a GridPlus-authorized account.

## Network

Use Monad testnet for the legitimate demo.

- Network: `eip155:10143`
- Chain ID: `10143`
- Native token: `MON`
- RPC: `https://testnet-rpc.monad.xyz`
- Explorer: `https://testnet.monadscan.com`

Do not hardcode unverified testnet token or Augur addresses. The implementation must use configured addresses after verifying that contract bytecode exists on Monad testnet.

## Scope Change

Remove x402 from the MVP presentation path.

The old paid-data flow treated the context API as a protected service. The new flow treats market context as regular input data for the backend agent. This keeps the demo focused on the GridPlus value proposition: signing the EIP-7702 delegation and enforcing agent spending through the delegated wallet.

## Backend State

Use SQLite for demo state. SQLite is acceptable for local development, a single Render API instance, and presentation demos. On Render, the API needs a persistent disk if we want state to survive deploys and restarts.

Tables:

- `markets`
  - `id`
  - `slug`
  - `title`
  - `question`
  - `market_address`
  - `amm_address`
  - `collateral_token_address`
  - `context_api_url`
  - `context_schema`
  - `status`
  - `created_at`
  - `updated_at`
- `agents`
  - `id`
  - `name`
  - `owner_address`
  - `delegated_eoa`
  - `market_id`
  - `prompt`
  - `prompt_hash`
  - `prompt_uri`
  - `budget_atomic`
  - `spent_atomic`
  - `max_trade_atomic`
  - `min_edge_bps`
  - `interval_seconds`
  - `next_run_at`
  - `status`
  - `revoked_at`
  - `created_at`
  - `updated_at`
- `agent_runs`
  - `id`
  - `agent_id`
  - `market_id`
  - `context_snapshot_json`
  - `llm_trace_json`
  - `decision`
  - `decision_reason`
  - `trade_side`
  - `trade_amount_atomic`
  - `tx_hash`
  - `status`
  - `error`
  - `created_at`
- `agent_memory`
  - `agent_id`
  - `memory_json`
  - `updated_at`

The demo can store plaintext prompts locally. The public story should still explain the production version as encrypted prompts plus onchain commitments. The UI should label this clearly as local demo storage.

## Onchain State

Keep sensitive or bulky data offchain. Store only enforcement and audit fields onchain.

Agent registration should include:

- `owner`
- `agentId`
- `promptHash`
- `promptUri`
- `market`
- `collateralToken`
- `maxTotalSpend`
- `maxPerTrade`
- `intervalSeconds`
- `nonce`
- `expiresAt`
- `active` or `revoked`

The delegated EOA must enforce:

- total cap
- per-trade cap
- interval
- expiry
- nonce replay protection
- market allowlist
- token allowlist
- explicit revoke

## Contracts

The target contract shape is:

- `AgentVaultDelegate`
  - EIP-7702 delegate implementation for the user EOA.
  - Validates signed mandates and per-agent policy.
  - Executes approved prediction-market trades.
  - Blocks over-limit, wrong-market, wrong-token, expired, replayed, and revoked actions.
- `AgentRegistry`
  - Stores public agent commitments and policy metadata.
  - Emits events for registration, update, run authorization, and revoke.
- `PredictionMarketAdapter`
  - Thin adapter around Augur or Augur-compatible contracts.
  - Keeps the backend isolated from contract-specific method names.

If verified Augur contracts are not available on Monad testnet, deploy a minimal Augur-compatible market adapter for the presentation and label it clearly as the demo market adapter.

## Context API Flow

Each market has one context API URL. The runner does not call an x402 facilitator or payment server.

Flow:

1. Load active agents from SQLite.
2. Skip agents that are revoked, expired, over budget, or not due.
3. Load the market row for each agent.
4. Fetch `market.context_api_url`.
5. Validate the response against the market's configured context schema.
6. Build an agent input object:
   - market metadata
   - current context API response
   - user prompt
   - budget state
   - last memory
   - latest onchain market price
7. Run the agent decision function.
8. Persist the context snapshot, trace, and decision in `agent_runs`.
9. If the decision is `BUY_FOR` or `BUY_AGAINST`, submit the trade through the user's delegated EOA.
10. Update spend, next-run time, memory, and timeline.

## Agent Registry UI

Add an `Agent Registry` section to the dapp.

Table columns:

- `Agent`
- `User`
- `Market`
- `Budget`
- `Spent`
- `Status`
- `Next run`
- `Last decision`

Seed rows:

| Agent | User | Market | Budget | Spent | Status |
| --- | --- | --- | --- | --- | --- |
| Aggressive | `0xabc...` | England vs USA | 10 MockUSDC | 2.04 MockUSDC | Active |
| Cautious | `0xdef...` | England vs USA | 10 MockUSDC | 0.31 MockUSDC | Active |
| Contrarian | `0x123...` | England vs USA | 10 MockUSDC | 4.82 MockUSDC | Active |

Clicking an agent should show:

- prompt
- prompt hash
- prompt URI
- owner address
- delegated EOA
- market address
- context API URL
- budget and spend
- interval and next run
- last context payload
- last model decision
- last trade transaction
- revoke state

Example detail copy:

Prompt:

```text
Buy FOR when model edge is greater than 3%. Hold when confidence is below 60%. Never spend more than 1 MockUSDC in one run.
```

Last run:

- Fetched context from the market API.
- Model FOR probability: 62%.
- AMM FOR price: 54%.
- Bought 1 MockUSDC of FOR shares through the delegated EOA.

## API Routes

Add new routes under the existing API service:

- `GET /markets`
- `GET /markets/:marketId`
- `POST /markets`
- `GET /markets/:marketId/context`
- `GET /agents`
- `GET /agents/:agentId`
- `POST /agents`
- `POST /agents/:agentId/run`
- `POST /agents/:agentId/revoke`
- `POST /runner/tick`
- `GET /runs`
- `GET /runs/:runId`

Keep old routes temporarily if the dapp still imports them, but the UI should move to the registry and context-runner routes.

## Demo Script

1. Open the dapp.
2. Show Monad testnet status and the GridPlus device session.
3. Pair the device or hosted simulator.
4. Enable EIP-7702 delegation for a fresh testnet EOA.
5. Show seeded markets stored in SQLite.
6. Open the Agent Registry and select `Aggressive`.
7. Show the prompt, market address, context API URL, budget, spent amount, and active status.
8. Click **Run selected agent**.
9. Show the fetched context payload.
10. Show the agent decision and reasoning.
11. Show the delegated EOA trade attempt and transaction hash when live execution is enabled.
12. Run `Cautious` to show a hold or smaller trade.
13. Run an over-budget or revoked agent to show that the delegated EOA blocks the action before spend.
14. Revoke an agent and show that future runs fail.
15. Clear EIP-7702 delegation at the end of the presentation.

## Implementation Phases

### Phase 1: Plan and Data Model

- Update docs to the testnet SQLite architecture.
- Add shared schemas for markets, agents, runs, context snapshots, and decisions.
- Add SQLite initialization and seed data.

### Phase 2: Backend Runner

- Add SQLite repository functions.
- Add market and agent API routes.
- Add a manual runner endpoint.
- Implement deterministic agent decisions without x402.
- Persist every run and decision trace.

### Phase 3: Dapp Presentation

- Replace paid-signal controls with an Agent Registry table.
- Add selected-agent detail view.
- Add context payload, decision, budget, and timeline panels.
- Keep GridPlus pairing and EIP-7702 delegation controls visible.

### Phase 4: Testnet Contracts

- Deploy or configure `AgentVaultDelegate`.
- Deploy or configure `AgentRegistry`.
- Configure verified Augur or Augur-compatible market addresses.
- Execute a tiny live trade from the delegated EOA.

### Phase 5: Presentation Hardening

- Add contract tests for spend caps, interval, expiry, revoke, wrong market, wrong token, and replay.
- Add API tests with mocked testnet RPC and seeded SQLite.
- Add dapp smoke tests for the registry and selected-agent flow.
- Add a Render persistent disk for SQLite.

## Test Plan

- SQLite initializes and seeds markets, agents, and runs.
- `GET /markets` returns SQLite market rows.
- `GET /agents` returns seeded agents with budget and status.
- `POST /agents/:agentId/run` fetches context, evaluates the prompt, stores a run, and returns a decision.
- Invalid context API responses fail closed and store an error run.
- Over-budget agents do not submit trades.
- Revoked agents do not submit trades.
- Expired or interval-locked agents do not submit trades.
- Wrong-market and wrong-token calls are rejected by the delegate contract.
- Dapp shows the agent registry, selected prompt, context payload, decision trace, budget, status, and transaction hash.

## Open Decisions

- Confirm the exact Augur or Augur-compatible contracts for Monad testnet.
- Confirm the testnet collateral token address, or deploy `MockUSDC`.
- Decide whether the first public demo submits live trades or uses a dry-run transaction preview until contracts are verified.
- Decide whether Render should use a persistent disk for SQLite or reset demo state on each deploy.
