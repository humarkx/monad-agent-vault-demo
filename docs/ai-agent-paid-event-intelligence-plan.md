# AI Agent Paid Event Intelligence Demo Plan

## Goal

Build a focused v1 demo for paid machine-readable event intelligence. The demo shows autonomous agents buying signed football signals through an x402-style challenge while a GridPlus device-signed mandate enforces the payment policy.

This version does not deploy prediction market contracts, settle markets onchain, or place real bets. It prepares the API and UI shapes that the contract team can consume later.

## Product Story

The company sells signed event intelligence to autonomous agents.

The agent flow is:

1. `ScoutAgent` asks for the probability that England beats USA.
2. The API returns a `402 Payment Required` challenge.
3. `PaymentAgent` submits a mock USDC payment request.
4. `PolicyGuard` checks the GridPlus-signed mandate.
5. `SignalAgent` unlocks a signed football signal and optional AI summary.
6. `DecisionAgent` chooses `BUY_YES`, `BUY_NO`, `HOLD`, or `REDUCE`.
7. `ResultPoster` previews the future settlement payload.

## Implemented Scope

- Add shared schemas for markets, odds snapshots, signed attestations, signal reports, result-poster payloads, and used payment ids.
- Add demo market `ENG_USA_WIN`.
- Add API endpoints:
  - `GET /markets`
  - `GET /signal/:marketId`
  - `POST /signal/:marketId/unlock`
  - `GET /result/:marketId`
  - `POST /agent/run-event-demo`
- Keep the old demo aliases for compatibility.
- Use deterministic cached odds when no external data key is configured.
- Try API-Football live odds first when `API_FOOTBALL_KEY` is configured.
- Use NVIDIA `moonshotai/kimi-k2.6` when `NVIDIA_API_KEY` is configured.
- Fall back to deterministic summaries when NVIDIA is unavailable.
- Sign paid attestations with `DATA_PROVIDER_PRIVATE_KEY`.
- Track blocked, revoked, and replayed payment decisions.

## Environment

Render API service should set:

- `NVIDIA_API_KEY`
- `API_FOOTBALL_KEY`
- `DATA_PROVIDER_PRIVATE_KEY`

Local development can copy `.env.example` to `.env`. The API loads `.env` automatically for local runs.

## Demo Script

1. Open the dapp and pair the hosted GridPlus device.
2. Sign the mandate.
3. Click **Run paid signal**.
4. Show the 402 challenge, approved mock USDC payment, AI summary, signed attestation, and `BUY_YES` decision.
5. Click **Run red-card update**.
6. Show the updated probability drop and `REDUCE` decision.
7. Click **Run blocked agent**.
8. Show the policy block before any spend.
9. Click **Revoke mandate** and run the revoked path if needed.
10. Show the result-poster payload as contract integration pending.

## Future Contract Integration

The current paid signal is decision input, not settlement truth. The contract team can later map the existing payloads into:

- `placeBet(marketId, outcome, amount, paidDataAttestation)`
- `oracle.submitResult(matchId, outcome, finalScore, evidenceHash)`
- `PredictionMarket.resolve(marketId, outcome)`

## Validation Checklist

- Free/cached market path returns at least one market.
- `/signal/:marketId` returns a valid 402 challenge.
- Valid mock payment unlocks a signed signal.
- Over-limit payment is blocked.
- Revoked mandate blocks unlock.
- NVIDIA failure returns a fallback summary.
- Signature verification can recover the data provider address.
- UI shows market, probability, confidence, edge, signed blob, decision, and timeline.
