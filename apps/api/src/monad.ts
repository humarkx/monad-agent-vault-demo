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
