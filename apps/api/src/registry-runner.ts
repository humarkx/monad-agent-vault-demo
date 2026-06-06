import { randomUUID } from 'node:crypto'
import {
	type AgentRun,
	agentRunSchema,
	type AgentTrace,
	marketContextSchema,
	type MarketContext,
	type RegisteredAgent,
	type RegistryMarket,
	type RunRegisteredAgentRequest,
} from '@gridplus-monad-agent-vault/shared'
import { config } from './config'
import { addEvent, getState, resetAgents, setAgentStatus } from './state'
import { getAgent, getMarket, insertRun, listAgents, updateAgentAfterRun } from './registry-db'

const atomicToDisplay = (value: string): string => {
	const raw = BigInt(value)
	const whole = raw / 1_000_000n
	const fraction = (raw % 1_000_000n).toString().padStart(6, '0')
	return `${whole}.${fraction} MockUSDC`
}

const percent = (value: number): string => `${Math.round(value * 100)}%`

const edgePercent = (edgeBps: number): string => `${edgeBps > 0 ? '+' : ''}${(edgeBps / 100).toFixed(1)}%`

const nextRunIso = (agent: RegisteredAgent): string => new Date(Date.now() + agent.intervalSeconds * 1000).toISOString()

const minBigInt = (left: bigint, right: bigint): bigint => (left < right ? left : right)

function contextForMarket(marketId: string): MarketContext {
	const modelProbabilityFor = 0.62
	const ammPriceFor = 0.54
	const edgeBps = Math.round((modelProbabilityFor - ammPriceFor) * 10_000)
	return marketContextSchema.parse({
		marketId,
		source: 'gridplus-demo-context-api',
		timestamp: Math.floor(Date.now() / 1000),
		minute: 67,
		score: 'England 1-1 USA',
		matchState: 'Second half, England pressure rising after two USA substitutions',
		headline: 'England chance quality is improving while the market still prices the match close to even.',
		modelProbabilityFor,
		modelProbabilityAgainst: 1 - modelProbabilityFor,
		ammPriceFor,
		ammPriceAgainst: 1 - ammPriceFor,
		edgeBps,
		confidence: 0.78,
		liquidityAtomic: '42000000',
		volumeAtomic: '12800000',
	})
}

export function getStoredMarketContext(marketId: string): MarketContext {
	const market = getMarket(marketId)
	if (!market) {
		throw new Error(`Unknown market ${marketId}.`)
	}
	return contextForMarket(market.marketId)
}

function resolveContextApiUrl(contextApiUrl: string): string {
	if (/^https?:\/\//.test(contextApiUrl)) {
		return contextApiUrl
	}
	return new URL(contextApiUrl, `http://127.0.0.1:${config.PORT}`).toString()
}

async function fetchMarketContext(market: RegistryMarket): Promise<MarketContext> {
	const response = await fetch(resolveContextApiUrl(market.contextApiUrl), {
		headers: {
			Accept: 'application/json',
		},
		signal: AbortSignal.timeout(3500),
	})
	if (!response.ok) {
		throw new Error(`Context API returned HTTP ${response.status}.`)
	}
	return marketContextSchema.parse(await response.json())
}

