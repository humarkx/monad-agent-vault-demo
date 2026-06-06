import { describe, expect, it } from 'vitest'
import { DEMO_SERVICE, MONAD_MAINNET } from './constants'
import { evaluatePayment } from './policy'
import type { AgentMandate, PaymentRequest } from './schemas'

const mandate: AgentMandate = {
	owner: '0x1111111111111111111111111111111111111111',
	agent: '0x3333333333333333333333333333333333333333',
	delegate: '0x4444444444444444444444444444444444444444',
	token: MONAD_MAINNET.usdc.address,
	merchant: DEMO_SERVICE.merchant,
	serviceHash: DEMO_SERVICE.serviceHash,
	maxTotalAtomic: '50000',
	maxPerPaymentAtomic: '10000',
	spentAtomic: '0',
	expiresAt: 4_102_444_800,
	nonce: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
	revoked: false,
}

const request: PaymentRequest = {
	amountAtomic: '5000',
	merchant: DEMO_SERVICE.merchant,
	paymentId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
	serviceHash: DEMO_SERVICE.serviceHash,
	token: MONAD_MAINNET.usdc.address,
}

describe('evaluatePayment', () => {
	it('allows payments inside the signed mandate', () => {
		expect(evaluatePayment(mandate, request).allowed).toBe(true)
	})

	it('blocks payments over the per-request cap', () => {
		expect(evaluatePayment(mandate, { ...request, amountAtomic: '10001' }).reason).toMatch(/per-request/)
	})

	it('blocks revoked mandates', () => {
		expect(evaluatePayment({ ...mandate, revoked: true }, request).reason).toMatch(/revoked/)
	})

	it('blocks wrong services', () => {
		expect(evaluatePayment(mandate, { ...request, serviceHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' }).reason).toMatch(/Service/)
	})
})
