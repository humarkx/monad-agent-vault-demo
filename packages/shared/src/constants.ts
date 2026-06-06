export const MONAD_TESTNET = {
	caip2: 'eip155:10143',
	chainId: 10143,
	chainHex: '0x279f',
	name: 'Monad Testnet',
	nativeToken: {
		name: 'Monad',
		symbol: 'MON',
		decimals: 18,
	},
	testCollateral: {
		address: '0x0000000000000000000000000000000000000000',
		symbol: 'MockUSDC',
		decimals: 6,
	},
	usdc: {
		address: '0x0000000000000000000000000000000000000000',
		symbol: 'MockUSDC',
		decimals: 6,
	},
	explorer: {
		baseUrl: 'https://testnet.monadscan.com',
		txUrl: (hash: string) => `https://testnet.monadscan.com/tx/${hash}`,
		addressUrl: (address: string) => `https://testnet.monadscan.com/address/${address}`,
	},
} as const

export const MONAD_NETWORK = MONAD_TESTNET

// Backwards-compatible alias while the demo code migrates away from the
// earlier mainnet-only prototype naming.
export const MONAD_MAINNET = MONAD_TESTNET

export const AGENT_VAULT_EIP712 = {
	name: 'GridPlus Monad Agent Vault',
	version: '1',
} as const

export const DEMO_MARKETS = [
	{
		marketId: 'ENG_USA_WIN',
		title: 'England to beat USA',
		question: 'Will England beat USA?',
		league: 'World Cup 2026',
		homeTeam: 'England',
		awayTeam: 'USA',
		kickoff: '2026-06-13T20:00:00Z',
	},
	{
		marketId: 'ARG_BRA_WIN',
		title: 'Argentina to beat Brazil',
		question: 'Will Argentina beat Brazil?',
		league: 'World Cup 2026',
		homeTeam: 'Argentina',
		awayTeam: 'Brazil',
		kickoff: '2026-06-14T23:00:00Z',
	},
	{
		marketId: 'FRA_GER_WIN',
		title: 'France to beat Germany',
		question: 'Will France beat Germany?',
		league: 'World Cup 2026',
		homeTeam: 'France',
		awayTeam: 'Germany',
		kickoff: '2026-06-15T19:00:00Z',
	},
	{
		marketId: 'ESP_NED_WIN',
		title: 'Spain to beat Netherlands',
		question: 'Will Spain beat Netherlands?',
		league: 'World Cup 2026',
		homeTeam: 'Spain',
		awayTeam: 'Netherlands',
		kickoff: '2026-06-16T17:00:00Z',
	},
	{
		marketId: 'MEX_CAN_WIN',
		title: 'Mexico to beat Canada',
		question: 'Will Mexico beat Canada?',
		league: 'World Cup 2026',
		homeTeam: 'Mexico',
		awayTeam: 'Canada',
		kickoff: '2026-06-12T02:00:00Z',
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

export const DEFAULT_CONTEXT_API_PATH = `/context/markets/${DEFAULT_MARKET_ID}` as const
