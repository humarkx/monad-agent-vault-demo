import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Bot, Brain, CheckCircle2, CircleDollarSign, ExternalLink, FileJson, KeyRound, MessageSquareText, Play, PlugZap, RefreshCw, ShieldCheck, ShieldOff, Trash2, WalletCards, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { DEFAULT_MARKET_ID, MONAD_MAINNET, type AgentName, type AuditEvent, type DemoState } from '@gridplus-monad-agent-vault/shared'
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
const formatProbability = (value: number | null | undefined) => (typeof value === 'number' ? `${Math.round(value * 100)}%` : 'Not set')
const formatEdge = (value: number | null | undefined) => (typeof value === 'number' ? `${value > 0 ? '+' : ''}${(value / 100).toFixed(1)}%` : 'Not set')

const formatAtomicUsdc = (value: string | null | undefined) => {
	if (!value) return '0.000000 USDC'
	const raw = BigInt(value)
	const whole = raw / 1_000_000n
	const fraction = (raw % 1_000_000n).toString().padStart(6, '0')
	return `${whole}.${fraction} USDC`
}

const agentOrder: AgentName[] = ['ScoutAgent', 'PaymentAgent', 'PolicyGuard', 'SignalAgent', 'DecisionAgent', 'ResultPoster']
const agentLabels: Record<AgentName, string> = {
	ScoutAgent: 'Scout Agent',
	PaymentAgent: 'Payment Agent',
	PolicyGuard: 'Policy Guard',
	SignalAgent: 'Signal Agent',
	DecisionAgent: 'Decision Agent',
	ResultPoster: 'Result Poster',
}
const deviceModeLabel = (mode: DemoState['device']['mode']) => (mode === 'device' ? 'Device' : 'Local signer')

const agentTone = (status: string): StatusPillTone => {
	if (status === 'complete' || status === 'approved') return 'success'
	if (status === 'blocked' || status === 'error') return 'danger'
	if (status === 'running') return 'info'
	return 'neutral'
}