function chooseDecision(agent: RegisteredAgent, context: MarketContext): Pick<AgentRun, 'decision' | 'decisionReason' | 'tradeSide' | 'tradeAmountAtomic' | 'status'> {
	const remaining = BigInt(agent.budgetAtomic) - BigInt(agent.spentAtomic)
	if (remaining <= 0n) {
		return {
			decision: 'BLOCKED',
			decisionReason: 'Agent budget is exhausted before execution.',
			tradeSide: null,
			tradeAmountAtomic: '0',
			status: 'blocked',
		}
	}

	if (context.confidence < 0.6) {
		return {
			decision: 'HOLD',
			decisionReason: `Confidence is ${percent(context.confidence)}, below the prompt threshold.`,
			tradeSide: null,
			tradeAmountAtomic: '0',
			status: 'success',
		}
	}

	const tradeAmount = minBigInt(remaining, BigInt(agent.maxTradeAtomic)).toString()
	const isContrarian = agent.name.toLowerCase().includes('contrarian')

	if (Math.abs(context.edgeBps) < agent.minEdgeBps) {
		return {
			decision: 'HOLD',
			decisionReason: `Edge is ${edgePercent(context.edgeBps)}, below ${edgePercent(agent.minEdgeBps)} required by the prompt.`,
			tradeSide: null,
			tradeAmountAtomic: '0',
			status: 'success',
		}
	}

	if (context.edgeBps > 0) {
		return {
			decision: isContrarian ? 'BUY_AGAINST' : 'BUY_FOR',
			decisionReason: isContrarian ? `Contrarian prompt fades a ${edgePercent(context.edgeBps)} FOR edge.` : `Model FOR probability is ${edgePercent(context.edgeBps)} above AMM price.`,
			tradeSide: isContrarian ? 'AGAINST' : 'FOR',
			tradeAmountAtomic: tradeAmount,
			status: 'dry-run',
		}
	}

	return {
		decision: isContrarian ? 'BUY_FOR' : 'BUY_AGAINST',
		decisionReason: isContrarian ? `Contrarian prompt fades a ${edgePercent(Math.abs(context.edgeBps))} AGAINST edge.` : `Model FOR probability is ${edgePercent(Math.abs(context.edgeBps))} below AMM price.`,
		tradeSide: isContrarian ? 'FOR' : 'AGAINST',
		tradeAmountAtomic: tradeAmount,
		status: 'dry-run',
	}
}

function buildBlockedRun(agent: RegisteredAgent, marketId: string, reason: string): AgentRun {
	return agentRunSchema.parse({
		runId: randomUUID(),
		agentId: agent.agentId,
		marketId,
		contextSnapshot: null,
		llmTrace: null,
		decision: 'BLOCKED',
		decisionReason: reason,
		tradeSide: null,
		tradeAmountAtomic: '0',
		txHash: null,
		status: 'blocked',
		error: reason,
		createdAt: new Date().toISOString(),
	})
}

function buildErrorRun(agent: RegisteredAgent, marketId: string, error: unknown): AgentRun {
	const message = error instanceof Error ? error.message : String(error)
	return agentRunSchema.parse({
		runId: randomUUID(),
		agentId: agent.agentId,
		marketId,
		contextSnapshot: null,
		llmTrace: null,
		decision: 'BLOCKED',
		decisionReason: 'Context fetch or agent evaluation failed.',
		tradeSide: null,
		tradeAmountAtomic: '0',
		txHash: null,
		status: 'error',
		error: message,
		createdAt: new Date().toISOString(),
	})
}

function buildTrace(agent: RegisteredAgent, context: MarketContext, executionMode: AgentTrace['executionMode']): AgentTrace {
	const remaining = (BigInt(agent.budgetAtomic) - BigInt(agent.spentAtomic)).toString()
	return {
		prompt: agent.prompt,
		rulesTriggered: [
			`edge=${edgePercent(context.edgeBps)}`,
			`minEdge=${edgePercent(agent.minEdgeBps)}`,
			`confidence=${percent(context.confidence)}`,
			`maxTrade=${atomicToDisplay(agent.maxTradeAtomic)}`,
		],
		budgetRemainingAtomic: remaining,
		edgeBps: context.edgeBps,
		confidence: context.confidence,
		executionMode,
	}
}

