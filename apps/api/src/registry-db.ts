import { createHash } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
	DEFAULT_CONTEXT_API_PATH,
	DEFAULT_MARKET_ID,
	type AgentRun,
	agentRunSchema,
	type CreateAgentRequest,
	type CreateMarketRequest,
	type MarketContext,
	type RegisteredAgent,
	registeredAgentSchema,
	type RegistryMarket,
	registryMarketSchema,
	type AgentTrace,
} from '@gridplus-monad-agent-vault/shared'
import { config } from './config'

type Row = Record<string, unknown>

const DEMO_OWNER_ADDRESSES = {
	aggressive: '0xAbC0000000000000000000000000000000000001',
	cautious: '0xDeF0000000000000000000000000000000000002',
	contrarian: '0x1230000000000000000000000000000000000003',
} as const

const nowIso = () => new Date().toISOString()

const promptHash = (prompt: string) => `0x${createHash('sha256').update(prompt).digest('hex')}`

const text = (row: Row, key: string): string => {
	const value = row[key]
	if (typeof value !== 'string') {
		throw new Error(`SQLite row field ${key} is not text.`)
	}
	return value
}

const nullableText = (row: Row, key: string): string | null => {
	const value = row[key]
	if (value === null || value === undefined) {
		return null
	}
	if (typeof value !== 'string') {
		throw new Error(`SQLite row field ${key} is not nullable text.`)
	}
	return value
}

const integer = (row: Row, key: string): number => {
	const value = row[key]
	if (typeof value !== 'number') {
		throw new Error(`SQLite row field ${key} is not numeric.`)
	}
	return value
}

const parseJson = <T>(value: string | null, fallback: T): T => {
	if (!value) {
		return fallback
	}
	return JSON.parse(value) as T
}

const dbDirectory = dirname(config.SQLITE_DB_FILE)
if (!existsSync(dbDirectory)) {
	mkdirSync(dbDirectory, { recursive: true })
}

const db = new DatabaseSync(config.SQLITE_DB_FILE)
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

db.exec(`
CREATE TABLE IF NOT EXISTS markets (
	market_id TEXT PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE,
	title TEXT NOT NULL,
	question TEXT NOT NULL,
	league TEXT NOT NULL,
	home_team TEXT NOT NULL,
	away_team TEXT NOT NULL,
	kickoff TEXT NOT NULL,
	market_address TEXT,
	amm_address TEXT,
	collateral_token_address TEXT,
	context_api_url TEXT NOT NULL,
	context_schema TEXT NOT NULL,
	status TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
	agent_id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	owner_address TEXT NOT NULL,
	delegated_eoa TEXT NOT NULL,
	market_id TEXT NOT NULL REFERENCES markets(market_id),
	prompt TEXT NOT NULL,
	prompt_hash TEXT NOT NULL,
	prompt_uri TEXT NOT NULL,
	budget_atomic TEXT NOT NULL,
	spent_atomic TEXT NOT NULL,
	max_trade_atomic TEXT NOT NULL,
	min_edge_bps INTEGER NOT NULL,
	interval_seconds INTEGER NOT NULL,
	next_run_at TEXT NOT NULL,
	status TEXT NOT NULL,
	revoked_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_runs (
	run_id TEXT PRIMARY KEY,
	agent_id TEXT NOT NULL REFERENCES agents(agent_id),
	market_id TEXT NOT NULL REFERENCES markets(market_id),
	context_snapshot_json TEXT,
	llm_trace_json TEXT,
	decision TEXT NOT NULL,
	decision_reason TEXT NOT NULL,
	trade_side TEXT,
	trade_amount_atomic TEXT NOT NULL,
	tx_hash TEXT,
	status TEXT NOT NULL,
	error TEXT,
	created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_memory (
	agent_id TEXT PRIMARY KEY REFERENCES agents(agent_id),
	memory_json TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
`)

