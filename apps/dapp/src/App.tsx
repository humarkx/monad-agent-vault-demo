import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Bot, Brain, CheckCircle2, CircleDollarSign, Database, ExternalLink, FileJson, KeyRound, MessageSquareText, Play, PlugZap, RefreshCw, ShieldCheck, ShieldOff, Trash2, WalletCards, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MONAD_NETWORK, type AgentRun, type AuditEvent, type DemoState, type RegisteredAgent, type RegistryMarket } from '@gridplus-monad-agent-vault/shared'
import { API_BASE_URL, formatError, getState, postAction } from './api'
import { BackgroundPattern } from './components/ui/background-pattern'
import { Badge } from './components/ui/badge'
import { Button, buttonVariants } from './components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'
import { Spinner } from './components/ui/spinner'
import { StatusPill, type StatusPillTone } from './components/ui/status-pill'
import { cn } from './lib/utils'

const short = (value: string | null | undefined) => (value ? `${value.slice(0, 6)}...${value.slice(-4)}` : 'Not set')
const compactUrl = (value: string) => value.replace(/^(https?|wss?):\/\//, '')
const percent = (value: number | null | undefined) => (typeof value === 'number' ? `${Math.round(value * 100)}%` : 'Not set')
const edge = (value: number | null | undefined) => (typeof value === 'number' ? `${value > 0 ? '+' : ''}${(value / 100).toFixed(1)}%` : 'Not set')

const formatAtomicCollateral = (value: string | null | undefined) => {
	if (!value) return '0.000000 MockUSDC'
	const raw = BigInt(value)
	const whole = raw / 1_000_000n
	const fraction = (raw % 1_000_000n).toString().padStart(6, '0')
	return `${whole}.${fraction} MockUSDC`
}

const formatTime = (value: string | null | undefined) => {
	if (!value) return 'Not set'
	return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const deviceModeLabel = (mode: DemoState['device']['mode']) => (mode === 'device' ? 'Device' : 'Local signer')

const statusTone = (status: string): StatusPillTone => {
	if (status === 'active' || status === 'success' || status === 'complete' || status === 'approved') return 'success'
	if (status === 'dry-run' || status === 'running') return 'info'
	if (status === 'paused' || status === 'warning') return 'warning'
	if (status === 'revoked' || status === 'blocked' || status === 'error') return 'danger'
	return 'neutral'
}

const TIMELINE_DOT: Record<string, string> = {
	success: 'bg-emerald-400',
	warning: 'bg-amber-400',
	error: 'bg-rose-400',
}

function ExternalLinkButton({ href, children }: { href: string; children: ReactNode }) {
	return (
		<a className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))} href={href} rel="noreferrer" target="_blank">
			<ExternalLink aria-hidden="true" />
			<span>{children}</span>
		</a>
	)
}

function ActionButton({
	children,
	icon: Icon,
	onClick,
	disabled = false,
	variant = 'default',
	className,
}: {
	children: ReactNode
	icon: LucideIcon
	onClick: () => void
	disabled?: boolean
	variant?: 'default' | 'secondary' | 'outline' | 'destructive'
	className?: string
}) {
	return (
		<Button type="button" size="lg" variant={variant} disabled={disabled} onClick={onClick} className={cn('justify-start', className)}>
			<Icon aria-hidden="true" />
			<span>{children}</span>
		</Button>
	)
}