const AGENT_TONE_CLASSES: Record<StatusPillTone, { border: string; chip: string }> = {
	neutral: { border: 'border-border/60', chip: 'bg-muted text-muted-foreground' },
	info: { border: 'border-sky-500/40', chip: 'bg-sky-500/15 text-sky-300' },
	success: { border: 'border-emerald-500/40', chip: 'bg-emerald-500/15 text-emerald-300' },
	warning: { border: 'border-amber-500/40', chip: 'bg-amber-500/15 text-amber-300' },
	danger: { border: 'border-rose-500/40', chip: 'bg-rose-500/15 text-rose-300' },
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

function AgentCard({ name, status }: { name: AgentName; status: string }) {
	const tone = agentTone(status)
	const toneClasses = AGENT_TONE_CLASSES[tone]
	const icon = status === 'complete' || status === 'approved' ? <CheckCircle2 className="size-4" /> : status === 'blocked' || status === 'error' ? <XCircle className="size-4" /> : <Bot className="size-4" />
	return (
		<div className={cn('flex items-center gap-3 rounded-lg border bg-muted/20 p-3', toneClasses.border)}>
			<span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', toneClasses.chip)}>{icon}</span>
			<div className="min-w-0">
				<p className="truncate text-sm font-medium text-foreground">{agentLabels[name]}</p>
				<p className="text-xs capitalize text-muted-foreground">{status}</p>
			</div>
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
		return <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">No events yet. Connect a device to start the demo.</div>
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
							<a className="mt-1 inline-block font-mono text-xs font-medium text-primary hover:underline" href={MONAD_MAINNET.explorer.txUrl(event.txHash)} rel="noreferrer" target="_blank">
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

export function App() {
	const [state, setState] = useState<DemoState | null>(null)
	const [delegate, setDelegate] = useState('')
	const [deviceId, setDeviceId] = useState('')
	const [appName, setAppName] = useState('Monad Agent Vault Demo')
	const [pairingCode, setPairingCode] = useState('')
	const [testMessage, setTestMessage] = useState('Hello World')
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
	const selectedMarket = state?.markets.find((market) => market.marketId === DEFAULT_MARKET_ID) ?? state?.markets[0]
	const marketId = selectedMarket?.marketId ?? DEFAULT_MARKET_ID

	if (!state) {
		return (
			<main className="relative grid min-h-svh w-full place-items-center text-foreground">
				<BackgroundPattern />
				<div className="relative z-10 flex flex-col items-center gap-3 text-center">
					<Spinner className="size-6 text-primary" />
					<p className="text-sm text-muted-foreground">Loading paid event intelligence…</p>
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
						<h1 className="text-glow text-4xl font-bold tracking-tight sm:text-5xl">Paid Event Intelligence</h1>
						<p className="mt-3 max-w-2xl text-balance text-sm text-muted-foreground sm:text-base">
							GridPlus device-signed mandates control autonomous x402-style access to signed football intelligence on Monad.
						</p>
					</div>
					<div className="flex flex-wrap gap-2 md:justify-end">
						<StatusPill tone="info" label={MONAD_MAINNET.caip2} />
						<StatusPill tone={state.rpcConfigured ? 'success' : 'warning'} label={state.rpcConfigured ? 'RPC ready' : 'RPC missing'} />
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
							<CardTitle className="text-lg">Run the live story</CardTitle>
							<CardDescription>Pair a device, sign a mandate, then let agents buy signed football intelligence.</CardDescription>
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
										<p className="text-sm text-muted-foreground">Send a readable Hello World message through the paired GridPlus signing path.</p>
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
									<div className="space-y-2">
										<div className="grid gap-2 sm:grid-cols-2">
											<Metric label="Message" value={state.lastTestSignature.message} mono={false} />
											<Metric label="Nonce" value={state.lastTestSignature.nonce} />
										</div>
										<div className="rounded-lg border border-border/60 bg-background/40 p-3">
											<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Signed payload</p>
											<pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">{state.lastTestSignature.payload}</pre>
										</div>
										<div className="rounded-lg border border-border/60 bg-background/40 p-3">
											<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Signature</p>
											<p className="mt-2 break-all font-mono text-xs leading-relaxed text-foreground">{state.lastTestSignature.signature}</p>
										</div>
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
								<ActionButton icon={ShieldCheck} variant="outline" onClick={() => run('mandate', () => postAction('/mandates/sign', { maxTotalAtomic: '50000', maxPerPaymentAtomic: '10000', expiresInSeconds: 3600 }))} disabled={Boolean(busy) || !state.device.owner}>
									Sign mandate
								</ActionButton>
								<ActionButton icon={Play} onClick={() => run('opening', () => postAction('/agent/run-event-demo', { marketId, kind: 'valid', round: 'opening' }))} disabled={Boolean(busy) || !state.mandate}>
									Run paid signal
								</ActionButton>
								<ActionButton icon={Brain} variant="outline" onClick={() => run('update', () => postAction('/agent/run-event-demo', { marketId, kind: 'valid', round: 'update' }))} disabled={Boolean(busy) || !state.mandate}>
									Run red-card update
								</ActionButton>
								<ActionButton icon={ShieldOff} variant="outline" onClick={() => run('blocked', () => postAction('/agent/run-event-demo', { marketId, kind: 'blocked', round: 'opening' }))} disabled={Boolean(busy) || !state.mandate}>
									Run blocked agent
								</ActionButton>
								<ActionButton icon={Trash2} variant="destructive" onClick={() => run('revoke', () => postAction('/mandates/revoke'))} disabled={Boolean(busy) || !state.mandate}>
									Revoke mandate
								</ActionButton>
								<ActionButton icon={RefreshCw} variant="outline" className="sm:col-span-2" onClick={() => run('clear', () => postAction('/vault/clear-delegation'))} disabled={Boolean(busy) || !state.device.owner}>
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
							<CardTitle className="text-lg">Mainnet status</CardTitle>
							<CardDescription>Live on-chain and orchestration backend state.</CardDescription>
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
								<Metric label="Budget left" value={formatAtomicUsdc(remaining)} detail={state.mandate?.revoked ? 'Revoked' : 'Mandate controlled'} />
								<Metric label="Demo API" value={compactUrl(API_BASE_URL)} detail="Standalone orchestration backend" />
								<Metric label="Device relay" value={compactUrl(state.gridplus.connectRelayUrl)} detail="Production GridPlus API path" />
								<Metric label="Simulator MQTT" value={compactUrl(state.gridplus.simulatorMqttWsUrl)} detail="Production Web MQTT broker" />
								<Metric label="Provision API" value={compactUrl(state.gridplus.simulatorProvisionUrl)} detail="Hosted device credentials" />
							</div>
						</CardContent>
					</Card>
				</section>

				<Card>
					<CardHeader>
						<p className="text-xs font-semibold uppercase tracking-widest text-primary">Agents</p>
						<CardTitle className="text-lg">Workflow board</CardTitle>
						<CardDescription>Agent states and the latest x402-style policy decision.</CardDescription>
						<CardAction>
							<span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
								<CircleDollarSign className="size-5" />
							</span>
						</CardAction>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
							{agentOrder.map((name) => (
								<AgentCard key={name} name={name} status={state.agents[name]} />
							))}
						</div>
						<div className="grid gap-2 md:grid-cols-3">
							<div className="rounded-lg border border-border/60 bg-muted/20 p-3">
								<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">x402-style challenge</p>
								<p className="mt-1 font-mono text-sm font-medium text-foreground">{state.lastChallenge ? formatAtomicUsdc(state.lastChallenge.amountAtomic) : 'None'}</p>
								<p className="mt-1 text-xs text-muted-foreground">{state.lastChallenge?.resource ?? 'Run the valid agent to receive a 402 challenge.'}</p>
							</div>
							<div className="rounded-lg border border-border/60 bg-muted/20 p-3">
								<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Policy decision</p>
								<p className="mt-1 text-sm font-medium text-foreground">{state.lastPolicyDecision ? (state.lastPolicyDecision.allowed ? 'Approved' : 'Blocked') : 'Pending'}</p>
								<p className="mt-1 text-xs text-muted-foreground">{state.lastPolicyDecision?.reason ?? 'No policy check has run yet.'}</p>
							</div>
							<div className="rounded-lg border border-border/60 bg-muted/20 p-3">
								<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Last payment</p>
								<p className="mt-1 font-mono text-sm font-medium text-foreground">{short(state.lastTxHash)}</p>
								<p className="mt-1 text-xs text-muted-foreground">{state.lastTxHash ? 'Monad explorer link is in the timeline.' : 'No payment transaction yet.'}</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<p className="text-xs font-semibold uppercase tracking-widest text-primary">Paid intelligence</p>
						<CardTitle className="text-lg">{state.lastSignalReport?.market.title ?? selectedMarket?.title ?? 'England to beat USA'}</CardTitle>
						<CardDescription>{state.lastSignalReport?.market.question ?? selectedMarket?.question ?? 'Run the paid signal to unlock signed agent-readable data.'}</CardDescription>
						<CardAction>
							<span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
								<FileJson className="size-5" />
							</span>
						</CardAction>
					</CardHeader>
					<CardContent className="space-y-4">
						{state.lastSignalReport ? (
							<>
								<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
									<Metric label="Model YES" value={formatProbability(state.lastSignalReport.snapshot.modelProbabilityYes)} detail={state.lastSignalReport.snapshot.matchState} mono={false} />
									<Metric label="Market implied" value={formatProbability(state.lastSignalReport.snapshot.marketImpliedProbabilityYes)} detail={`${state.lastSignalReport.snapshot.minute}' · ${state.lastSignalReport.snapshot.score}`} mono={false} />
									<Metric label="Edge" value={formatEdge(state.lastSignalReport.snapshot.edgeBps)} detail={state.lastSignalReport.decisionReason} mono={false} />
									<Metric label="Confidence" value={formatProbability(state.lastSignalReport.snapshot.confidence)} detail={state.lastSignalReport.snapshot.source} mono={false} />
								</div>
								<div className="grid gap-2 lg:grid-cols-[0.9fr_1.1fr]">
									<div className="space-y-2">
										<div className="rounded-lg border border-border/60 bg-muted/20 p-3">
											<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">AI summary</p>
											<p className="mt-2 text-sm leading-relaxed text-foreground">{state.lastSignalReport.aiSummary}</p>
										</div>
										<div className="grid gap-2 sm:grid-cols-2">
											<Metric label="Decision" value={state.lastSignalReport.agentDecision} detail={state.lastSignalReport.decisionReason} mono={false} />
											<Metric label="Provider" value={short(state.lastSignalReport.attestation.provider)} detail="Signed data provider" />
										</div>
										{state.lastResultPayload ? (
											<div className="rounded-lg border border-border/60 bg-muted/20 p-3">
												<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Result poster preview</p>
												<p className="mt-1 text-sm font-medium text-foreground">{state.lastResultPayload.finalScore}</p>
												<p className="mt-1 text-xs text-muted-foreground">
													Outcome {state.lastResultPayload.outcome}; contract integration {state.lastResultPayload.contractIntegration}.
												</p>
												<p className="mt-2 break-all font-mono text-xs text-muted-foreground">{state.lastResultPayload.evidenceHash}</p>
											</div>
										) : null}
									</div>
									<JsonPreview label="Signed attestation" value={state.lastSignalReport.attestation} />
								</div>
							</>
						) : (
							<div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">No paid signal unlocked yet. Run the paid signal flow to show the signed attestation.</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<p className="text-xs font-semibold uppercase tracking-widest text-primary">Audit</p>
						<CardTitle className="text-lg">Timeline</CardTitle>
						<CardDescription>Every device signature, policy check, and payment, in order.</CardDescription>
					</CardHeader>
					<CardContent>
						<Timeline events={state.events} />
					</CardContent>
				</Card>
			</div>
		</main>
	)
}
