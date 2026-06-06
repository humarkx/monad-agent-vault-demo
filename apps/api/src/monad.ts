import { createPublicClient, createWalletClient, http, type Address, type Authorization, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { MONAD_MAINNET } from '@gridplus-monad-agent-vault/shared'
import { config } from './config'

export const monadMainnet = {
	id: MONAD_MAINNET.chainId,
	name: MONAD_MAINNET.name,
	nativeCurrency: MONAD_MAINNET.nativeToken,
	rpcUrls: {
		default: { http: [config.MONAD_RPC_URL ?? 'http://127.0.0.1:8545'] },
	},
	blockExplorers: {
		default: {
			name: 'Monadscan',
			url: MONAD_MAINNET.explorer.baseUrl,
		},
	},
} as const

export const rpcConfigured = Boolean(config.MONAD_RPC_URL)

export function getPublicClient() {
	if (!config.MONAD_RPC_URL) {
		throw new Error('MONAD_RPC_URL is required for live Monad RPC operations.')
	}
	return createPublicClient({
		chain: monadMainnet,
		transport: http(config.MONAD_RPC_URL),
	})
}

export function getSponsorWalletClient() {
	if (!config.MONAD_RPC_URL || !config.SPONSOR_PRIVATE_KEY) {
		throw new Error('MONAD_RPC_URL and SPONSOR_PRIVATE_KEY are required to submit EIP-7702 authorization transactions.')
	}
	const account = privateKeyToAccount(config.SPONSOR_PRIVATE_KEY as Hex)
	return createWalletClient({
		account,
		chain: monadMainnet,
		transport: http(config.MONAD_RPC_URL),
	})
}

export function getAgentWalletClient() {
	if (!config.MONAD_RPC_URL || !config.AGENT_PRIVATE_KEY) {
		throw new Error('MONAD_RPC_URL and AGENT_PRIVATE_KEY are required for live agent payments.')
	}
	const account = privateKeyToAccount(config.AGENT_PRIVATE_KEY as Hex)
	return createWalletClient({
		account,
		chain: monadMainnet,
		transport: http(config.MONAD_RPC_URL),
	})
}

export async function submitAuthorizationTransaction(owner: Address, authorization: Authorization): Promise<Hex> {
	const walletClient = getSponsorWalletClient()
	return walletClient.sendTransaction({
		to: owner,
		data: '0x',
		authorizationList: [authorization],
		gas: 90_000n,
	})
}

export async function getDelegatedCode(owner: Address): Promise<Hex> {
	return getPublicClient().getCode({ address: owner }).then((code) => code ?? '0x')
}

/**
 * Broadcasts a real on-chain transaction from the backend agent wallet, targeting the
 * AgentVaultDelegate (Augur-compatible market) contract.
 *
 * Demo only: when an agent is created we mock the "user" transaction by sending an actual
 * 0-value tx to the delegate contract, signed with the backend AGENT_PRIVATE_KEY. This proves
 * the end-to-end flow (a verifiable tx hash on Monad showing interaction with the market
 * contract) without ever using real user keys.
 */
export async function submitAgentCreationTransaction(agentId: string): Promise<Hex> {
	if (!config.AGENT_VAULT_DELEGATE_ADDRESS) {
		throw new Error('AGENT_VAULT_DELEGATE_ADDRESS is required to send the agent-creation transaction.')
	}
	const walletClient = getAgentWalletClient()
	const account = walletClient.account
	if (!account) {
		throw new Error('Agent wallet client is missing an account.')
	}
	return walletClient.sendTransaction({
		account,
		to: config.AGENT_VAULT_DELEGATE_ADDRESS as Address,
		value: 0n,
		// Tag the tx with the agent id so it is identifiable in the explorer.
		data: `0x${Buffer.from(`agent:${agentId}`, 'utf8').toString('hex')}` as Hex,
	})
}