function rowToMarket(row: Row): RegistryMarket {
	return registryMarketSchema.parse({
		marketId: text(row, 'market_id'),
		slug: text(row, 'slug'),
		title: text(row, 'title'),
		question: text(row, 'question'),
		league: text(row, 'league'),
		homeTeam: text(row, 'home_team'),
		awayTeam: text(row, 'away_team'),
		kickoff: text(row, 'kickoff'),
		marketAddress: nullableText(row, 'market_address'),
		ammAddress: nullableText(row, 'amm_address'),
		collateralTokenAddress: nullableText(row, 'collateral_token_address'),
		contextApiUrl: text(row, 'context_api_url'),
		contextSchema: text(row, 'context_schema'),
		status: text(row, 'status'),
		createdAt: text(row, 'created_at'),
		updatedAt: text(row, 'updated_at'),
	})
}

function rowToAgent(row: Row): RegisteredAgent {
	const latestRun = getLatestRunForAgent(text(row, 'agent_id'))
	return registeredAgentSchema.parse({
		agentId: text(row, 'agent_id'),
		name: text(row, 'name'),
		ownerAddress: text(row, 'owner_address'),
		delegatedEoa: text(row, 'delegated_eoa'),
		marketId: text(row, 'market_id'),
		prompt: text(row, 'prompt'),
		promptHash: text(row, 'prompt_hash'),
		promptUri: text(row, 'prompt_uri'),
		budgetAtomic: text(row, 'budget_atomic'),
		spentAtomic: text(row, 'spent_atomic'),
		maxTradeAtomic: text(row, 'max_trade_atomic'),
		minEdgeBps: integer(row, 'min_edge_bps'),
		intervalSeconds: integer(row, 'interval_seconds'),
		nextRunAt: text(row, 'next_run_at'),
		status: text(row, 'status'),
		revokedAt: nullableText(row, 'revoked_at'),
		createdAt: text(row, 'created_at'),
		updatedAt: text(row, 'updated_at'),
		lastDecision: latestRun?.decision ?? null,
		lastRunAt: latestRun?.createdAt ?? null,
	})
}

function rowToRun(row: Row): AgentRun {
	const contextSnapshot = parseJson<MarketContext | null>(nullableText(row, 'context_snapshot_json'), null)
	const llmTrace = parseJson<AgentTrace | null>(nullableText(row, 'llm_trace_json'), null)
	return agentRunSchema.parse({
		runId: text(row, 'run_id'),
		agentId: text(row, 'agent_id'),
		marketId: text(row, 'market_id'),
		contextSnapshot,
		llmTrace,
		decision: text(row, 'decision'),
		decisionReason: text(row, 'decision_reason'),
		tradeSide: nullableText(row, 'trade_side'),
		tradeAmountAtomic: text(row, 'trade_amount_atomic'),
		txHash: nullableText(row, 'tx_hash'),
		status: text(row, 'status'),
		error: nullableText(row, 'error'),
		createdAt: text(row, 'created_at'),
	})
}

