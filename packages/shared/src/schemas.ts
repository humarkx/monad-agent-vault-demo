import { z } from 'zod'
import { DEFAULT_MARKET_ID, DEMO_MARKETS, DEMO_SERVICE, MONAD_MAINNET } from './constants'

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Expected an EVM address')
export const bytes32Schema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Expected bytes32 hex')
export const txHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Expected transaction hash')
export const decimalAtomicSchema = z.string().regex(/^\d+$/, 'Expected unsigned integer string')

export const agentNameSchema = z.enum(['ScoutAgent', 'PaymentAgent', 'PolicyGuard', 'SignalAgent', 'DecisionAgent', 'ResultPoster'])
export type AgentName = z.infer<typeof agentNameSchema>

export const agentStatusSchema = z.enum(['idle', 'running', 'approved', 'blocked', 'complete', 'error'])
export type AgentStatus = z.infer<typeof agentStatusSchema>

export const deviceModeSchema = z.enum(['device', 'local-signer'])
export type DeviceMode = z.infer<typeof deviceModeSchema>

export const mandateSchema = z.object({
	owner: addressSchema,
	agent: addressSchema,
	delegate: addressSchema,
	token: addressSchema.default(MONAD_MAINNET.testCollateral.address),
	merchant: addressSchema.default(DEMO_SERVICE.merchant),
	serviceHash: bytes32Schema.default(DEMO_SERVICE.serviceHash),
	maxTotalAtomic: decimalAtomicSchema,
	maxPerPaymentAtomic: decimalAtomicSchema,
	spentAtomic: decimalAtomicSchema.default('0'),
	expiresAt: z.number().int().positive(),
	nonce: z.string().min(1),
	revoked: z.boolean().default(false),
	signature: z.string().regex(/^0x[a-fA-F0-9]+$/).optional(),
})
export type AgentMandate = z.infer<typeof mandateSchema>

export const paymentRequestSchema = z.object({
	amountAtomic: decimalAtomicSchema,
	serviceHash: bytes32Schema,
	merchant: addressSchema,
	token: addressSchema,
	paymentId: bytes32Schema,
})
export type PaymentRequest = z.infer<typeof paymentRequestSchema>

export const policyDecisionSchema = z.object({
	allowed: z.boolean(),
	reason: z.string(),
	remainingAtomic: decimalAtomicSchema,
})
export type PolicyDecision = z.infer<typeof policyDecisionSchema>

export const testSignatureSchema = z.object({
	owner: addressSchema,
	message: z.string().min(1),
	payload: z.string().min(1),
	nonce: bytes32Schema,
	signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
})
export type TestSignature = z.infer<typeof testSignatureSchema>

export const x402ChallengeSchema = z.object({
	status: z.literal(402),
	scheme: z.literal('exact'),
	network: z.literal(MONAD_MAINNET.caip2),
	resource: z.string().url(),
	amountAtomic: decimalAtomicSchema,
	token: addressSchema,
	merchant: addressSchema,
	serviceHash: bytes32Schema,
	paymentId: bytes32Schema,
	description: z.string(),
})
export type X402Challenge = z.infer<typeof x402ChallengeSchema>

export const marketIdSchema = z.string().min(1)
export const nullableAddressSchema = addressSchema.nullable()

export const eventMarketSchema = z.object({
	marketId: marketIdSchema,
	title: z.string(),
	question: z.string(),
	league: z.string(),
	homeTeam: z.string(),
	awayTeam: z.string(),
	kickoff: z.string(),
})
export type EventMarket = z.infer<typeof eventMarketSchema>

export const registryMarketStatusSchema = z.enum(['draft', 'open', 'paused', 'resolved'])
export type RegistryMarketStatus = z.infer<typeof registryMarketStatusSchema>

export const registryMarketSchema = z.object({
	marketId: marketIdSchema,
	slug: z.string().min(1),
	title: z.string().min(1),
	question: z.string().min(1),
	league: z.string().min(1),
	homeTeam: z.string().min(1),
	awayTeam: z.string().min(1),
	kickoff: z.string().min(1),
	marketAddress: nullableAddressSchema,
	ammAddress: nullableAddressSchema,
	collateralTokenAddress: nullableAddressSchema,
	contextApiUrl: z.string().min(1),
	contextSchema: z.string().min(1),
	status: registryMarketStatusSchema,
	createdAt: z.string(),
	updatedAt: z.string(),
})
export type RegistryMarket = z.infer<typeof registryMarketSchema>

export const marketContextSchema = z.object({
	marketId: marketIdSchema,
	source: z.string().min(1),
	timestamp: z.number().int().positive(),
	minute: z.number().int().nonnegative(),
	score: z.string().min(1),
	matchState: z.string().min(1),
	headline: z.string().min(1),
	modelProbabilityFor: z.number().min(0).max(1),
	modelProbabilityAgainst: z.number().min(0).max(1),
	ammPriceFor: z.number().min(0).max(1),
	ammPriceAgainst: z.number().min(0).max(1),
	edgeBps: z.number().int(),
	confidence: z.number().min(0).max(1),
	liquidityAtomic: decimalAtomicSchema,
	volumeAtomic: decimalAtomicSchema,
})
export type MarketContext = z.infer<typeof marketContextSchema>

