import { createHash, randomBytes } from 'node:crypto'
import { createWalletClient, http, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
	applyPayment,
	DEFAULT_MARKET_ID,
	DEMO_MARKETS,
	DEMO_SERVICE,
	evaluatePayment,
	MONAD_MAINNET,
	paymentRequestSchema,
	type EventMarket,
	type FootballOddsReport,
	type FootballOddsSnapshot,
	type PaidSignalAttestation,
	type ResultPosterPayload,
	type RunEventIntelligenceRequest,
	type UnlockSignalRequest,
	type X402Challenge,
} from '@gridplus-monad-agent-vault/shared'
import { config } from './config'
import { monadMainnet } from './monad'
import { addEvent, getActiveMandate, getState, patchState, resetAgents, setAgentStatus } from './state'

type SignalRound = RunEventIntelligenceRequest['round']

type CachedSnapshot = Omit<FootballOddsSnapshot, 'marketId' | 'round' | 'source' | 'timestamp'>

const paymentId = (): Hex => `0x${randomBytes(32).toString('hex')}`
const simulatedTxHash = (): Hex => `0x${randomBytes(32).toString('hex')}`

const markets: EventMarket[] = DEMO_MARKETS.map((market) => ({ ...market }))

const cachedSnapshots: Record<string, Record<SignalRound, CachedSnapshot>> = {
	ENG_USA_WIN: {
		opening: {
			minute: 67,
			score: '1-1',
			matchState: 'Second half, even match state',
			modelProbabilityYes: 0.61,
			modelProbabilityNo: 0.39,
			marketImpliedProbabilityYes: 0.55,
			edgeBps: 600,
			confidence: 0.78,
		},
		update: {
			minute: 72,
			score: '1-1',
			matchState: 'England red card, USA pressure rising',
			modelProbabilityYes: 0.42,
			modelProbabilityNo: 0.58,
			marketImpliedProbabilityYes: 0.51,
			edgeBps: -900,
			confidence: 0.74,
		},
	},
}

type ApiFootballPayload = {
	results?: number
	response?: unknown[]
}

type NvidiaChatResponse = {
	choices?: Array<{
		message?: {
			content?: string
		}
	}>
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const parseApiFootballPayload = (value: unknown): ApiFootballPayload | null => {
	if (!isRecord(value)) {
		return null
	}
	return {
		results: typeof value.results === 'number' ? value.results : undefined,
		response: Array.isArray(value.response) ? value.response : undefined,
	}
}

const percent = (value: number): string => `${Math.round(value * 100)}%`

const edgePercent = (edgeBps: number): string => `${(edgeBps / 100).toFixed(1)}%`

const stableStringify = (value: unknown): string => {
	if (value === null || typeof value !== 'object') {
		return JSON.stringify(value)
	}
	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringify(item)).join(',')}]`
	}
	return `{${Object.keys(value)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
		.join(',')}}`
}

function getMarketOrThrow(marketId: string): EventMarket {
	const market = markets.find((candidate) => candidate.marketId === marketId)
	if (!market) {
		throw new Error(`Unknown demo market: ${marketId}`)
	}
	return market
}

export function getMarkets(): EventMarket[] {
	return markets
}

export function buildSignalChallenge(marketId: string = DEFAULT_MARKET_ID, amountAtomic: string = DEMO_SERVICE.validPaymentAtomic): X402Challenge {
	const market = getMarketOrThrow(marketId)
	return {
		status: 402,
		scheme: 'exact',
		network: MONAD_MAINNET.caip2,
		resource: `https://demo.gridplus.local/signal/${market.marketId}`,
		amountAtomic,
		token: MONAD_MAINNET.usdc.address,
		merchant: DEMO_SERVICE.merchant,
		serviceHash: DEMO_SERVICE.serviceHash,
		paymentId: paymentId(),
		description: `Pay mock Monad USDC to unlock signed event intelligence for ${market.title}.`,
	}
}

export function requestSignalChallenge(marketId: string = DEFAULT_MARKET_ID): X402Challenge {
	const challenge = buildSignalChallenge(marketId)
	patchState({ lastChallenge: challenge })
	addEvent({ actor: 'ScoutAgent', title: '402 challenge returned', detail: `${challenge.amountAtomic} atomic USDC required for ${challenge.resource}.`, status: 'info' })
	return challenge
}

