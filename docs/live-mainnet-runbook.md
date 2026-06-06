# Live Mainnet Runbook

## Preflight

1. Create a fresh GridPlus-controlled EOA.
2. Fund it with tiny MON and tiny Monad USDC only.
3. Confirm the hardcoded demo config in `apps/api/src/config.ts`.
4. Deploy `AgentVaultDelegate` and hardcode `AGENT_VAULT_DELEGATE_ADDRESS`.
5. Hardcode `SPONSOR_PRIVATE_KEY` only if the API should submit EIP-7702 authorization transactions with a tiny funded demo-only key.
6. Hardcode `AGENT_PRIVATE_KEY` only if the agent should submit live payment calls with a tiny funded demo-only key.
7. Confirm the hardcoded GridPlus app secret is a demo-only provider identity.
8. Confirm production GridPlus device environment:
   - `GRIDPLUS_BASE_URL=https://api.gridplus.io/api/v1/secure`
   - `GRIDPLUS_SIMULATOR_URL=https://simulator.gridplus.io`
   - `GRIDPLUS_SIMULATOR_MQTT_WS_URL=wss://mqtt.gridplus.io/ws`
   - `GRIDPLUS_SIMULATOR_PROVISION_URL=https://api.gridplus.io/provision`

## Demo

1. Start the API and dapp with `pnpm dev`.
2. Open the hosted device at [simulator.gridplus.io](https://simulator.gridplus.io) or use a physical GridPlus device. The hosted device should be connected to production MQTT at `wss://mqtt.gridplus.io/ws`.
3. Use the hardcoded simulator device ID or enter the current hosted-device ID in the dapp, then connect the provider session.
4. Enter the device pairing code and pair the dapp session.
5. Enable EIP-7702 vault.
6. Sign mandate.
7. Run valid agent.
8. Run blocked agent.
9. Revoke mandate.
10. Clear delegation.

## Cleanup

Always clear EIP-7702 delegation after the demo. Confirm `eth_getCode(owner)` no longer reports delegated code.

## Mainnet Notes

- Monad chain ID is `143`.
- Monad charges by gas limit, so keep gas limits explicit and tight.
- Delegated EOAs must respect Monad reserve-balance behavior.
- Do not reuse demo keys for anything valuable.