function Metric({ label, value, detail, mono = true }: { label: string; value: string; detail?: string; mono?: boolean }) {
	return (
		<div className="rounded-lg border border-border/60 bg-muted/20 p-3">
			<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
			<p className={cn('mt-1 break-words text-sm font-medium text-foreground', mono && 'font-mono')}>{value}</p>
			{detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
		</div>
	)
}

function DetailItem({ label, value, href }: { label: string; value: string; href?: string }) {
	return (
		<div className="min-w-0 rounded-lg border border-border/60 bg-background/40 p-3">
			<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
			<p className="mt-1 break-words font-mono text-sm font-medium text-foreground">{value}</p>
			{href ? (
				<a className="mt-1 inline-block text-xs font-medium text-primary hover:underline" href={href} rel="noreferrer" target="_blank">
					View on Monadscan
				</a>
			) : null}
		</div>
	)
}

function JsonPreview({ label, value }: { label: string; value: unknown }) {
	return (
		<div className="rounded-lg border border-border/60 bg-background/40 p-3">
			<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
			<pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">{JSON.stringify(value, null, 2)}</pre>
		</div>
	)
}

function Timeline({ events }: { events: AuditEvent[] }) {
	if (events.length === 0) {
		return <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">No events yet.</div>
	}
	return (
		<div className="space-y-4">
			{events.map((event) => (
				<div className="grid grid-cols-[14px_1fr] gap-3" key={event.id}>
					<span className={cn('mt-1.5 size-2.5 rounded-full shadow-[0_0_8px_currentColor]', TIMELINE_DOT[event.status] ?? 'bg-sky-400')} />
					<div className="min-w-0">
						<div className="flex items-baseline justify-between gap-3">
							<p className="text-sm font-medium text-foreground">{event.title}</p>
							<span className="shrink-0 text-xs text-muted-foreground">{new Date(event.at).toLocaleTimeString()}</span>
						</div>
						<p className="mt-1 text-sm text-muted-foreground">{event.detail}</p>
						{event.txHash ? (
							<a className="mt-1 inline-block font-mono text-xs font-medium text-primary hover:underline" href={MONAD_NETWORK.explorer.txUrl(event.txHash)} rel="noreferrer" target="_blank">
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
	const ownerUrl = owner ? MONAD_NETWORK.explorer.addressUrl(owner) : undefined
	return (
		<div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
			<div className="flex items-center gap-3">
				<span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
					<CheckCircle2 aria-hidden="true" className="size-5" />
				</span>
				<div className="min-w-0 flex-1">
					<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">GridPlus device paired</p>
					<p className="truncate text-sm font-medium text-foreground">{state.device.deviceId ?? 'Hosted device'}</p>
					<p className="truncate text-xs text-muted-foreground">{state.device.appName ?? 'Monad Agent Vault Demo'}</p>
				</div>
				<Badge variant="secondary" className="border border-emerald-500/40 bg-emerald-500/15 text-emerald-200">
					Ready
				</Badge>
			</div>
			<div className="grid gap-2 sm:grid-cols-3">
				<DetailItem label="Owner signer" value={short(owner)} href={ownerUrl} />
				<DetailItem label="Relay" value={compactUrl(state.gridplus.connectRelayUrl)} />
				<DetailItem label="Simulator MQTT" value={compactUrl(state.gridplus.simulatorMqttWsUrl)} />
			</div>
			<div className="flex flex-wrap gap-2">
				<ExternalLinkButton href={state.gridplus.simulatorUrl}>Open hosted device</ExternalLinkButton>
				<ActionButton icon={RefreshCw} variant="outline" onClick={onReset} disabled={busy}>
					Reset session
				</ActionButton>
			</div>
		</div>
	)
}

function AgentRegistryTable({
	agents,
	markets,
	selectedAgentId,
	onSelect,
}: {
	agents: RegisteredAgent[]
	markets: RegistryMarket[]
	selectedAgentId: string | null
	onSelect: (agentId: string) => void
}) {
	const marketTitle = (marketId: string) => markets.find((market) => market.marketId === marketId)?.title ?? marketId
	if (agents.length === 0) {
		return <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">No agents registered.</div>
	}
	return (
		<div className="overflow-hidden rounded-lg border border-border/60">
			<div className="grid grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_0.7fr] gap-3 border-b border-border/60 bg-muted/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
				<span>Agent</span>
				<span>User</span>
				<span>Market</span>
				<span>Budget</span>
				<span>Spent</span>
				<span>Status</span>
			</div>
			<div className="divide-y divide-border/60">
				{agents.map((agent) => (
					<button
						type="button"
						key={agent.agentId}
						onClick={() => onSelect(agent.agentId)}
						className={cn('grid w-full grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_0.7fr] gap-3 px-3 py-3 text-left text-sm transition hover:bg-muted/25', selectedAgentId === agent.agentId && 'bg-primary/10')}
					>
						<span className="min-w-0">
							<span className="block truncate font-medium text-foreground">{agent.name}</span>
							<span className="block truncate text-xs text-muted-foreground">{agent.lastDecision ?? 'No run'}</span>
						</span>
						<span className="truncate font-mono text-muted-foreground">{short(agent.ownerAddress)}</span>
						<span className="truncate text-muted-foreground">{marketTitle(agent.marketId)}</span>
						<span className="truncate font-mono text-muted-foreground">{formatAtomicCollateral(agent.budgetAtomic)}</span>
						<span className="truncate font-mono text-muted-foreground">{formatAtomicCollateral(agent.spentAtomic)}</span>
						<span>
							<Badge variant={agent.status === 'active' ? 'secondary' : 'outline'}>{agent.status}</Badge>
						</span>
					</button>
				))}
			</div>
		</div>
	)
}

function DecisionPanel({ run }: { run: AgentRun | null }) {
	if (!run) {
		return <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">No agent run recorded for the selected agent.</div>
	}
	return (
		<div className="space-y-3">
			<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
				<Metric label="Decision" value={run.decision} detail={run.decisionReason} mono={false} />
				<Metric label="Run status" value={run.status} detail={formatTime(run.createdAt)} mono={false} />
				<Metric label="Trade side" value={run.tradeSide ?? 'None'} detail={formatAtomicCollateral(run.tradeAmountAtomic)} mono={false} />
				<Metric label="Transaction" value={short(run.txHash)} detail={run.txHash ? 'Live testnet tx' : 'No tx submitted'} />
			</div>
			{run.contextSnapshot ? (
				<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
					<Metric label="Model FOR" value={percent(run.contextSnapshot.modelProbabilityFor)} detail={run.contextSnapshot.matchState} mono={false} />
					<Metric label="AMM FOR" value={percent(run.contextSnapshot.ammPriceFor)} detail={`${run.contextSnapshot.minute}' · ${run.contextSnapshot.score}`} mono={false} />
					<Metric label="Edge" value={edge(run.contextSnapshot.edgeBps)} detail={run.contextSnapshot.headline} mono={false} />
					<Metric label="Confidence" value={percent(run.contextSnapshot.confidence)} detail={run.contextSnapshot.source} mono={false} />
				</div>
			) : null}
			<div className="grid gap-2 lg:grid-cols-2">
				<JsonPreview label="Context payload" value={run.contextSnapshot ?? { status: 'not fetched' }} />
				<JsonPreview label="Agent trace" value={run.llmTrace ?? { status: run.error ?? 'not available' }} />
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
	const [testMessage, setTestMessage] = useState('Hello World')
	const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
	const [busy, setBusy] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const loadState = async () => {
		try {
			const next = await getState()
			setState(next)
			setSelectedAgentId((current) => current ?? next.registeredAgents[0]?.agentId ?? null)
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

	const selectedAgent = useMemo(() => state?.registeredAgents.find((agent) => agent.agentId === selectedAgentId) ?? state?.registeredAgents[0] ?? null, [selectedAgentId, state?.registeredAgents])
	const selectedMarket = useMemo(() => state?.registryMarkets.find((market) => market.marketId === selectedAgent?.marketId) ?? state?.registryMarkets[0] ?? null, [selectedAgent?.marketId, state?.registryMarkets])
	const selectedRuns = useMemo(() => state?.agentRuns.filter((run) => run.agentId === selectedAgent?.agentId) ?? [], [selectedAgent?.agentId, state?.agentRuns])
	const selectedRun = selectedRuns[0] ?? null
	const selectedDeviceId = deviceId || state?.device.deviceId || ''
	const selectedAppName = appName || state?.device.appName || 'Monad Agent Vault Demo'
	const selectedRemaining = selectedAgent ? (BigInt(selectedAgent.budgetAtomic) - BigInt(selectedAgent.spentAtomic)).toString() : null

	if (!state) {
		return (
			<main className="relative grid min-h-svh w-full place-items-center text-foreground">
				<BackgroundPattern />
				<div className="relative z-10 flex flex-col items-center gap-3 text-center">
					<Spinner className="size-6 text-primary" />
					<p className="text-sm text-muted-foreground">Loading agent registry…</p>
					{error ? <p className="max-w-md text-sm text-destructive">{error}</p> : null}
				</div>
			</main>
		)
	}

	return (
		<main className="relative min-h-svh w-full text-foreground">
			<BackgroundPattern />

			<div className="relative z-10 mx-auto w-full max-w-6xl space-y-6 px-6 py-10">
				<header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">GridPlus × Monad</p>
						<h1 className="text-glow text-4xl font-bold tracking-tight sm:text-5xl">Agent Vault</h1>
						<p className="mt-3 max-w-2xl text-balance text-sm text-muted-foreground sm:text-base">
							SQLite-registered agents fetch market context APIs and execute bounded prediction-market decisions through a GridPlus-controlled EIP-7702 wallet.
						</p>
					</div>
					<div className="flex flex-wrap gap-2 md:justify-end">
						<StatusPill tone="info" label={MONAD_NETWORK.caip2} />
						<StatusPill tone={state.rpcConfigured ? 'success' : 'warning'} label={state.rpcConfigured ? 'RPC ready' : 'RPC missing'} />
						<StatusPill tone={state.registryMarkets.length > 0 ? 'success' : 'warning'} label={`${state.registryMarkets.length} market${state.registryMarkets.length === 1 ? '' : 's'}`} />
					</div>
				</header>

				{error ? (
					<div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
						<AlertTriangle className="size-4 shrink-0" />
						<span className="break-words">{error}</span>
					</div>
				) : null}

				<section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
					<Card>
						<CardHeader>
							<p className="text-xs font-semibold uppercase tracking-widest text-primary">Controls</p>
							<CardTitle className="text-lg">Run the agent story</CardTitle>
							<CardDescription>Device pairing, EIP-7702 delegation, agent run, revoke, and cleanup.</CardDescription>
							<CardAction>
								<Badge variant={state.device.paired ? 'secondary' : 'outline'}>{deviceModeLabel(state.device.mode)}</Badge>
							</CardAction>
						</CardHeader>
						<CardContent className="space-y-4">
							{state.device.paired ? (
								<PairedDeviceCard state={state} busy={Boolean(busy)} onReset={() => run('reset-session', () => postAction('/device/reset-session'))} />
							) : (
								<div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
									<div className="grid gap-2 sm:grid-cols-2">
										<Input aria-label="GridPlus device ID" placeholder="Device ID" value={deviceId} onChange={(event) => setDeviceId(event.target.value)} />
										<Input aria-label="GridPlus app name" placeholder="App name" value={appName} onChange={(event) => setAppName(event.target.value)} />
									</div>
									<div className="flex flex-wrap gap-2">
										<ExternalLinkButton href={state.gridplus.simulatorUrl}>Open hosted device</ExternalLinkButton>
										<ActionButton
											icon={PlugZap}
											onClick={() => run('connect', () => postAction('/device/setup', { mode: 'device', deviceId: selectedDeviceId, appName: selectedAppName }))}
											disabled={Boolean(busy) || !selectedDeviceId}
										>
											Connect device
										</ActionButton>
									</div>
									<div className="flex flex-wrap gap-2">
										<Input className="min-w-[200px] flex-1" aria-label="Pairing code" placeholder="Pairing code from device" value={pairingCode} onChange={(event) => setPairingCode(event.target.value)} />
										<ActionButton icon={KeyRound} variant="outline" onClick={() => run('pair', () => postAction('/device/pair', { pairingCode }))} disabled={Boolean(busy) || !pairingCode}>
											Pair device
										</ActionButton>
									</div>
								</div>
							)}

							<div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
								<div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
									<div>
										<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Test signature</p>
										<p className="text-sm text-muted-foreground">Readable ASCII signing path.</p>
									</div>
									<Badge variant={state.lastTestSignature ? 'secondary' : 'outline'}>{state.lastTestSignature ? 'Signed' : 'Ready'}</Badge>
								</div>
								<div className="flex flex-wrap gap-2">
									<Input className="min-w-[220px] flex-1" aria-label="Test message" value={testMessage} onChange={(event) => setTestMessage(event.target.value)} />
									<ActionButton icon={MessageSquareText} variant="outline" onClick={() => run('test-sign', () => postAction('/device/sign-test', { message: testMessage }))} disabled={Boolean(busy) || !state.device.owner || !testMessage.trim()}>
										Sign test message
									</ActionButton>
								</div>
								{state.lastTestSignature ? (
									<div className="rounded-lg border border-border/60 bg-background/40 p-3">
										<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Signed payload</p>
										<pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">{state.lastTestSignature.payload}</pre>
									</div>
								) : null}
							</div>

							<div className="flex flex-wrap gap-2">
								<Input className="min-w-[220px] flex-1" aria-label="Delegate contract" placeholder="Optional AgentVaultDelegate address" value={delegate} onChange={(event) => setDelegate(event.target.value)} />
								<ActionButton icon={KeyRound} onClick={() => run('authorize', () => postAction('/vault/authorize-7702', delegate ? { delegate } : {}))} disabled={Boolean(busy) || !state.device.owner}>
									Enable delegation
								</ActionButton>
							</div>

							<div className="grid gap-2 sm:grid-cols-2">
								<ActionButton icon={ShieldCheck} variant="outline" onClick={() => run('mandate', () => postAction('/mandates/sign', { maxTotalAtomic: '10000000', maxPerPaymentAtomic: '1000000', expiresInSeconds: 3600 }))} disabled={Boolean(busy) || !state.device.owner}>
									Sign mandate
								</ActionButton>
								<ActionButton icon={Play} onClick={() => selectedAgent && run('agent-run', () => postAction(`/agents/${selectedAgent.agentId}/run`, { mode: 'dry-run' }))} disabled={Boolean(busy) || !selectedAgent}>
									Run selected agent
								</ActionButton>
								<ActionButton icon={Brain} variant="outline" onClick={() => run('runner-tick', () => postAction('/runner/tick', { mode: 'dry-run' }))} disabled={Boolean(busy)}>
									Run due agents
								</ActionButton>
								<ActionButton icon={ShieldOff} variant="outline" onClick={() => selectedAgent && run('revoke-agent', () => postAction(`/agents/${selectedAgent.agentId}/revoke`))} disabled={Boolean(busy) || !selectedAgent || selectedAgent.status === 'revoked'}>
									Revoke selected
								</ActionButton>
								<ActionButton icon={Trash2} variant="destructive" onClick={() => run('revoke', () => postAction('/mandates/revoke'))} disabled={Boolean(busy) || !state.mandate}>
									Revoke mandate
								</ActionButton>
								<ActionButton icon={RefreshCw} variant="outline" onClick={() => run('clear', () => postAction('/vault/clear-delegation'))} disabled={Boolean(busy) || !state.device.owner}>
									Clear delegation
								</ActionButton>
							</div>

							{busy ? (
								<p className="flex items-center gap-2 text-sm text-muted-foreground">
									<Spinner className="size-3.5" />
									Running {busy}…
								</p>
							) : null}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<p className="text-xs font-semibold uppercase tracking-widest text-primary">Vault</p>
							<CardTitle className="text-lg">Testnet status</CardTitle>
							<CardDescription>Device, delegation, API, and selected-agent budget state.</CardDescription>
							<CardAction>
								<span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
									<WalletCards className="size-5" />
								</span>
							</CardAction>
						</CardHeader>
						<CardContent>
							<div className="grid gap-2 sm:grid-cols-2">
								<Metric label="Owner EOA" value={short(state.device.owner)} detail={state.device.paired ? `${state.device.deviceId ?? 'Device'} paired` : 'Connect required'} />
								<Metric label="Delegate" value={short(state.vault.delegate)} detail={state.vault.delegated ? 'Active code detected/submitted' : 'Not active'} />
								<Metric label="Selected budget left" value={formatAtomicCollateral(selectedRemaining)} detail={selectedAgent?.status ?? 'No agent'} />
								<Metric label="Demo API" value={compactUrl(API_BASE_URL)} detail="Standalone orchestration backend" />
								<Metric label="SQLite markets" value={String(state.registryMarkets.length)} detail="Local backend database" mono={false} />
								<Metric label="Agent runs" value={String(state.agentRuns.length)} detail="Persisted runner traces" mono={false} />
								<Metric label="Device relay" value={compactUrl(state.gridplus.connectRelayUrl)} detail="Production GridPlus signing relay" />
								<Metric label="Simulator MQTT" value={compactUrl(state.gridplus.simulatorMqttWsUrl)} detail="Production Web MQTT broker" />
							</div>
						</CardContent>
					</Card>
				</section>

				<Card>
					<CardHeader>
						<p className="text-xs font-semibold uppercase tracking-widest text-primary">Registry</p>
						<CardTitle className="text-lg">Agent Registry</CardTitle>
						<CardDescription>SQLite-backed agents with owner, market, prompt, budget, spent amount, and status.</CardDescription>
						<CardAction>
							<span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
								<Database className="size-5" />
							</span>
						</CardAction>
					</CardHeader>
					<CardContent>
						<AgentRegistryTable agents={state.registeredAgents} markets={state.registryMarkets} selectedAgentId={selectedAgent?.agentId ?? null} onSelect={setSelectedAgentId} />
					</CardContent>
				</Card>

				<section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
					<Card>
						<CardHeader>
							<p className="text-xs font-semibold uppercase tracking-widest text-primary">Agent</p>
							<CardTitle className="text-lg">{selectedAgent?.name ?? 'No agent selected'}</CardTitle>
							<CardDescription>{selectedMarket?.title ?? 'No market selected'}</CardDescription>
							<CardAction>{selectedAgent ? <StatusPill tone={statusTone(selectedAgent.status)} label={selectedAgent.status} /> : null}</CardAction>
						</CardHeader>
						<CardContent className="space-y-3">
							{selectedAgent ? (
								<>
									<div className="grid gap-2 sm:grid-cols-2">
										<Metric label="Owner" value={short(selectedAgent.ownerAddress)} />
										<Metric label="Delegated EOA" value={short(selectedAgent.delegatedEoa)} />
										<Metric label="Budget" value={formatAtomicCollateral(selectedAgent.budgetAtomic)} />
										<Metric label="Spent" value={formatAtomicCollateral(selectedAgent.spentAtomic)} />
										<Metric label="Max trade" value={formatAtomicCollateral(selectedAgent.maxTradeAtomic)} />
										<Metric label="Next run" value={formatTime(selectedAgent.nextRunAt)} mono={false} />
									</div>
									<div className="rounded-lg border border-border/60 bg-muted/20 p-3">
										<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Prompt</p>
										<p className="mt-2 text-sm leading-relaxed text-foreground">{selectedAgent.prompt}</p>
									</div>
									<div className="grid gap-2 sm:grid-cols-2">
										<Metric label="Prompt hash" value={selectedAgent.promptHash} />
										<Metric label="Prompt URI" value={selectedAgent.promptUri} />
										<Metric label="Market address" value={short(selectedMarket?.marketAddress)} detail={selectedMarket?.marketAddress ? 'Verified before live mode' : 'Awaiting testnet deployment'} />
										<Metric label="Context API" value={selectedMarket?.contextApiUrl ?? 'Not set'} />
									</div>
								</>
							) : (
								<div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">Select an agent from the registry.</div>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<p className="text-xs font-semibold uppercase tracking-widest text-primary">Decision</p>
							<CardTitle className="text-lg">Latest run</CardTitle>
							<CardDescription>Fetched context, prompt trace, decision, trade side, and execution status.</CardDescription>
							<CardAction>
								<span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
									<FileJson className="size-5" />
								</span>
							</CardAction>
						</CardHeader>
						<CardContent>
							<DecisionPanel run={selectedRun} />
						</CardContent>
					</Card>
				</section>

				<Card>
					<CardHeader>
						<p className="text-xs font-semibold uppercase tracking-widest text-primary">Runner</p>
						<CardTitle className="text-lg">Execution board</CardTitle>
						<CardDescription>Current backend runner stages for the latest action.</CardDescription>
						<CardAction>
							<span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
								<CircleDollarSign className="size-5" />
							</span>
						</CardAction>
					</CardHeader>
					<CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
						{Object.entries(state.agents).map(([name, status]) => (
							<div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3" key={name}>
								<span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', status === 'complete' || status === 'approved' ? 'bg-emerald-500/15 text-emerald-300' : status === 'blocked' || status === 'error' ? 'bg-rose-500/15 text-rose-300' : 'bg-muted text-muted-foreground')}>
									{status === 'complete' || status === 'approved' ? <CheckCircle2 className="size-4" /> : status === 'blocked' || status === 'error' ? <XCircle className="size-4" /> : <Bot className="size-4" />}
								</span>
								<div className="min-w-0">
									<p className="truncate text-sm font-medium text-foreground">{name}</p>
									<p className="text-xs capitalize text-muted-foreground">{status}</p>
								</div>
							</div>
						))}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<p className="text-xs font-semibold uppercase tracking-widest text-primary">Audit</p>
						<CardTitle className="text-lg">Timeline</CardTitle>
						<CardDescription>Device signatures, registry reads, context fetches, decisions, revokes, and cleanup actions.</CardDescription>
					</CardHeader>
					<CardContent>
						<Timeline events={state.events} />
					</CardContent>
				</Card>
			</div>
		</main>
	)
}