async function fetchApiFootballSource(): Promise<string | null> {
	if (!config.API_FOOTBALL_KEY) {
		return null
	}

	const endpoints = ['/odds/live', '/odds']
	for (const endpoint of endpoints) {
		try {
			const response = await fetch(`https://v3.football.api-sports.io${endpoint}`, {
				headers: {
					'x-apisports-key': config.API_FOOTBALL_KEY,
				},
				signal: AbortSignal.timeout(2500),
			})
			if (!response.ok || response.status === 204) {
				continue
			}
			const payload = parseApiFootballPayload(await response.json())
			if ((payload?.results ?? 0) > 0 || (payload?.response?.length ?? 0) > 0) {
				return endpoint === '/odds/live' ? 'api-football-live-odds' : 'api-football-prematch-odds'
			}
		} catch {
			continue
		}
	}

	return null
}

async function getOddsSnapshot(marketId: string, round: SignalRound): Promise<FootballOddsSnapshot> {
	getMarketOrThrow(marketId)
	const snapshots = cachedSnapshots[marketId] ?? cachedSnapshots.ENG_USA_WIN
	const snapshot = snapshots[round] ?? snapshots.opening
	const source = (await fetchApiFootballSource()) ?? 'cached-demo-market'

	return {
		marketId,
		round,
		...snapshot,
		source,
		timestamp: Math.floor(Date.now() / 1000),
	}
}

function decide(snapshot: FootballOddsSnapshot): Pick<FootballOddsReport, 'agentDecision' | 'decisionReason'> {
	const edge = snapshot.modelProbabilityYes - snapshot.marketImpliedProbabilityYes
	if (edge >= 0.04) {
		return {
			agentDecision: 'BUY_YES',
			decisionReason: `Model probability is ${edgePercent(snapshot.edgeBps)} above the market implied price.`,
		}
	}
	if (edge <= -0.04 && snapshot.round === 'update') {
		return {
			agentDecision: 'REDUCE',
			decisionReason: `Updated signal moved ${edgePercent(Math.abs(snapshot.edgeBps))} against YES exposure.`,
		}
	}
	if (edge <= -0.04) {
		return {
			agentDecision: 'BUY_NO',
			decisionReason: `Model probability is ${edgePercent(Math.abs(snapshot.edgeBps))} below the market implied YES price.`,
		}
	}
	return {
		agentDecision: 'HOLD',
		decisionReason: 'Model and market are close enough that the agent avoids a new position.',
	}
}

function fallbackAiSummary(market: EventMarket, snapshot: FootballOddsSnapshot): string {
	return `${market.question} Model YES is ${percent(snapshot.modelProbabilityYes)} versus ${percent(snapshot.marketImpliedProbabilityYes)} market implied, with ${percent(snapshot.confidence)} confidence. Match state: ${snapshot.matchState}.`
}