const insertMarketStatement = db.prepare(`
INSERT OR IGNORE INTO markets (
	market_id, slug, title, question, league, home_team, away_team, kickoff,
	market_address, amm_address, collateral_token_address, context_api_url,
	context_schema, status, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const insertAgentStatement = db.prepare(`
INSERT OR IGNORE INTO agents (
	agent_id, name, owner_address, delegated_eoa, market_id, prompt, prompt_hash,
	prompt_uri, budget_atomic, spent_atomic, max_trade_atomic, min_edge_bps,
	interval_seconds, next_run_at, status, revoked_at, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

function seedDatabase(): void {
	const createdAt = nowIso()
	insertMarketStatement.run(
		DEFAULT_MARKET_ID,
		'england-usa',
		'England vs USA',
		'Will England beat USA?',
		'International Friendly',
		'England',
		'USA',
		'2026-06-06T20:00:00Z',
		null,
		null,
		null,
		DEFAULT_CONTEXT_API_PATH,
		'football-match-context-v1',
		'open',
		createdAt,
		createdAt,
	)

	const agents = [
		{
			agentId: 'agent-aggressive',
			name: 'Aggressive',
			owner: DEMO_OWNER_ADDRESSES.aggressive,
			prompt: 'Buy FOR when model edge is greater than 3%. Hold only when confidence is below 60%. Never spend more than 1 MockUSDC in one run.',
			budgetAtomic: '10000000',
			spentAtomic: '2040000',
			maxTradeAtomic: '1000000',
			minEdgeBps: 300,
			intervalSeconds: 60,
		},
		{
			agentId: 'agent-cautious',
			name: 'Cautious',
			owner: DEMO_OWNER_ADDRESSES.cautious,
			prompt: 'Trade only when model edge is greater than 7% and confidence is at least 70%. Prefer smaller FOR positions.',
			budgetAtomic: '10000000',
			spentAtomic: '310000',
			maxTradeAtomic: '500000',
			minEdgeBps: 700,
			intervalSeconds: 120,
		},
		{
			agentId: 'agent-contrarian',
			name: 'Contrarian',
			owner: DEMO_OWNER_ADDRESSES.contrarian,
			prompt: 'Fade crowded moves. Buy AGAINST when the model edge is positive but market momentum is too one-sided. Cap each run at 0.75 MockUSDC.',
			budgetAtomic: '10000000',
			spentAtomic: '4820000',
			maxTradeAtomic: '750000',
			minEdgeBps: 400,
			intervalSeconds: 90,
		},
	]

	for (const agent of agents) {
		const hash = promptHash(agent.prompt)
		insertAgentStatement.run(
			agent.agentId,
			agent.name,
			agent.owner,
			agent.owner,
			DEFAULT_MARKET_ID,
			agent.prompt,
			hash,
			`sqlite://agents/${agent.agentId}/prompt/${hash.slice(2, 10)}`,
			agent.budgetAtomic,
			agent.spentAtomic,
			agent.maxTradeAtomic,
			agent.minEdgeBps,
			agent.intervalSeconds,
			createdAt,
			'active',
			null,
			createdAt,
			createdAt,
		)
	}
}

seedDatabase()

export function listMarkets(): RegistryMarket[] {
	return db.prepare('SELECT * FROM markets ORDER BY created_at ASC').all().map((row) => rowToMarket(row as Row))
}

export function getMarket(marketId: string): RegistryMarket | null {
	const row = db.prepare('SELECT * FROM markets WHERE market_id = ?').get(marketId)
	return row ? rowToMarket(row as Row) : null
}

export function createMarket(input: CreateMarketRequest): RegistryMarket {
	const createdAt = nowIso()
	insertMarketStatement.run(
		input.marketId,
		input.slug,
		input.title,
		input.question,
		input.league,
		input.homeTeam,
		input.awayTeam,
		input.kickoff,
		input.marketAddress ?? null,
		input.ammAddress ?? null,
		input.collateralTokenAddress ?? null,
		input.contextApiUrl,
		input.contextSchema ?? 'market-context-v1',
		input.status ?? 'draft',
		createdAt,
		createdAt,
	)
	const market = getMarket(input.marketId)
	if (!market) {
		throw new Error(`Failed to create market ${input.marketId}.`)
	}
	return market
}

export function listAgents(): RegisteredAgent[] {
	return db.prepare('SELECT * FROM agents ORDER BY created_at ASC').all().map((row) => rowToAgent(row as Row))
}

export function getAgent(agentId: string): RegisteredAgent | null {
	const row = db.prepare('SELECT * FROM agents WHERE agent_id = ?').get(agentId)
	return row ? rowToAgent(row as Row) : null
}

export function createAgent(input: CreateAgentRequest): RegisteredAgent {
	const createdAt = nowIso()
	const hash = promptHash(input.prompt)
	insertAgentStatement.run(
		input.agentId,
		input.name,
		input.ownerAddress,
		input.delegatedEoa,
		input.marketId,
		input.prompt,
		hash,
		input.promptUri ?? `sqlite://agents/${input.agentId}/prompt/${hash.slice(2, 10)}`,
		input.budgetAtomic,
		'0',
		input.maxTradeAtomic,
		input.minEdgeBps,
		input.intervalSeconds,
		input.nextRunAt ?? createdAt,
		input.status ?? 'active',
		null,
		createdAt,
		createdAt,
	)
	const agent = getAgent(input.agentId)
	if (!agent) {
		throw new Error(`Failed to create agent ${input.agentId}.`)
	}
	return agent
}

export function listRuns(limit = 20): AgentRun[] {
	return db.prepare('SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT ?').all(limit).map((row) => rowToRun(row as Row))
}

export function listRunsForAgent(agentId: string, limit = 10): AgentRun[] {
	return db.prepare('SELECT * FROM agent_runs WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?').all(agentId, limit).map((row) => rowToRun(row as Row))
}

export function getLatestRun(): AgentRun | null {
	const row = db.prepare('SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT 1').get()
	return row ? rowToRun(row as Row) : null
}

export function getLatestRunForAgent(agentId: string): AgentRun | null {
	const row = db.prepare('SELECT * FROM agent_runs WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1').get(agentId)
	return row ? rowToRun(row as Row) : null
}

export function insertRun(run: AgentRun): AgentRun {
	db.prepare(`
		INSERT INTO agent_runs (
			run_id, agent_id, market_id, context_snapshot_json, llm_trace_json,
			decision, decision_reason, trade_side, trade_amount_atomic, tx_hash,
			status, error, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`).run(
		run.runId,
		run.agentId,
		run.marketId,
		run.contextSnapshot ? JSON.stringify(run.contextSnapshot) : null,
		run.llmTrace ? JSON.stringify(run.llmTrace) : null,
		run.decision,
		run.decisionReason,
		run.tradeSide,
		run.tradeAmountAtomic,
		run.txHash,
		run.status,
		run.error,
		run.createdAt,
	)
	return run
}

export function updateAgentAfterRun(agentId: string, spentDeltaAtomic: string, nextRunAt: string): RegisteredAgent {
	const current = getAgent(agentId)
	if (!current) {
		throw new Error(`Unknown agent ${agentId}.`)
	}
	const nextSpent = (BigInt(current.spentAtomic) + BigInt(spentDeltaAtomic)).toString()
	const updatedAt = nowIso()
	db.prepare('UPDATE agents SET spent_atomic = ?, next_run_at = ?, updated_at = ? WHERE agent_id = ?').run(nextSpent, nextRunAt, updatedAt, agentId)
	const updated = getAgent(agentId)
	if (!updated) {
		throw new Error(`Failed to update agent ${agentId}.`)
	}
	return updated
}

export function revokeAgent(agentId: string): RegisteredAgent {
	const revokedAt = nowIso()
	db.prepare("UPDATE agents SET status = 'revoked', revoked_at = ?, updated_at = ? WHERE agent_id = ?").run(revokedAt, revokedAt, agentId)
	const agent = getAgent(agentId)
	if (!agent) {
		throw new Error(`Unknown agent ${agentId}.`)
	}
	return agent
}

export function bindAgentsToOwner(ownerAddress: string): void {
	const updatedAt = nowIso()
	db.prepare("UPDATE agents SET owner_address = ?, delegated_eoa = ?, updated_at = ? WHERE status = 'active'").run(ownerAddress, ownerAddress, updatedAt)
}

export function getRegistrySnapshot() {
	return {
		registryMarkets: listMarkets(),
		registeredAgents: listAgents(),
		agentRuns: listRuns(),
		lastAgentRun: getLatestRun(),
	}
}
