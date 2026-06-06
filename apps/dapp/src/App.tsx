import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Bot, CheckCircle2, CircleDollarSign, ExternalLink, KeyRound, Play, PlugZap, RefreshCw, ShieldCheck, ShieldOff, Trash2, WalletCards, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MONAD_MAINNET, type AgentName, type AuditEvent, type DemoState } from '@gridplus-monad-agent-vault/shared'
import { API_BASE_URL, formatError, getState, postAction } from './api'

const short = (value: string | null | undefined) => (value ? `${value.slice(0, 6)}...${value.slice(-4)}` : 'Not set')
const compactUrl = (value: string) => value.replace(/^(https?|wss?):\/\//, '')

const formatAtomicUsdc = (value: string | null | undefined) => {
	if (!value) return '0.000000 USDC'
	const raw = BigInt(value)
	const whole = raw / 1_000_000n
	const fraction = (raw % 1_000_000n).toString().padStart(6, '0')
	return `${whole}.${fraction} USDC`
}

const agentOrder: AgentName[] = ['ResearchAgent', 'PaymentAgent', 'PolicyGuard', 'VerifierAgent']
const deviceModeLabel = (mode: DemoState['device']['mode']) => (mode === 'device' ? 'Device' : 'Local signer')

function StatusPill({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'neutral'; children: ReactNode }) {
	return <span className={`status-pill ${tone}`}>{children}</span>
}

function IconButton({ children, icon: Icon, onClick, disabled = false, variant = 'primary' }: { children: ReactNode; icon: LucideIcon; onClick: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'danger' }) {
	return (
		<button className={`action-button ${variant}`} disabled={disabled} type="button" onClick={onClick}>
			<Icon aria-hidden="true" size={18} />
			<span>{children}</span>
		</button>
	)
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
	return (
		<div className="metric">
			<span>{label}</span>
			<strong>{value}</strong>
			{detail ? <small>{detail}</small> : null}
		</div>
	)
}

function DetailItem({ label, value, href }: { label: string; value: string; href?: string }) {
	return (
		<div className="detail-item">
			<span>{label}</span>
			<strong>{value}</strong>
			{href ? (
				<a href={href} rel="noreferrer" target="_blank">
					View on Monadscan
				</a>
			) : null}
		</div>
	)
}

function AgentCard({ name, status }: { name: AgentName; status: string }) {
	const icon = status === 'complete' || status === 'approved' ? <CheckCircle2 size={18} /> : status === 'blocked' || status === 'error' ? <XCircle size={18} /> : <Bot size={18} />
	return (
		<div className={`agent-card ${status}`}>
			<div>{icon}</div>
			<strong>{name}</strong>
			<span>{status}</span>
		</div>
	)
}

function Timeline({ events }: { events: AuditEvent[] }) {
	if (events.length === 0) {
		return <div className="empty-state">No events yet. Connect a device to start the demo.</div>
	}
	return (
		<div className="timeline">
			{events.map((event) => (
				<div className={`timeline-row ${event.status}`} key={event.id}>
					<div className="timeline-dot" />
					<div>
						<div className="timeline-heading">
							<strong>{event.title}</strong>
							<span>{new Date(event.at).toLocaleTimeString()}</span>
						</div>
						<p>{event.detail}</p>
						{event.txHash ? (
							<a href={MONAD_MAINNET.explorer.txUrl(event.txHash)} rel="noreferrer" target="_blank">
								{short(event.txHash)}
							</a>
						) : null}
					</div>
				</div>
			))}
		</div>
	)
}

function PairedDeviceCard({ state, busy, onReset }: { state: DemoState; busy: boolean; onReset: () => void }) {
	const owner = state.device.owner
	const ownerUrl = owner ? MONAD_MAINNET.explorer.addressUrl(owner) : undefined
	return (
		<div className="paired-card">
			<div className="paired-card-header">
				<div className="paired-icon">
					<CheckCircle2 aria-hidden="true" size={22} />
				</div>
				<div>
					<span>GridPlus device paired</span>
					<strong>{state.device.deviceId ?? 'Hosted device'}</strong>
					<small>{state.device.appName ?? 'Monad Agent Vault Demo'}</small>
				</div>
				<StatusPill tone="good">Ready</StatusPill>
			</div>
			<div className="detail-grid">
				<DetailItem label="Owner signer" value={short(owner)} href={ownerUrl} />
				<DetailItem label="Relay" value={compactUrl(state.gridplus.connectRelayUrl)} />
				<DetailItem label="Simulator MQTT" value={compactUrl(state.gridplus.simulatorMqttWsUrl)} />
			</div>
			<div className="paired-actions">
				<a className="action-link secondary" href={state.gridplus.simulatorUrl} rel="noreferrer" target="_blank">
					<ExternalLink aria-hidden="true" size={18} />
					<span>Open hosted device</span>
				</a>
				<IconButton icon={RefreshCw} variant="secondary" onClick={onReset} disabled={busy}>
					Reset session
				</IconButton>
			</div>
		</div>
	)
}

export function App() {
	const [state, setState] = useState<DemoState | null>(null)
	const [delegate, setDelegate] = useState('')
	const [deviceId, setDeviceId] = useState('')
	const [appName, setAppName] = useState('Monad Agent Vault Demo')
	const [pairingCode, setPairingCode] = useState('')
	const [busy, setBusy] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const loadState = async () => {
		try {
			setState(await getState())
			setError(null)
		} catch (err) {
			setError(formatError(err))
		}
	}

	useEffect(() => {
		void loadState()
		const id = window.setInterval(() => void loadState(), 4000)
		return () => window.clearInterval(id)
	}, [])

	useEffect(() => {
		const onUnhandledRejection = (event: PromiseRejectionEvent) => {
			setError(formatError(event.reason))
			event.preventDefault()
		}
		window.addEventListener('unhandledrejection', onUnhandledRejection)
		return () => window.removeEventListener('unhandledrejection', onUnhandledRejection)
	}, [])

	useEffect(() => {
		if (state?.vault.delegate && !delegate) {
			setDelegate(state.vault.delegate)
		}
	}, [delegate, state?.vault.delegate])

	useEffect(() => {
		if (state?.device.deviceId && !deviceId) {
			setDeviceId(state.device.deviceId)
		}
		if (state?.device.appName && !appName) {
			setAppName(state.device.appName)
		}
	}, [appName, deviceId, state?.device.appName, state?.device.deviceId])

	const run = async (label: string, action: () => Promise<{ state?: DemoState } | DemoState>) => {
		setBusy(label)
		setError(null)
		try {
			const result = await action()
			if ('state' in result && result.state) {
				setState(result.state)
			} else {
				setState(result as DemoState)
			}
		} catch (err) {
			setError(formatError(err))
		} finally {
			setBusy(null)
		}
	}

	const remaining = useMemo(() => {
		if (!state?.mandate) return null
		return (BigInt(state.mandate.maxTotalAtomic) - BigInt(state.mandate.spentAtomic)).toString()
	}, [state?.mandate])

	const selectedDeviceId = deviceId || state?.device.deviceId || ''
	const selectedAppName = appName || state?.device.appName || 'Monad Agent Vault Demo'

	if (!state) {
		return (
			<div className="loading">
				<span>Loading Monad Agent Vault...</span>
				{error ? <small>{error}</small> : null}
			</div>
		)
	}

	return (
		<main className="app-shell">
			<section className="topbar">
				<div>
					<p className="eyebrow">GridPlus x Monad</p>
					<h1>Agent Vault</h1>
					<p className="subtitle">A mainnet-only EIP-7702 demo where GridPlus device-signed mandates control autonomous x402-style payments.</p>
				</div>
				<div className="network-panel">
					<StatusPill tone="good">{MONAD_MAINNET.caip2}</StatusPill>
					<StatusPill tone={state.rpcConfigured ? 'good' : 'warn'}>{state.rpcConfigured ? 'RPC ready' : 'RPC missing'}</StatusPill>
				</div>
			</section>

			{error ? (
				<div className="error-banner">
					<AlertTriangle size={18} />
					<span>{error}</span>
				</div>
			) : null}

			<section className="grid two">
				<div className="panel control-panel">
					<div className="panel-heading">
						<div>
							<p className="eyebrow">Controls</p>
							<h2>Run the live story</h2>
						</div>
						<StatusPill tone={state.device.paired ? 'good' : 'neutral'}>{deviceModeLabel(state.device.mode)}</StatusPill>
					</div>
					<div className="actions">
						{state.device.paired ? (
							<PairedDeviceCard state={state} busy={Boolean(busy)} onReset={() => run('reset-session', () => postAction('/device/reset-session'))} />
						) : (
							<div className="setup-card">
								<div className="setup-grid">
									<input aria-label="GridPlus device ID" placeholder="Device ID" value={deviceId} onChange={(event) => setDeviceId(event.target.value)} />
									<input aria-label="GridPlus app name" placeholder="App name" value={appName} onChange={(event) => setAppName(event.target.value)} />
									<a className="action-link secondary" href={state.gridplus.simulatorUrl} rel="noreferrer" target="_blank">
										<ExternalLink aria-hidden="true" size={18} />
										<span>Open hosted device</span>
									</a>
									<IconButton icon={PlugZap} onClick={() => run('connect', () => postAction('/device/setup', { mode: 'device', deviceId: selectedDeviceId, appName: selectedAppName }))} disabled={Boolean(busy) || !selectedDeviceId}>
										Connect device
									</IconButton>
								</div>
								<div className="pairing-row">
									<input aria-label="Pairing code" placeholder="Pairing code from device" value={pairingCode} onChange={(event) => setPairingCode(event.target.value)} />
									<IconButton icon={KeyRound} variant="secondary" onClick={() => run('pair', () => postAction('/device/pair', { pairingCode }))} disabled={Boolean(busy) || !pairingCode}>
										Pair device
									</IconButton>
								</div>
							</div>
						)}
						<div className="inline-input">
							<input aria-label="Delegate contract" placeholder="AgentVaultDelegate address" value={delegate} onChange={(event) => setDelegate(event.target.value)} />
							<IconButton icon={KeyRound} onClick={() => run('authorize', () => postAction('/vault/authorize-7702', delegate ? { delegate } : {}))} disabled={Boolean(busy) || !state.device.owner}>
								Enable vault
							</IconButton>
						</div>
						<IconButton icon={ShieldCheck} variant="secondary" onClick={() => run('mandate', () => postAction('/mandates/sign', { maxTotalAtomic: '50000', maxPerPaymentAtomic: '10000', expiresInSeconds: 3600 }))} disabled={Boolean(busy) || !state.vault.delegate}>
							Sign mandate
						</IconButton>
						<IconButton icon={Play} onClick={() => run('valid', () => postAction('/agent/run-valid-demo'))} disabled={Boolean(busy) || !state.mandate}>
							Run valid agent
						</IconButton>
						<IconButton icon={ShieldOff} variant="secondary" onClick={() => run('blocked', () => postAction('/agent/run-blocked-demo'))} disabled={Boolean(busy) || !state.mandate}>
							Run blocked agent
						</IconButton>
						<IconButton icon={Trash2} variant="danger" onClick={() => run('revoke', () => postAction('/mandates/revoke'))} disabled={Boolean(busy) || !state.mandate}>
							Revoke mandate
						</IconButton>
						<IconButton icon={RefreshCw} variant="secondary" onClick={() => run('clear', () => postAction('/vault/clear-delegation'))} disabled={Boolean(busy) || !state.device.owner}>
							Clear delegation
						</IconButton>
					</div>
					{busy ? <p className="busy">Running {busy}...</p> : null}
				</div>

				<div className="panel">
					<div className="panel-heading">
						<div>
							<p className="eyebrow">Vault</p>
							<h2>Mainnet status</h2>
						</div>
						<WalletCards size={24} />
					</div>
					<div className="metrics">
						<Metric label="Owner EOA" value={short(state.device.owner)} detail={state.device.paired ? `${state.device.deviceId ?? 'Device'} paired` : 'Connect required'} />
						<Metric label="Delegate" value={short(state.vault.delegate)} detail={state.vault.delegated ? 'Active code detected/submitted' : 'Not active'} />
						<Metric label="Budget left" value={formatAtomicUsdc(remaining)} detail={state.mandate?.revoked ? 'Revoked' : 'Mandate controlled'} />
						<Metric label="Demo API" value={compactUrl(API_BASE_URL)} detail="Standalone orchestration backend" />
						<Metric label="Device relay" value={compactUrl(state.gridplus.connectRelayUrl)} detail="Production GridPlus API path" />
						<Metric label="Simulator MQTT" value={compactUrl(state.gridplus.simulatorMqttWsUrl)} detail="Production Web MQTT broker" />
						<Metric label="Provision API" value={compactUrl(state.gridplus.simulatorProvisionUrl)} detail="Hosted device credentials" />
					</div>
				</div>
			</section>

			<section className="panel">
				<div className="panel-heading">
					<div>
						<p className="eyebrow">Agents</p>
						<h2>Workflow board</h2>
					</div>
					<CircleDollarSign size={24} />
				</div>
				<div className="agent-grid">
					{agentOrder.map((name) => (
						<AgentCard key={name} name={name} status={state.agents[name]} />
					))}
				</div>
				<div className="challenge-grid">
					<div>
						<span>x402-style challenge</span>
						<strong>{state.lastChallenge ? formatAtomicUsdc(state.lastChallenge.amountAtomic) : 'None'}</strong>
						<small>{state.lastChallenge?.resource ?? 'Run the valid agent to receive a 402 challenge.'}</small>
					</div>
					<div>
						<span>Policy decision</span>
						<strong>{state.lastPolicyDecision ? (state.lastPolicyDecision.allowed ? 'Approved' : 'Blocked') : 'Pending'}</strong>
						<small>{state.lastPolicyDecision?.reason ?? 'No policy check has run yet.'}</small>
					</div>
					<div>
						<span>Last payment</span>
						<strong>{short(state.lastTxHash)}</strong>
						<small>{state.lastTxHash ? 'Monad explorer link is in the timeline.' : 'No payment transaction yet.'}</small>
					</div>
				</div>
			</section>

			<section className="panel">
				<div className="panel-heading">
					<div>
						<p className="eyebrow">Audit</p>
						<h2>Timeline</h2>
					</div>
				</div>
				<Timeline events={state.events} />
			</section>
		</main>
	)
}
