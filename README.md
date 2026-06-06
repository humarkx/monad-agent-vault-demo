# AI Agentic Gambling

<p align="center">
  <img src="https://i.ibb.co/MyrpjJmy/ai-gambling.png" alt="AI Agentic Gambling dapp" width="800" />
</p>

> Autonomous AI agents that place bets — while a hardware wallet holds the keys and sets the limits.

**AI Agentic Gambling** is a GridPlus × Monad demo. You pair a GridPlus device, turn a fresh Monad testnet wallet into an "agent wallet" with EIP‑7702, and let AI agents trade World Cup 2026 prediction markets — but only inside spending limits your device signs.

The AI decides. Your device sets the rules and holds the keys.

## How it works

1. **Pair your device** — connect a GridPlus device (or the hosted simulator).
2. **Enable the vault** — sign an EIP‑7702 authorization so your testnet wallet can act as an agent wallet, then sign a mandate that caps how much can ever be spent.
3. **Prompt an agent** — create an agent with a plain‑English prompt (e.g. *"Buy when model edge is above 4% and confidence ≥ 65%; never spend more than 1 token per run"*), a market, and a budget. Agents live in a small on‑device‑owned registry.
4. **Run it** — a fixed pipeline executes: load the agent → fetch live market context → evaluate the prompt → check policy (budget, edge, interval, revoke) → trade through the delegated wallet.
5. **Stay in control** — over‑limit or revoked agents are blocked *before* any spend. Revoke an agent or clear the delegation at any time.

It all lives on one screen: markets, the agent registry, a create‑agent form, the selected agent's decision, and a timeline of every action.

## Why it matters — and what it could be

Handing an AI agent real money is scary. This demos a safer pattern: **the agent proposes, a hardware‑wallet‑signed mandate disposes.** The building blocks generalize well beyond football betting:

- Any prediction market or DeFi strategy driven by a prompt.
- Agent "employees" with a salary cap — budgets, rate limits, and instant revoke enforced by your device.
- A marketplace of prompts/strategies, each owned and bounded by a user's wallet.
- Paid data feeds (x402‑style) the agent buys before it decides.

The guardrails — device‑signed limits, per‑agent budgets, and EIP‑7702 delegation you can clear — are reusable for any *"let an agent spend, but only this much"* use case.

## Try it

```bash
pnpm install
pnpm dev
```

Open the dapp at http://localhost:5173 (the API runs at http://localhost:10000).

## Project layout

```text
apps/dapp        Vite + React dashboard (the UI)
apps/api         Hono API: GridPlus signing, agent registry, agent runner
contracts        Foundry contracts (EIP-7702 delegate, market adapter)
packages/shared  Shared schemas, constants, policy logic
docs             demo-plan.md — the source of truth
```

## Status & safety

- **Testnet demo** on Monad testnet (`eip155:10143`). Use a fresh, throwaway device/wallet — never production or high‑value keys.
- Agent runs are currently **dry‑runs**: the agent fetches context, evaluates its prompt, and records a decision plus a simulated spend, but no on‑chain trade is broadcast yet (the on‑chain trade step is wired to a market adapter that still needs deploying).
- Device signing uses the production GridPlus environment — pair a physical device or the hosted one at [simulator.gridplus.io](https://simulator.gridplus.io). The dapp never asks for a password; it connects by device ID and pairs by code.

## Develop & deploy

```bash
pnpm typecheck && pnpm test && pnpm build   # checks
forge test -vvv                              # Solidity tests (needs Foundry)
```

Deploy with `render.yaml`: it defines two Render services — `monad-agent-vault-api` (Hono API) and `monad-agent-vault-dapp` (static dapp). Create a Render Blueprint from the repo and both build from `main`.
