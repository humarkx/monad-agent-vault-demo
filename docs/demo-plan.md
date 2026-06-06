# Mainnet-Only Monad Agent Vault Demo Plan

## Goal

Present a standalone GridPlus-powered dapp where a fresh EOA on Monad mainnet becomes an agent vault through EIP-7702 and pays x402-style services only inside a GridPlus-signed mandate.

## Live Demo Flow

1. Open a GridPlus device session through the production signing provider.
2. Pair the dapp session with the device by pairing code.
3. Enable the vault by signing EIP-7702 authorization.
4. Sign an EIP-712 `AgentMandate`.
5. Run deterministic agents:
   - `ResearchAgent` requests paid data.
   - `PaymentAgent` handles the x402-style challenge.
   - `PolicyGuard` enforces the mandate.
   - `VerifierAgent` confirms the payment/result.
6. Show blocked over-limit spend.
7. Revoke the mandate.
8. Clear EIP-7702 delegation.

## Mainnet Constants

- Network: `eip155:143`
- Chain ID: `143`
- Chain hex: `0x8f`
- Native token: `MON`
- x402 USDC: `0x754704Bc059F8C67012fEd69BC8A327a5aafb603`

## Safety

Use tiny balances only. Monad charges based on gas limit, so the API sets explicit gas limits for demo calls. Delegated EOAs must stay above Monad's reserve-balance floor during live execution.

## Device Presentation

The public demo labels the signer as a GridPlus device. A physical device and the hosted device at [simulator.gridplus.io](https://simulator.gridplus.io) both use the production GridPlus environment:

- Device relay/API: `https://api.gridplus.io/api/v1/secure`
- Hosted simulator: `https://simulator.gridplus.io`
- Production simulator MQTT: `wss://mqtt.gridplus.io/ws`
- Simulator provisioning API: `https://api.gridplus.io/provision`

The hosted simulator connects to production MQTT. The Monad Agent Vault API talks to the production GridPlus Connect API secure relay, which forwards requests over the production MQTT path. The demo does not run a local simulator.

The dapp does not collect a GridPlus password. The API opens or resumes a provider-backed SDK session using hardcoded demo config plus stored SDK client state. Pairing is completed with the pairing code shown by the device.
