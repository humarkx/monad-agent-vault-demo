import { randomBytes } from 'node:crypto'
import { createWalletClient, http, type Address, type Hex } from 'viem'
import { evaluatePayment, applyPayment, DEMO_SERVICE, MONAD_MAINNET, paymentRequestSchema, type X402Challenge } from '@gridplus-monad-agent-vault/shared'
import { agentVaultDelegateAbi } from './abi'
import { config } from './config'
import { getAgentWalletClient, monadMainnet, rpcConfigured } from './monad'
import { addEvent, getActiveMandate, getState, patchState, resetAgents, setAgentStatus } from './state'

const paymentId = (): Hex => `0x${randomBytes(32).toString('hex')}`

export function buildResearchChallenge(amountAtomic: string): X402Challenge {
	return {
		status: 402,
		scheme: 'exact',
		network: MONAD_MAINNET.caip2,
		resource: DEMO_SERVICE.resource,
		amountAtomic,
		token: MONAD_MAINNET.usdc.address,
		merchant: DEMO_SERVICE.merchant,
		serviceHash: DEMO_SERVICE.serviceHash,
		paymentId: paymentId(),
		description: 'Pay tiny Monad mainnet USDC to unlock premium agent research.',
	}
}

const toContractMandate = (mandate: ReturnType<typeof getActiveMandate>) => ({
	owner: mandate.owner as Address,
	agent: mandate.agent as Address,
	delegate: mandate.delegate as Address,
	token: mandate.token as Address,
	merchant: mandate.merchant as Address,
	serviceHash: mandate.serviceHash as Hex,
	maxTotalAtomic: BigInt(mandate.maxTotalAtomic),
	maxPerPaymentAtomic: BigInt(mandate.maxPerPaymentAtomic),
	expiresAt: BigInt(mandate.expiresAt),
	nonce: mandate.nonce as Hex,
})

async function executeDelegatedPayment(challenge: X402Challenge): Promise<Hex> {
	const mandate = getActiveMandate()
	if (!config.AGENT_PRIVATE_KEY || !rpcConfigured || !mandate.signature) {
		return `0x${randomBytes(32).toString('hex')}` as Hex
	}

	const walletClient = getAgentWalletClient()
	const hash = await walletClient.writeContract({
		address: mandate.owner as Address,
		abi: agentVaultDelegateAbi,
		functionName: 'pay',
		args: [toContractMandate(mandate), BigInt(challenge.amountAtomic), challenge.serviceHash as Hex, challenge.paymentId as Hex, mandate.signature as Hex],
		gas: 140_000n,
	})
	return hash
}

export async function runAgentDemo(kind: 'valid' | 'blocked' | 'revoked') {
	resetAgents()
	patchState({ lastChallenge: null, lastPolicyDecision: null, lastServiceResult: null, lastTxHash: null })

	if (kind === 'revoked') {
		const current = getActiveMandate()
		patchState({ mandate: { ...current, revoked: true } })
		addEvent({ actor: 'Owner', title: 'Mandate revoked', detail: 'The GridPlus-signed agent mandate is now revoked.', status: 'warning' })
	}

	setAgentStatus('ResearchAgent', 'running')
	addEvent({ actor: 'ResearchAgent', title: 'Paid resource requested', detail: 'ResearchAgent calls the premium Monad research endpoint.', status: 'info' })

	const challenge = buildResearchChallenge(kind === 'blocked' ? DEMO_SERVICE.blockedPaymentAtomic : DEMO_SERVICE.validPaymentAtomic)
	patchState({ lastChallenge: challenge })
	addEvent({ actor: 'Merchant', title: '402 challenge returned', detail: `${challenge.amountAtomic} atomic USDC required by ${challenge.resource}.`, status: 'info' })

	setAgentStatus('PaymentAgent', 'running')
	setAgentStatus('PolicyGuard', 'running')
	const mandate = getActiveMandate()
	const request = paymentRequestSchema.parse({
		amountAtomic: challenge.amountAtomic,
		merchant: challenge.merchant,
		paymentId: challenge.paymentId,
		serviceHash: challenge.serviceHash,
		token: challenge.token,
	})
	const decision = evaluatePayment(mandate, request)
	patchState({ lastPolicyDecision: decision })

	if (!decision.allowed) {
		setAgentStatus('PolicyGuard', 'blocked')
		setAgentStatus('PaymentAgent', 'blocked')
		setAgentStatus('ResearchAgent', 'blocked')
		addEvent({ actor: 'PolicyGuard', title: 'Payment blocked', detail: decision.reason, status: 'error' })
		return getState()
	}

	setAgentStatus('PolicyGuard', 'approved')
	addEvent({ actor: 'PolicyGuard', title: 'Mandate approved payment', detail: decision.reason, status: 'success' })

	const txHash = await executeDelegatedPayment(challenge)
	patchState({
		mandate: applyPayment(mandate, request),
		lastTxHash: txHash,
	})
	setAgentStatus('PaymentAgent', 'complete')
	addEvent({ actor: 'PaymentAgent', title: 'Payment submitted', detail: 'Delegated EOA paid the x402-style challenge on Monad mainnet.', status: 'success', txHash })

	setAgentStatus('VerifierAgent', 'running')
	const mode = config.AGENT_PRIVATE_KEY && rpcConfigured ? 'live Monad mainnet transaction' : 'simulated transaction hash'
	const result = `Unlocked report via ${mode}: Monad agent spend approved by GridPlus policy.`
	patchState({ lastServiceResult: result })
	setAgentStatus('VerifierAgent', 'complete')
	setAgentStatus('ResearchAgent', 'complete')
	addEvent({ actor: 'VerifierAgent', title: 'Result unlocked', detail: result, status: 'success', txHash })

	return getState()
}

export function createX402FetchClientDescription() {
	const client = createWalletClient({
		chain: monadMainnet,
		transport: http(config.MONAD_RPC_URL ?? 'http://127.0.0.1:8545'),
	})
	return {
		clientKind: 'viem wallet client',
		x402Mode: 'x402-style exact payment challenge',
		chain: client.chain?.id ?? MONAD_MAINNET.chainId,
	}
}
