import { z } from 'zod'
import { DEMO_SERVICE, MONAD_MAINNET } from './constants'

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Expected an EVM address')
export const bytes32Schema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Expected bytes32 hex')
export const txHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Expected transaction hash')
export const decimalAtomicSchema = z.string().regex(/^\d+$/, 'Expected unsigned integer string')

export const agentNameSchema = z.enum(['ResearchAgent', 'PaymentAgent', 'VerifierAgent', 'PolicyGuard'])
export type AgentName = z.infer<typeof agentNameSchema>

export const agentStatusSchema = z.enum(['idle', 'running', 'approved', 'blocked', 'complete', 'error'])
export type AgentStatus = z.infer<typeof agentStatusSchema>

export const deviceModeSchema = z.enum(['device', 'local-signer'])
export type DeviceMode = z.infer<typeof deviceModeSchema>

export const mandateSchema = z.object({
	owner: addressSchema,
	agent: addressSchema,
	delegate: addressSchema,
	token: addressSchema.default(MONAD_MAINNET.usdc.address),
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
