import { randomUUID } from 'node:crypto'
import { DEMO_SERVICE, demoStateSchema, MONAD_MAINNET, type AgentName, type AgentStatus, type AuditEvent, type DemoState } from '@gridplus-monad-agent-vault/shared'
import { config } from './config'
import { rpcConfigured } from './monad'

const initialAgents: Record<AgentName, AgentStatus> = {
	ResearchAgent: 'idle',
	PaymentAgent: 'idle',
	VerifierAgent: 'idle',
	PolicyGuard: 'idle',
}

const defaultState: DemoState = demoStateSchema.parse({
	network: MONAD_MAINNET.caip2,
	rpcConfigured,
	gridplus: {
		connectRelayUrl: config.GRIDPLUS_BASE_URL,
		simulatorUrl: config.GRIDPLUS_SIMULATOR_URL,
		simulatorMqttWsUrl: config.GRIDPLUS_SIMULATOR_MQTT_WS_URL,
		simulatorProvisionUrl: config.GRIDPLUS_SIMULATOR_PROVISION_URL,
	},
	device: {
		mode: config.GRIDPLUS_SIGNER_MODE,
		paired: false,
		owner: null,
		deviceId: config.GRIDPLUS_DEVICE_ID ?? null,
		appName: config.GRIDPLUS_APP_NAME,
	},
	vault: {
		delegate: config.AGENT_VAULT_DELEGATE_ADDRESS ?? null,
		delegated: false,
		authorizationTxHash: null,
		clearDelegationTxHash: null,
	},
	mandate: null,
	agents: initialAgents,
	events: [],
	lastChallenge: null,
	lastPolicyDecision: null,
	lastServiceResult: null,
	lastTxHash: null,
	lastTestSignature: null,
})

let state = defaultState

export function getState(): DemoState {
	return state
}

export function setState(next: DemoState): DemoState {
	state = demoStateSchema.parse(next)
	return state
}

export function patchState(patch: Partial<DemoState>): DemoState {
	return setState({ ...state, ...patch })
}

export function resetAgents(): void {
	state = { ...state, agents: initialAgents }
}

export function setAgentStatus(agent: AgentName, status: AgentStatus): void {
	state = {
		...state,
		agents: {
			...state.agents,
			[agent]: status,
		},
	}
}

export function addEvent(event: Omit<AuditEvent, 'id' | 'at'>): AuditEvent {
	const nextEvent: AuditEvent = {
		id: randomUUID(),
		at: new Date().toISOString(),
		...event,
	}
	state = {
		...state,
		events: [nextEvent, ...state.events].slice(0, 80),
	}
	return nextEvent
}

export function getActiveMandate() {
	if (!state.mandate) {
		throw new Error('No active mandate. Sign a mandate before running the agent.')
	}
	return state.mandate
}

export function getServicePaymentDefaults() {
	return {
		merchant: DEMO_SERVICE.merchant,
		token: MONAD_MAINNET.usdc.address,
		serviceHash: DEMO_SERVICE.serviceHash,
	}
}