export async function runRegisteredAgent(input: RunRegisteredAgentRequest): Promise<AgentRun> {
	const agent = getAgent(input.agentId)
	if (!agent) {
		throw new Error(`Unknown agent ${input.agentId}.`)
	}

	const market = getMarket(agent.marketId)
	if (!market) {
		throw new Error(`Unknown market ${agent.marketId}.`)
	}

	resetAgents()
	setAgentStatus('ScoutAgent', 'running')
	setAgentStatus('DecisionAgent', 'running')
	addEvent({ actor: 'RegistryScanner', title: `${agent.name} loaded`, detail: `${agent.name} is assigned to ${market.title}.`, status: 'info' })

	if (agent.status !== 'active') {
		const run = insertRun(buildBlockedRun(agent, market.marketId, `Agent is ${agent.status}.`))
		setAgentStatus('DecisionAgent', 'blocked')
		addEvent({ actor: 'PolicyGuard', title: 'Agent blocked', detail: run.decisionReason, status: 'error' })
		return run
	}

	if (new Date(agent.nextRunAt).getTime() > Date.now()) {
		const run = insertRun(buildBlockedRun(agent, market.marketId, `Agent interval has not elapsed. Next run is ${agent.nextRunAt}.`))
		setAgentStatus('DecisionAgent', 'blocked')
		addEvent({ actor: 'PolicyGuard', title: 'Interval blocked', detail: run.decisionReason, status: 'warning' })
		return run
	}

	try {
		setAgentStatus('SignalAgent', 'running')
		addEvent({ actor: 'ContextFetcher', title: 'Context API queried', detail: market.contextApiUrl, status: 'info' })
		const context = await fetchMarketContext(market)
		setAgentStatus('SignalAgent', 'complete')

		const decision = chooseDecision(agent, context)
		const executionMode: AgentTrace['executionMode'] = input.mode === 'live' && market.marketAddress && market.ammAddress && market.collateralTokenAddress && getState().vault.delegated ? 'live' : 'dry-run'
		const trace = buildTrace(agent, context, executionMode)
		const run = agentRunSchema.parse({
			runId: randomUUID(),
			agentId: agent.agentId,
			marketId: market.marketId,
			contextSnapshot: context,
			llmTrace: trace,
			decision: decision.decision,
			decisionReason: executionMode === 'live' ? decision.decisionReason : `${decision.decisionReason} Trade execution is recorded as a dry-run until testnet contracts are configured.`,
			tradeSide: decision.tradeSide,
			tradeAmountAtomic: decision.tradeAmountAtomic,
			txHash: null,
			status: decision.status,
			error: null,
			createdAt: new Date().toISOString(),
		})
		insertRun(run)

		if (run.status === 'success' || run.status === 'dry-run') {
			updateAgentAfterRun(agent.agentId, run.tradeAmountAtomic, nextRunIso(agent))
		}

		setAgentStatus('DecisionAgent', run.status === 'blocked' ? 'blocked' : 'complete')
		setAgentStatus('PolicyGuard', run.status === 'blocked' ? 'blocked' : 'approved')
		addEvent({
			actor: 'DecisionAgent',
			title: `${agent.name}: ${run.decision}`,
			detail: run.tradeSide ? `${run.decisionReason} Amount: ${atomicToDisplay(run.tradeAmountAtomic)}.` : run.decisionReason,
			status: run.status === 'blocked' ? 'error' : run.status === 'dry-run' ? 'warning' : 'success',
			txHash: run.txHash ?? undefined,
		})
		return run
	} catch (error) {
		const run = insertRun(buildErrorRun(agent, market.marketId, error))
		setAgentStatus('DecisionAgent', 'error')
		addEvent({ actor: 'DecisionAgent', title: 'Agent run failed', detail: run.error ?? 'Unknown error', status: 'error' })
		return run
	}
}

export async function runDueAgents(mode: RunRegisteredAgentRequest['mode'] = 'dry-run'): Promise<AgentRun[]> {
	const due = listAgents().filter((agent) => agent.status === 'active' && new Date(agent.nextRunAt).getTime() <= Date.now())
	const runs: AgentRun[] = []
	for (const agent of due) {
		runs.push(await runRegisteredAgent({ agentId: agent.agentId, mode }))
	}
	return runs
}