export const registeredAgentStatusSchema = z.enum(['active', 'paused', 'revoked', 'blocked'])
export type RegisteredAgentStatus = z.infer<typeof registeredAgentStatusSchema>

export const agentDecisionSchema = z.enum(['BUY_FOR', 'BUY_AGAINST', 'HOLD', 'BLOCKED'])
export type AgentDecision = z.infer<typeof agentDecisionSchema>

export const tradeSideSchema = z.enum(['FOR', 'AGAINST']).nullable()
export type TradeSide = z.infer<typeof tradeSideSchema>

export const agentRunStatusSchema = z.enum(['success', 'dry-run', 'blocked', 'error'])
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>

export const registeredAgentSchema = z.object({
	agentId: z.string().min(1),
	name: z.string().min(1),
	ownerAddress: addressSchema,
	delegatedEoa: addressSchema,
	marketId: marketIdSchema,
	prompt: z.string().min(1),
	promptHash: bytes32Schema,
	promptUri: z.string().min(1),
	budgetAtomic: decimalAtomicSchema,
	spentAtomic: decimalAtomicSchema,
	maxTradeAtomic: decimalAtomicSchema,
	minEdgeBps: z.number().int().nonnegative(),
	intervalSeconds: z.number().int().nonnegative(),
	nextRunAt: z.string(),
	status: registeredAgentStatusSchema,
	revokedAt: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	lastDecision: agentDecisionSchema.nullable().default(null),
	lastRunAt: z.string().nullable().default(null),
})
export type RegisteredAgent = z.infer<typeof registeredAgentSchema>

export const agentTraceSchema = z.object({
	prompt: z.string(),
	rulesTriggered: z.array(z.string()),
	budgetRemainingAtomic: decimalAtomicSchema,
	edgeBps: z.number().int(),
	confidence: z.number().min(0).max(1),
	executionMode: z.enum(['dry-run', 'live']),
})
export type AgentTrace = z.infer<typeof agentTraceSchema>

export const agentRunSchema = z.object({
	runId: z.string().min(1),
	agentId: z.string().min(1),
	marketId: marketIdSchema,
	contextSnapshot: marketContextSchema.nullable(),
	llmTrace: agentTraceSchema.nullable(),
	decision: agentDecisionSchema,
	decisionReason: z.string(),
	tradeSide: tradeSideSchema,
	tradeAmountAtomic: decimalAtomicSchema,
	txHash: txHashSchema.nullable(),
	status: agentRunStatusSchema,
	error: z.string().nullable(),
	createdAt: z.string(),
})
export type AgentRun = z.infer<typeof agentRunSchema>

export const footballOddsSnapshotSchema = z.object({
	marketId: marketIdSchema,
	round: z.enum(['opening', 'update']),
	minute: z.number().int().nonnegative(),
	score: z.string(),
	matchState: z.string(),
	modelProbabilityYes: z.number().min(0).max(1),
	modelProbabilityNo: z.number().min(0).max(1),
	marketImpliedProbabilityYes: z.number().min(0).max(1),
	edgeBps: z.number().int(),
	confidence: z.number().min(0).max(1),
	source: z.string(),
	timestamp: z.number().int().positive(),
})
export type FootballOddsSnapshot = z.infer<typeof footballOddsSnapshotSchema>

export const paidSignalAttestationSchema = z.object({
	marketId: marketIdSchema,
	type: z.literal('LIVE_SIGNAL'),
	minute: z.number().int().nonnegative(),
	score: z.string(),
	matchState: z.string(),
	probabilities: z.object({
		YES: z.number().min(0).max(1),
		NO: z.number().min(0).max(1),
	}),
	marketImpliedProbability: z.number().min(0).max(1),
	edgeBps: z.number().int(),
	confidence: z.number().min(0).max(1),
	timestamp: z.number().int().positive(),
	source: z.string(),
	provider: addressSchema,
	signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
})
export type PaidSignalAttestation = z.infer<typeof paidSignalAttestationSchema>

export const footballOddsReportSchema = z.object({
	market: eventMarketSchema,
	snapshot: footballOddsSnapshotSchema,
	brief: z.string().nullable().default(null),
	aiSummary: z.string(),
	agentDecision: z.enum(['BUY_YES', 'BUY_NO', 'HOLD', 'REDUCE']),
	decisionReason: z.string(),
	attestation: paidSignalAttestationSchema,
})
export type FootballOddsReport = z.infer<typeof footballOddsReportSchema>

export const resultPosterPayloadSchema = z.object({
	marketId: marketIdSchema,
	outcome: z.enum(['YES', 'NO']),
	finalScore: z.string(),
	matchEndedAt: z.string(),
	evidenceHash: bytes32Schema,
	contractIntegration: z.literal('pending'),
})
export type ResultPosterPayload = z.infer<typeof resultPosterPayloadSchema>

