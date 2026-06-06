import { AGENT_VAULT_EIP712, MONAD_MAINNET } from './constants'
import type { AgentMandate } from './schemas'

export const agentMandateTypes = {
	AgentMandate: [
		{ name: 'owner', type: 'address' },
		{ name: 'agent', type: 'address' },
		{ name: 'delegate', type: 'address' },
		{ name: 'token', type: 'address' },
		{ name: 'merchant', type: 'address' },
		{ name: 'serviceHash', type: 'bytes32' },
		{ name: 'maxTotalAtomic', type: 'uint256' },
		{ name: 'maxPerPaymentAtomic', type: 'uint256' },
		{ name: 'expiresAt', type: 'uint256' },
		{ name: 'nonce', type: 'bytes32' },
	],
} as const

export function buildAgentMandateTypedData(mandate: AgentMandate) {
	return {
		types: {
			EIP712Domain: [
				{ name: 'name', type: 'string' },
				{ name: 'version', type: 'string' },
				{ name: 'chainId', type: 'uint256' },
				{ name: 'verifyingContract', type: 'address' },
			],
			...agentMandateTypes,
		},
		domain: {
			name: AGENT_VAULT_EIP712.name,
			version: AGENT_VAULT_EIP712.version,
			chainId: MONAD_MAINNET.chainId,
			verifyingContract: mandate.owner,
		},
		primaryType: 'AgentMandate',
		message: {
			owner: mandate.owner,
			agent: mandate.agent,
			delegate: mandate.delegate,
			token: mandate.token,
			merchant: mandate.merchant,
			serviceHash: mandate.serviceHash,
			maxTotalAtomic: BigInt(mandate.maxTotalAtomic),
			maxPerPaymentAtomic: BigInt(mandate.maxPerPaymentAtomic),
			expiresAt: BigInt(mandate.expiresAt),
			nonce: mandate.nonce,
		},
	} as const
}
