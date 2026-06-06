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

export const DEMO_MARKETS = [
	{
		marketId: 'ENG_USA_WIN',
		title: 'England to beat USA',
		question: 'Will England beat USA?',
		league: 'International Friendly',
		homeTeam: 'England',
		awayTeam: 'USA',
		kickoff: '2026-06-06T20:00:00Z',
	},
] as const

export const DEFAULT_MARKET_ID = DEMO_MARKETS[0].marketId

export const EVENT_INTELLIGENCE_SERVICE = {
	name: 'Premium Football Event Intelligence',
	resource: `https://demo.gridplus.local/signal/${DEFAULT_MARKET_ID}`,
	serviceHash: '0x4e5bc9609aa2102bb04c11c43fbeea92d8fae84c8efcff6c7d66ed9920907611',
	merchant: '0x2222222222222222222222222222222222222222',
	validPaymentAtomic: '5000',
	blockedPaymentAtomic: '250000',
} as const

export const DEMO_SERVICE = EVENT_INTELLIGENCE_SERVICE

export const DEMO_AGENT_VAULT_DELEGATE = '0x1111111111111111111111111111111111111111' as const
