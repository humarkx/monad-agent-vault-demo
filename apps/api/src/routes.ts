import { Hono } from 'hono'
import { randomBytes } from 'node:crypto'
import type { Address } from 'viem'
import {
	authorize7702RequestSchema,
	createAgentRequestSchema,
	createMarketRequestSchema,
	DEFAULT_MARKET_ID,
	DEMO_AGENT_VAULT_DELEGATE,
	DEMO_SERVICE,
	devicePairRequestSchema,
	deviceSetupRequestSchema,
	MONAD_MAINNET,
	runEventIntelligenceRequestSchema,
	runRegisteredAgentRequestSchema,
	signMandateRequestSchema,
	signTestMessageRequestSchema,
	unlockSignalRequestSchema,
} from '@gridplus-monad-agent-vault/shared'
import { createX402FetchClientDescription, publishResultPreview, requestSignalChallenge, runAgentDemo, runEventIntelligenceDemo, unlockPaidSignal } from './agent'
import { config } from './config'
import { getDelegatedCode, getPublicClient, rpcConfigured, submitAuthorizationTransaction } from './monad'
import { bindAgentsToOwner, createAgent, createMarket, getAgent, getMarket, getRegistrySnapshot, listAgents, listMarkets, listRuns, listRunsForAgent, revokeAgent } from './registry-db'
import { getStoredMarketContext, runDueAgents, runRegisteredAgent } from './registry-runner'
import { addEvent, getActiveMandate, getState, patchState } from './state'
import { buildReadableTestSignPayload, createNonce, getStoredDeviceContext, pairDevice, resetDeviceSession, setupDevice, sign7702Authorization, signMandate, signTestMessage } from './signer'

const jsonBody = async (c: { req: { json: () => Promise<unknown> } }) => {
	try {
		return await c.req.json()
	} catch {
		return {}
	}
}

export const routes = new Hono()

const stateWithStoredDeviceContext = () => {
	const state = getState()
	if (state.device.paired) {
		return state
	}
	const stored = getStoredDeviceContext()
	if ((!state.device.deviceId && stored.deviceId) || state.device.appName !== stored.appName) {
		return patchState({
			device: {
				...state.device,
				deviceId: stored.deviceId,
				appName: stored.appName,
			},
		})
	}
	return state
}

const hydratedState = () => ({
	...stateWithStoredDeviceContext(),
	...getRegistrySnapshot(),
})

routes.get('/health', (c) =>
	c.json({
		ok: true,
		network: MONAD_MAINNET.caip2,
		rpcConfigured,
		gridplus: {
			connectRelayUrl: config.GRIDPLUS_BASE_URL,
			simulatorUrl: config.GRIDPLUS_SIMULATOR_URL,
			simulatorMqttWsUrl: config.GRIDPLUS_SIMULATOR_MQTT_WS_URL,
			simulatorProvisionUrl: config.GRIDPLUS_SIMULATOR_PROVISION_URL,
		},
		registry: {
			dbFile: config.SQLITE_DB_FILE,
			markets: listMarkets(),
			agents: listAgents(),
			nvidiaConfigured: Boolean(config.NVIDIA_API_KEY),
			apiFootballConfigured: Boolean(config.API_FOOTBALL_KEY),
		},
		compatibility: {
			legacyX402Client: createX402FetchClientDescription(),
		},
	}),
)

routes.get('/demo/state', (c) => c.json(hydratedState()))

routes.get('/markets', (c) => c.json({ markets: listMarkets() }))

routes.post('/markets', async (c) => c.json({ market: createMarket(createMarketRequestSchema.parse(await jsonBody(c))), state: hydratedState() }))

routes.get('/markets/:marketId', (c) => {
	const market = getMarket(c.req.param('marketId'))
	if (!market) {
		throw new Error(`Unknown market ${c.req.param('marketId')}.`)
	}
	return c.json({ market })
})

routes.get('/markets/:marketId/context', (c) => c.json(getStoredMarketContext(c.req.param('marketId'))))

routes.get('/context/markets/:marketId', (c) => c.json(getStoredMarketContext(c.req.param('marketId'))))

routes.get('/agents', (c) => c.json({ agents: listAgents() }))

routes.post('/agents', async (c) => c.json({ agent: createAgent(createAgentRequestSchema.parse(await jsonBody(c))), state: hydratedState() }))

routes.get('/agents/:agentId', (c) => {
	const agent = getAgent(c.req.param('agentId'))
	if (!agent) {
		throw new Error(`Unknown agent ${c.req.param('agentId')}.`)
	}
	return c.json({ agent, runs: listRunsForAgent(agent.agentId) })
})

routes.post('/agents/:agentId/run', async (c) => {
	const body = await jsonBody(c)
	const bodyRecord = typeof body === 'object' && body !== null && !Array.isArray(body) ? body : {}
	const input = runRegisteredAgentRequestSchema.parse({ ...bodyRecord, agentId: c.req.param('agentId') })
	const run = await runRegisteredAgent(input)
	return c.json({ run, state: hydratedState() })
})

