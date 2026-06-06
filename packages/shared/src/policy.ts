import type { AgentMandate, PaymentRequest, PolicyDecision } from './schemas'

const toBigInt = (value: string): bigint => BigInt(value)

const toAtomicString = (value: bigint): string => (value < 0n ? '0' : value.toString())

export function remainingBudget(mandate: AgentMandate): bigint {
	return toBigInt(mandate.maxTotalAtomic) - toBigInt(mandate.spentAtomic)
}

export function evaluatePayment(mandate: AgentMandate, request: PaymentRequest, nowSeconds = Math.floor(Date.now() / 1000)): PolicyDecision {
	const remaining = remainingBudget(mandate)
	const amount = toBigInt(request.amountAtomic)

	if (mandate.revoked) {
		return { allowed: false, reason: 'Mandate has been revoked.', remainingAtomic: toAtomicString(remaining) }
	}
	if (mandate.expiresAt <= nowSeconds) {
		return { allowed: false, reason: 'Mandate has expired.', remainingAtomic: toAtomicString(remaining) }
	}
	if (request.token.toLowerCase() !== mandate.token.toLowerCase()) {
		return { allowed: false, reason: 'Token is not allowed by the mandate.', remainingAtomic: toAtomicString(remaining) }
	}
	if (request.merchant.toLowerCase() !== mandate.merchant.toLowerCase()) {
		return { allowed: false, reason: 'Merchant is not allowed by the mandate.', remainingAtomic: toAtomicString(remaining) }
	}
	if (request.serviceHash.toLowerCase() !== mandate.serviceHash.toLowerCase()) {
		return { allowed: false, reason: 'Service hash is not allowed by the mandate.', remainingAtomic: toAtomicString(remaining) }
	}
	if (amount > toBigInt(mandate.maxPerPaymentAtomic)) {
		return { allowed: false, reason: 'Payment exceeds the per-request cap.', remainingAtomic: toAtomicString(remaining) }
	}
	if (amount > remaining) {
		return { allowed: false, reason: 'Payment exceeds the remaining total budget.', remainingAtomic: toAtomicString(remaining) }
	}

	return { allowed: true, reason: 'Payment is inside the GridPlus-signed mandate.', remainingAtomic: toAtomicString(remaining - amount) }
}

export function applyPayment(mandate: AgentMandate, request: PaymentRequest): AgentMandate {
	return {
		...mandate,
		spentAtomic: (toBigInt(mandate.spentAtomic) + toBigInt(request.amountAtomic)).toString(),
	}
}
