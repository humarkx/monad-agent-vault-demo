export const MONAD_MAINNET = {
	caip2: 'eip155:143',
	chainId: 143,
	chainHex: '0x8f',
	name: 'Monad',
	nativeToken: {
		name: 'Monad',
		symbol: 'MON',
		decimals: 18,
	},
	usdc: {
		address: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
		symbol: 'USDC',
		decimals: 6,
	},
	explorer: {
		baseUrl: 'https://monadscan.com',
		txUrl: (hash: string) => `https://monadscan.com/tx/${hash}`,
		addressUrl: (address: string) => `https://monadscan.com/address/${address}`,
	},
} as const

export const AGENT_VAULT_EIP712 = {
	name: 'GridPlus Monad Agent Vault',
	version: '1',
} as const

export const DEMO_SERVICE = {
	name: 'Premium Monad Research Feed',
	resource: 'https://demo.gridplus.local/service/research',
	serviceHash: '0x4e5bc9609aa2102bb04c11c43fbeea92d8fae84c8efcff6c7d66ed9920907611',
	merchant: '0x2222222222222222222222222222222222222222',
	validPaymentAtomic: '5000',
	blockedPaymentAtomic: '250000',
} as const