routes.post('/agents/:agentId/revoke', (c) => {
	const agent = revokeAgent(c.req.param('agentId'))
	addEvent({ actor: 'Owner', title: `${agent.name} revoked`, detail: 'Future backend runner ticks will block this agent before spend.', status: 'warning' })
	return c.json({ agent, state: hydratedState() })
})

routes.post('/runner/tick', async (c) => {
	const body = await jsonBody(c)
	const mode = typeof (body as { mode?: unknown }).mode === 'string' && (body as { mode: string }).mode === 'live' ? 'live' : 'dry-run'
	const runs = await runDueAgents(mode)
	return c.json({ runs, state: hydratedState() })
})

routes.get('/runs', (c) => c.json({ runs: listRuns() }))

routes.get('/signal/:marketId', (c) => {
	const challenge = requestSignalChallenge(c.req.param('marketId'))
	return c.json(challenge, 402)
})

routes.post('/signal/:marketId/unlock', async (c) => {
	const input = unlockSignalRequestSchema.parse(await jsonBody(c))
	return c.json(await unlockPaidSignal(c.req.param('marketId'), input))
})

routes.get('/result/:marketId', async (c) => c.json(await publishResultPreview(c.req.param('marketId'))))

routes.post('/device/setup', async (c) => {
	const input = deviceSetupRequestSchema.parse(await jsonBody(c))
	const result = await setupDevice(input)
	patchState({
		device: {
			mode: result.mode,
			paired: result.paired,
			owner: result.owner,
			deviceId: result.deviceId,
			appName: result.appName,
		},
	})
	if (result.owner) {
		bindAgentsToOwner(result.owner)
	}
	addEvent({
		actor: 'GridPlus',
		title: result.paired ? 'Device connected' : 'Device session opened',
		detail: result.mode === 'device' ? (result.owner ? `GridPlus device ready for ${result.owner}.` : 'GridPlus device reached; enter the pairing code to authorize this app.') : `Local signer ready for ${result.owner}.`,
		status: result.paired ? 'success' : 'warning',
	})
	return c.json({ paired: result.paired, owner: result.owner, state: hydratedState() })
})

routes.post('/device/pair', async (c) => {
	const input = devicePairRequestSchema.parse(await jsonBody(c))
	const state = getState()
	const result = await pairDevice(input.pairingCode, {
		mode: state.device.mode,
		deviceId: state.device.deviceId,
		appName: state.device.appName,
	})
	if (result.owner) {
		bindAgentsToOwner(result.owner)
	}
	patchState({ device: { ...getState().device, paired: result.paired, owner: result.owner, deviceId: result.deviceId, appName: result.appName } })
	addEvent({ actor: 'GridPlus', title: 'Pairing completed', detail: result.paired ? `Device pairing succeeded for ${result.owner}.` : 'Device pairing did not complete.', status: result.paired ? 'success' : 'warning' })
	return c.json({ paired: result.paired, owner: result.owner, state: hydratedState() })
})

routes.post('/device/reset-session', (c) => {
	resetDeviceSession()
	patchState({
		device: {
			...getState().device,
			paired: false,
			owner: null,
			deviceId: null,
			appName: config.GRIDPLUS_APP_NAME,
		},
	})
	addEvent({ actor: 'GridPlus', title: 'Device session reset', detail: 'Stored SDK session was cleared. Connect the device again before pairing.', status: 'warning' })
	return c.json({ state: hydratedState() })
})

routes.post('/device/sign-test', async (c) => {
	const input = signTestMessageRequestSchema.parse(await jsonBody(c))
	const state = getState()
	if (!state.device.owner) {
		throw new Error('Pair a GridPlus device before signing a test message.')
	}

	const nonce = createNonce()
	const payload = buildReadableTestSignPayload({ owner: state.device.owner as Address, message: input.message, nonce })
	const signed = {
		owner: state.device.owner,
		message: input.message,
		payload,
		nonce,
		signature: await signTestMessage({ mode: state.device.mode, payload }),
	}
	patchState({ lastTestSignature: signed })
	addEvent({ actor: 'GridPlus', title: 'Test message signed', detail: `Device signed "${input.message}".`, status: 'success' })
	return c.json({ signed, state: hydratedState() })
})

routes.post('/vault/authorize-7702', async (c) => {
	const input = authorize7702RequestSchema.parse(await jsonBody(c))
	const state = getState()
	if (!state.device.owner) {
		throw new Error('Connect GridPlus before enabling EIP-7702 delegation.')
	}
	const delegate = (input.delegate ?? config.AGENT_VAULT_DELEGATE_ADDRESS) as Address | undefined
	if (!delegate) {
		throw new Error('AGENT_VAULT_DELEGATE_ADDRESS or request delegate is required.')
	}

	const nonce = rpcConfigured ? await getPublicClient().getTransactionCount({ address: state.device.owner as Address }) : 0
	const authorization = await sign7702Authorization({ mode: state.device.mode, delegate, nonce })
	let txHash = null
	if (config.SPONSOR_PRIVATE_KEY && rpcConfigured) {
		txHash = await submitAuthorizationTransaction(state.device.owner as Address, authorization)
	}

	patchState({
		vault: {
			...state.vault,
			delegate,
			delegated: Boolean(txHash),
			authorizationTxHash: txHash,
		},
	})
	addEvent({
		actor: 'GridPlus',
		title: 'EIP-7702 authorization signed',
		detail: txHash ? 'Authorization submitted on Monad testnet.' : 'Authorization signed; set SPONSOR_PRIVATE_KEY to submit it live.',
		status: txHash ? 'success' : 'info',
		txHash: txHash ?? undefined,
	})
	return c.json({ authorization, txHash, state: hydratedState() })
})