export const auditEventSchema = z.object({
	id: z.string(),
	at: z.string(),
	actor: z.string(),
	title: z.string(),
	detail: z.string(),
	status: z.enum(['info', 'success', 'warning', 'error']),
	txHash: txHashSchema.optional(),
})
export type AuditEvent = z.infer<typeof auditEventSchema>

export const demoStateSchema = z.object({
	network: z.literal(MONAD_MAINNET.caip2),
	rpcConfigured: z.boolean(),
	gridplus: z.object({
		connectRelayUrl: z.string().url(),
		simulatorUrl: z.string().url(),
		simulatorMqttWsUrl: z.string().url(),
		simulatorProvisionUrl: z.string().url(),
	}),
	device: z.object({
		mode: deviceModeSchema,
		paired: z.boolean(),
		owner: addressSchema.nullable(),
		deviceId: z.string().nullable().default(null),
		appName: z.string().nullable().default(null),
	}),
	vault: z.object({
		delegate: addressSchema.nullable(),
		delegated: z.boolean(),
		authorizationTxHash: txHashSchema.nullable(),
		clearDelegationTxHash: txHashSchema.nullable(),
	}),
	mandate: mandateSchema.nullable(),
	agents: z.record(agentNameSchema, agentStatusSchema),
	events: z.array(auditEventSchema),
	lastChallenge: x402ChallengeSchema.nullable(),
	lastPolicyDecision: policyDecisionSchema.nullable(),
	lastServiceResult: z.string().nullable(),
	lastTxHash: txHashSchema.nullable(),
	lastTestSignature: testSignatureSchema.nullable(),
	usedPaymentIds: z.array(bytes32Schema).default([]),
	markets: z.array(eventMarketSchema).default(DEMO_MARKETS.map((market) => ({ ...market }))),
	lastSignalReport: footballOddsReportSchema.nullable(),
	lastResultPayload: resultPosterPayloadSchema.nullable(),
	registryMarkets: z.array(registryMarketSchema).default([]),
	registeredAgents: z.array(registeredAgentSchema).default([]),
	agentRuns: z.array(agentRunSchema).default([]),
	lastAgentRun: agentRunSchema.nullable().default(null),
})
export type DemoState = z.infer<typeof demoStateSchema>

export const deviceSetupRequestSchema = z.object({
	mode: deviceModeSchema.default('device'),
	deviceId: z.string().optional(),
	appName: z.string().optional(),
})
export type DeviceSetupRequest = z.infer<typeof deviceSetupRequestSchema>

export const devicePairRequestSchema = z.object({
	pairingCode: z.string().min(1),
})
export type DevicePairRequest = z.infer<typeof devicePairRequestSchema>

export const authorize7702RequestSchema = z.object({
	delegate: addressSchema.optional(),
})
export type Authorize7702Request = z.infer<typeof authorize7702RequestSchema>

export const signMandateRequestSchema = z.object({
	agent: addressSchema.optional(),
	maxTotalAtomic: decimalAtomicSchema.default('50000'),
	maxPerPaymentAtomic: decimalAtomicSchema.default('10000'),
	expiresInSeconds: z.number().int().positive().default(3600),
})
export type SignMandateRequest = z.infer<typeof signMandateRequestSchema>

export const signTestMessageRequestSchema = z.object({
	message: z.string().min(1).max(256).default('Hello World'),
})
export type SignTestMessageRequest = z.infer<typeof signTestMessageRequestSchema>

export const unlockSignalRequestSchema = z.object({
	paymentId: bytes32Schema,
	txHash: txHashSchema.optional(),
})
export type UnlockSignalRequest = z.infer<typeof unlockSignalRequestSchema>

export const runEventIntelligenceRequestSchema = z.object({
	marketId: marketIdSchema.default(DEFAULT_MARKET_ID),
	kind: z.enum(['valid', 'blocked', 'revoked']).default('valid'),
	round: z.enum(['opening', 'update']).default('opening'),
	brief: z.string().trim().max(280).optional(),
})
export type RunEventIntelligenceRequest = z.infer<typeof runEventIntelligenceRequestSchema>

export const createMarketRequestSchema = registryMarketSchema
	.omit({
		createdAt: true,
		updatedAt: true,
	})
	.partial({
		marketAddress: true,
		ammAddress: true,
		collateralTokenAddress: true,
		contextSchema: true,
		status: true,
	})
export type CreateMarketRequest = z.infer<typeof createMarketRequestSchema>

export const createAgentRequestSchema = registeredAgentSchema
	.omit({
		promptHash: true,
		spentAtomic: true,
		revokedAt: true,
		createdAt: true,
		updatedAt: true,
		lastDecision: true,
		lastRunAt: true,
	})
	.partial({
		promptUri: true,
		status: true,
		nextRunAt: true,
	})
export type CreateAgentRequest = z.infer<typeof createAgentRequestSchema>

export const runRegisteredAgentRequestSchema = z.object({
	agentId: z.string().min(1),
	mode: z.enum(['dry-run', 'live']).default('dry-run'),
})
export type RunRegisteredAgentRequest = z.infer<typeof runRegisteredAgentRequestSchema>