async function summarizeWithNvidia(market: EventMarket, snapshot: FootballOddsSnapshot): Promise<string> {
	if (!config.NVIDIA_API_KEY) {
		return fallbackAiSummary(market, snapshot)
	}

	try {
		const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.NVIDIA_API_KEY}`,
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: 'moonshotai/kimi-k2.6',
				messages: [
					{
						role: 'system',
						content: 'You summarize paid football event intelligence for autonomous trading agents. Keep it one concise sentence and do not invent facts.',
					},
					{
						role: 'user',
						content: JSON.stringify({
							question: market.question,
							minute: snapshot.minute,
							score: snapshot.score,
							matchState: snapshot.matchState,
							modelProbabilityYes: snapshot.modelProbabilityYes,
							marketImpliedProbabilityYes: snapshot.marketImpliedProbabilityYes,
							edgeBps: snapshot.edgeBps,
							confidence: snapshot.confidence,
						}),
					},
				],
				max_tokens: 160,
				temperature: 0.2,
				top_p: 0.9,
				stream: false,
			}),
			signal: AbortSignal.timeout(8000),
		})
		if (!response.ok) {
			throw new Error(`NVIDIA returned HTTP ${response.status}`)
		}
		const parsed = (await response.json()) as NvidiaChatResponse
		const content = parsed.choices?.[0]?.message?.content?.trim()
		return content || fallbackAiSummary(market, snapshot)
	} catch {
		return fallbackAiSummary(market, snapshot)
	}
}

async function signAttestation(snapshot: FootballOddsSnapshot): Promise<PaidSignalAttestation> {
	const provider = privateKeyToAccount(config.DATA_PROVIDER_PRIVATE_KEY as Hex)
	const unsigned = {
		marketId: snapshot.marketId,
		type: 'LIVE_SIGNAL' as const,
		minute: snapshot.minute,
		score: snapshot.score,
		matchState: snapshot.matchState,
		probabilities: {
			YES: snapshot.modelProbabilityYes,
			NO: snapshot.modelProbabilityNo,
		},
		marketImpliedProbability: snapshot.marketImpliedProbabilityYes,
		edgeBps: snapshot.edgeBps,
		confidence: snapshot.confidence,
		timestamp: snapshot.timestamp,
		source: snapshot.source,
		provider: provider.address,
	}
	return {
		...unsigned,
		signature: await provider.signMessage({ message: stableStringify(unsigned) }),
	}
}

async function buildPaidSignalReport(marketId: string, round: SignalRound): Promise<FootballOddsReport> {
	const market = getMarketOrThrow(marketId)
	const snapshot = await getOddsSnapshot(marketId, round)
	const [aiSummary, attestation] = await Promise.all([summarizeWithNvidia(market, snapshot), signAttestation(snapshot)])
	const decision = decide(snapshot)
	return {
		market,
		snapshot,
		aiSummary,
		...decision,
		attestation,
	}
}

function buildPaymentRequestFromChallenge(challenge: X402Challenge) {
	return paymentRequestSchema.parse({
		amountAtomic: challenge.amountAtomic,
		merchant: challenge.merchant,
		paymentId: challenge.paymentId,
		serviceHash: challenge.serviceHash,
		token: challenge.token,
	})
}

function approveMockPayment(challenge: X402Challenge, txHash = simulatedTxHash()) {
	const state = getState()
	if (state.usedPaymentIds.includes(challenge.paymentId)) {
		const decision = { allowed: false, reason: 'Payment challenge was already used.', remainingAtomic: state.lastPolicyDecision?.remainingAtomic ?? '0' }
		patchState({ lastPolicyDecision: decision })
		return { decision, txHash: null }
	}

	const mandate = getActiveMandate()
	const request = buildPaymentRequestFromChallenge(challenge)
	const decision = evaluatePayment(mandate, request)
	patchState({ lastPolicyDecision: decision })
	if (!decision.allowed) {
		return { decision, txHash: null }
	}

	patchState({
		mandate: applyPayment(mandate, request),
		lastTxHash: txHash,
		usedPaymentIds: [...state.usedPaymentIds, challenge.paymentId],
	})
	return { decision, txHash }
}

export async function unlockPaidSignal(marketId: string, input: UnlockSignalRequest, round: SignalRound = 'opening') {
	const state = getState()
	const challenge = state.lastChallenge
	if (!challenge || challenge.paymentId !== input.paymentId) {
		throw new Error('No matching x402 challenge found for this payment id.')
	}

	setAgentStatus('PaymentAgent', 'running')
	setAgentStatus('PolicyGuard', 'running')
	const { decision, txHash } = approveMockPayment(challenge, input.txHash as Hex | undefined)
	if (!decision.allowed) {
		setAgentStatus('PaymentAgent', 'blocked')
		setAgentStatus('PolicyGuard', 'blocked')
		addEvent({ actor: 'PolicyGuard', title: 'Payment blocked', detail: decision.reason, status: 'error' })
		return { report: null, state: getState() }
	}

	setAgentStatus('PolicyGuard', 'approved')
	setAgentStatus('PaymentAgent', 'complete')
	addEvent({ actor: 'PaymentAgent', title: 'Mock USDC payment approved', detail: 'GridPlus mandate allowed the x402-style payment before signal unlock.', status: 'success', txHash: txHash ?? undefined })

	setAgentStatus('SignalAgent', 'running')
	const report = await buildPaidSignalReport(marketId, round)
	patchState({ lastSignalReport: report, lastServiceResult: report.aiSummary })
	setAgentStatus('SignalAgent', 'complete')
	addEvent({ actor: 'SignalAgent', title: 'Signed signal unlocked', detail: `${report.market.title}: ${percent(report.snapshot.modelProbabilityYes)} YES probability, ${edgePercent(report.snapshot.edgeBps)} edge.`, status: 'success' })

	setAgentStatus('DecisionAgent', 'running')
	setAgentStatus('DecisionAgent', 'complete')
	addEvent({ actor: 'DecisionAgent', title: `Decision: ${report.agentDecision}`, detail: report.decisionReason, status: report.agentDecision === 'BUY_YES' ? 'success' : 'warning' })

	return { report, state: getState() }
}

export function getResultPayload(marketId: string = DEFAULT_MARKET_ID): ResultPosterPayload {
	getMarketOrThrow(marketId)
	const matchEndedAt = '2026-06-06T21:52:00Z'
	const finalScore = 'England 1-2 USA'
	const evidenceHash = `0x${createHash('sha256').update(`${marketId}:NO:${finalScore}:${matchEndedAt}`).digest('hex')}` as Hex
	return {
		marketId,
		outcome: 'NO',
		finalScore,
		matchEndedAt,
		evidenceHash,
		contractIntegration: 'pending',
	}
}

export async function publishResultPreview(marketId: string = DEFAULT_MARKET_ID) {
	const resultPayload = getResultPayload(marketId)
	patchState({ lastResultPayload: resultPayload })
	setAgentStatus('ResultPoster', 'complete')
	addEvent({ actor: 'ResultPoster', title: 'Settlement payload prepared', detail: `${resultPayload.finalScore}; outcome ${resultPayload.outcome}. Contract integration pending.`, status: 'info' })
	return { result: resultPayload, state: getState() }
}

export async function runEventIntelligenceDemo(input: RunEventIntelligenceRequest) {
	resetAgents()
	patchState({ lastChallenge: null, lastPolicyDecision: null, lastServiceResult: null, lastTxHash: null, lastSignalReport: null, lastResultPayload: null })

	if (input.kind === 'revoked') {
		const current = getActiveMandate()
		patchState({ mandate: { ...current, revoked: true } })
		addEvent({ actor: 'Owner', title: 'Mandate revoked', detail: 'The GridPlus-signed agent mandate is now revoked.', status: 'warning' })
	}

	setAgentStatus('ScoutAgent', 'running')
	addEvent({ actor: 'ScoutAgent', title: 'Paid signal requested', detail: 'ScoutAgent asks: What is the probability England wins?', status: 'info' })

	const challenge = buildSignalChallenge(input.marketId, input.kind === 'blocked' ? DEMO_SERVICE.blockedPaymentAtomic : DEMO_SERVICE.validPaymentAtomic)
	patchState({ lastChallenge: challenge })
	addEvent({ actor: 'Merchant', title: '402 Payment Required', detail: `${challenge.amountAtomic} atomic USDC requested for signed football intelligence.`, status: 'info' })

	const unlocked = await unlockPaidSignal(input.marketId, { paymentId: challenge.paymentId }, input.round)
	if (!unlocked.report) {
		setAgentStatus('ScoutAgent', 'blocked')
		return getState()
	}

	setAgentStatus('ScoutAgent', 'complete')
	setAgentStatus('ResultPoster', 'running')
	await publishResultPreview(input.marketId)

	return getState()
}

export async function runAgentDemo(kind: 'valid' | 'blocked' | 'revoked') {
	return runEventIntelligenceDemo({ kind, marketId: DEFAULT_MARKET_ID, round: 'opening' })
}

export function createX402FetchClientDescription() {
	const client = createWalletClient({
		chain: monadMainnet,
		transport: http(config.MONAD_RPC_URL ?? 'http://127.0.0.1:8545'),
	})
	return {
		clientKind: 'viem wallet client',
		x402Mode: 'local x402-style exact payment challenge',
		chain: client.chain?.id ?? MONAD_MAINNET.chainId,
	}
}