routes.post('/vault/check-delegation', async (c) => {
	const state = getState()
	if (!state.device.owner || !rpcConfigured) {
		return c.json({ code: '0x', delegated: false, state })
	}
	const code = await getDelegatedCode(state.device.owner as Address)
	const delegated = code !== '0x'
	patchState({ vault: { ...state.vault, delegated } })
	return c.json({ code, delegated, state: hydratedState() })
})

routes.post('/vault/clear-delegation', async (c) => {
	const state = getState()
	if (!state.device.owner) {
		throw new Error('No connected owner to clear.')
	}
	const nonce = rpcConfigured ? await getPublicClient().getTransactionCount({ address: state.device.owner as Address }) : 0
	const zeroDelegate = '0x0000000000000000000000000000000000000000' as Address
	const authorization = await sign7702Authorization({ mode: state.device.mode, delegate: zeroDelegate, nonce })
	let txHash = null
	if (config.SPONSOR_PRIVATE_KEY && rpcConfigured) {
		txHash = await submitAuthorizationTransaction(state.device.owner as Address, authorization)
	}
	patchState({
		vault: {
			...state.vault,
			delegated: false,
			clearDelegationTxHash: txHash,
		},
	})
	addEvent({ actor: 'GridPlus', title: 'Delegation clear requested', detail: txHash ? 'Clear-delegation transaction submitted.' : 'Clear authorization signed but not submitted.', status: txHash ? 'success' : 'warning', txHash: txHash ?? undefined })
	return c.json({ authorization, txHash, state: hydratedState() })
})

routes.post('/mandates/sign', async (c) => {
	const input = signMandateRequestSchema.parse(await jsonBody(c))
	const state = getState()
	if (!state.device.owner) {
		throw new Error('Connect GridPlus before signing a mandate.')
	}
	const delegate = (state.vault.delegate ?? config.AGENT_VAULT_DELEGATE_ADDRESS ?? DEMO_AGENT_VAULT_DELEGATE) as Address
	const agent = input.agent ?? (config.AGENT_PRIVATE_KEY ? undefined : '0x3333333333333333333333333333333333333333')
	const mandate = {
		owner: state.device.owner,
		agent: agent ?? '0x3333333333333333333333333333333333333333',
		delegate,
		token: MONAD_MAINNET.usdc.address,
		merchant: DEMO_SERVICE.merchant,
		serviceHash: DEMO_SERVICE.serviceHash,
		maxTotalAtomic: input.maxTotalAtomic,
		maxPerPaymentAtomic: input.maxPerPaymentAtomic,
		spentAtomic: '0',
		expiresAt: Math.floor(Date.now() / 1000) + input.expiresInSeconds,
		nonce: createNonce(),
		revoked: false,
	}
	const signature = await signMandate({ mode: state.device.mode, mandate })
	const signed = { ...mandate, signature }
	patchState({ vault: { ...state.vault, delegate }, mandate: signed })
	addEvent({ actor: 'GridPlus', title: 'Agent mandate signed', detail: `Agent can spend up to ${input.maxTotalAtomic} atomic MockUSDC, capped at ${input.maxPerPaymentAtomic} per request.`, status: 'success' })
	return c.json({ mandate: signed, state: hydratedState() })
})

routes.post('/mandates/revoke', (c) => {
	const current = getActiveMandate()
	patchState({ mandate: { ...current, revoked: true } })
	addEvent({ actor: 'Owner', title: 'Mandate revoked', detail: 'Future agent payments are blocked.', status: 'warning' })
	return c.json({ state: hydratedState() })
})

routes.post('/agent/run-valid-demo', async (c) => c.json(await runAgentDemo('valid')))
routes.post('/agent/run-blocked-demo', async (c) => c.json(await runAgentDemo('blocked')))
routes.post('/agent/run-revoked-demo', async (c) => c.json(await runAgentDemo('revoked')))
routes.post('/agent/run-event-demo', async (c) => c.json(await runEventIntelligenceDemo(runEventIntelligenceRequestSchema.parse(await jsonBody(c)))))

routes.get('/service/research', (c) => {
	const challenge = requestSignalChallenge(DEFAULT_MARKET_ID)
	return c.json(challenge, 402)
})

routes.get('/debug/payment-id', (c) => c.json({ paymentId: `0x${randomBytes(32).toString('hex')}` }))
