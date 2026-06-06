import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Database, ExternalLink, FileJson, Goal, KeyRound, Play, PlugZap, PlusCircle, RefreshCw, ShieldCheck, ShieldOff, Trophy, WalletCards } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MONAD_NETWORK, type AgentRun, type AuditEvent, type DemoState, type RegisteredAgent, type RegistryMarket } from '@gridplus-monad-agent-vault/shared'
import { formatError, getState, postAction } from './api'
import { BackgroundPattern } from './components/ui/background-pattern'
import { Badge } from './components/ui/badge'
import { Button, buttonVariants } from './components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'
import { Spinner } from './components/ui/spinner'
import { StatusPill, type StatusPillTone } from './components/ui/status-pill'
import { cn } from './lib/utils'

const short = (value: string | null | undefined) => (value ? `${value.slice(0, 6)}...${value.slice(-4)}` : 'Not set')
const percent = (value: number | null | undefined) => (typeof value === 'number' ? `${Math.round(value * 100)}%` : 'Not set')
const edge = (value: number | null | undefined) => (typeof value === 'number' ? `${value > 0 ? '+' : ''}${(value / 100).toFixed(1)}%` : 'Not set')

const formatAtomicCollateral = (value: string | null | undefined) => {
	if (!value) return '0.00 MockUSDC'
	const raw = BigInt(value)
	const whole = raw / 1_000_000n
	const fraction = (raw % 1_000_000n).toString().padStart(6, '0').slice(0, 2)
	return `${whole}.${fraction} MockUSDC`
}

const toAtomic = (value: string) => {
	const n = Number(value)
	if (!Number.isFinite(n) || n < 0) return '0'
	return BigInt(Math.round(n * 1_000_000)).toString()
}

const formatTime = (value: string | null | undefined) => (value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not set')

const deviceModeLabel = (mode: DemoState['device']['mode']) => (mode === 'device' ? 'Device' : 'Local signer')

const statusTone = (status: string): StatusPillTone => {
	if (status === 'active' || status === 'open' || status === 'success' || status === 'complete' || status === 'approved') return 'success'
	if (status === 'dry-run' || status === 'running') return 'info'
	if (status === 'paused' || status === 'draft' || status === 'warning') return 'warning'
	if (status === 'revoked' || status === 'blocked' || status === 'error') return 'danger'
	return 'neutral'
}

const fieldClass =
	'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30'

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

function MarketsList({ markets }: { markets: RegistryMarket[] }) {
	if (markets.length === 0) {
		return <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">No markets in SQLite yet.</div>
	}
	return (
		<div className="grid gap-2 sm:grid-cols-2">
			{markets.map((market) => (
				<div className="rounded-lg border border-border/60 bg-muted/20 p-3" key={market.marketId}>
					<div className="flex items-start justify-between gap-2">
						<div className="min-w-0">
							<p className="truncate text-sm font-medium text-foreground">{market.title}</p>
							<p className="truncate text-xs text-muted-foreground">
								{market.homeTeam} v {market.awayTeam} · {market.league}
							</p>
						</div>
						<StatusPill tone={statusTone(market.status)} label={market.status} />
					</div>
					<div className="mt-2 space-y-1 text-xs">
						<p className="truncate">
							<span className="text-muted-foreground">Context API: </span>
							<span className="font-mono text-foreground">{market.contextApiUrl}</span>
						</p>
						<p className="truncate">
							<span className="text-muted-foreground">Market: </span>
							<span className="font-mono text-foreground">{market.marketAddress ? short(market.marketAddress) : 'Awaiting testnet deploy'}</span>
						</p>
					</div>
				</div>
			))}
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
		return <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">No agents yet. Create one below.</div>
	}
	return (
		<div className="overflow-hidden rounded-lg border border-border/60">
			<div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.7fr] gap-3 border-b border-border/60 bg-muted/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
				<span>Agent</span>
				<span>Market</span>
				<span>Budget left</span>
				<span>Status</span>
			</div>
			<div className="divide-y divide-border/60">
				{agents.map((agent) => {
					const left = (BigInt(agent.budgetAtomic) - BigInt(agent.spentAtomic)).toString()
					return (
						<button
							type="button"
							key={agent.agentId}
							onClick={() => onSelect(agent.agentId)}
							className={cn('grid w-full grid-cols-[1.2fr_1fr_0.8fr_0.7fr] items-center gap-3 px-3 py-3 text-left text-sm transition hover:bg-muted/25', selectedAgentId === agent.agentId && 'bg-primary/10')}
						>
							<span className="min-w-0">
								<span className="block truncate font-medium text-foreground">{agent.name}</span>
								<span className="block truncate text-xs text-muted-foreground">{agent.lastDecision ?? 'No run yet'}</span>
							</span>
							<span className="truncate text-muted-foreground">{marketTitle(agent.marketId)}</span>
							<span className="truncate font-mono text-muted-foreground">{formatAtomicCollateral(left)}</span>
							<span>
								<Badge variant={agent.status === 'active' ? 'secondary' : 'outline'}>{agent.status}</Badge>
							</span>
						</button>
					)
				})}
			</div>
		</div>
	)
}

function DecisionPanel({ run }: { run: AgentRun | null }) {
	if (!run) {
		return <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">No run yet. Select an agent and run it.</div>
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
		</div>
	)
}

function Timeline({ events }: { events: AuditEvent[] }) {
	if (events.length === 0) {
		return <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">No events yet.</div>
	}
	return (
		<div className="space-y-4">
			{events.slice(0, 12).map((event) => (
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
		<div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
			<div className="flex items-center gap-3">
				<span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
					<CheckCircle2 aria-hidden="true" className="size-5" />
				</span>
				<div className="min-w-0 flex-1">
					<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Device paired</p>
					<p className="truncate font-mono text-sm font-medium text-foreground">{short(owner)}</p>
					{ownerUrl ? (
						<a className="text-xs font-medium text-primary hover:underline" href={ownerUrl} rel="noreferrer" target="_blank">
							View on Monadscan
						</a>
					) : null}
				</div>
				<Badge variant="secondary" className="border border-emerald-500/40 bg-emerald-500/15 text-emerald-200">
					Ready
				</Badge>
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

const emptyForm = { name: '', prompt: '', marketId: '', budget: '5', maxTrade: '1', minEdge: '300', interval: '60' }

export function App() {
	const [state, setState] = useState<DemoState | null>(null)
	const [delegate, setDelegate] = useState('')
	const [deviceId, setDeviceId] = useState('')
	const [appName, setAppName] = useState('AI Agentic Gambling')
	const [pairingCode, setPairingCode] = useState('')
	const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
	const [form, setForm] = useState(emptyForm)
	const [busy, setBusy] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const loadState = async () => {
		try {
			const next = await getState()
			setState(next)
			setSelectedAgentId((current) => current ?? next.registeredAgents[0]?.agentId ?? null)
			setDelegate((current) => current || next.vault.delegate || '')
			setDeviceId((current) => current || next.device.deviceId || '')
			setForm((current) => (current.marketId ? current : { ...current, marketId: next.registryMarkets[0]?.marketId ?? '' }))
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
	const selectedMarket = useMemo(() => state?.registryMarkets.find((market) => market.marketId === selectedAgent?.marketId) ?? null, [selectedAgent?.marketId, state?.registryMarkets])
	const selectedRuns = useMemo(() => state?.agentRuns.filter((run) => run.agentId === selectedAgent?.agentId) ?? [], [selectedAgent?.agentId, state?.agentRuns])
	const selectedRun = selectedRuns[0] ?? null
	const selectedDeviceId = deviceId || state?.device.deviceId || ''
	const selectedAppName = appName || state?.device.appName || 'AI Agentic Gambling'
	const selectedRemaining = selectedAgent ? (BigInt(selectedAgent.budgetAtomic) - BigInt(selectedAgent.spentAtomic)).toString() : null

	const canCreateAgent = Boolean(state?.device.owner) && form.name.trim().length > 0 && form.prompt.trim().length > 0 && Boolean(form.marketId)
	const createAgent = () => {
		const owner = state?.device.owner
		if (!owner || !canCreateAgent) return
		const agentId = crypto.randomUUID()
		void run('create-agent', async () => {
			const result = await postAction('/agents', {
				agentId,
				name: form.name.trim(),
				ownerAddress: owner,
				delegatedEoa: owner,
				marketId: form.marketId,
				prompt: form.prompt.trim(),
				budgetAtomic: toAtomic(form.budget),
				maxTradeAtomic: toAtomic(form.maxTrade),
				minEdgeBps: Math.max(0, Math.round(Number(form.minEdge) || 0)),
				intervalSeconds: Math.max(0, Math.round(Number(form.interval) || 0)),
			})
			setSelectedAgentId(agentId)
			setForm((current) => ({ ...current, name: '', prompt: '' }))
			return result
		})
	}

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
						<p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
							<Trophy className="size-3.5" /> World Cup 2026 · GridPlus × Monad
						</p>
						<h1 className="text-glow text-4xl font-bold tracking-tight sm:text-5xl">AI Agentic Gambling</h1>
						<p className="mt-3 max-w-2xl text-balance text-sm text-muted-foreground sm:text-base">
							Device-signed mandates govern SQLite-registered agents that read live World Cup market context on Monad testnet and place bounded prediction-market bets through an EIP-7702 wallet.
						</p>
					</div>
					<div className="flex flex-wrap gap-2 md:justify-end">
						<StatusPill tone="info" label={MONAD_NETWORK.caip2} />
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
							<CardTitle className="text-lg">Pair, delegate, run</CardTitle>
							<CardDescription>Connect a device, enable the EIP-7702 vault, then run or revoke the selected agent.</CardDescription>
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
								<ActionButton icon={ShieldOff} variant="outline" onClick={() => selectedAgent && run('revoke-agent', () => postAction(`/agents/${selectedAgent.agentId}/revoke`))} disabled={Boolean(busy) || !selectedAgent || selectedAgent.status === 'revoked'}>
									Revoke selected
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
							<p className="text-xs font-semibold uppercase tracking-widest text-primary">Status</p>
							<CardTitle className="text-lg">Vault & budget</CardTitle>
							<CardDescription>Device, delegation, and the selected agent's spend.</CardDescription>
							<CardAction>
								<span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
									<WalletCards className="size-5" />
								</span>
							</CardAction>
						</CardHeader>
						<CardContent>
							<div className="grid gap-2 sm:grid-cols-2">
								<Metric label="Owner EOA" value={short(state.device.owner)} detail={state.device.paired ? 'Device paired' : 'Connect required'} />
								<Metric label="Delegation" value={state.vault.delegated ? 'Active' : 'Not active'} detail={short(state.vault.delegate)} mono={false} />
								<Metric label="Mandate" value={state.mandate ? (state.mandate.revoked ? 'Revoked' : 'Signed') : 'None'} detail={state.mandate ? 'GridPlus device-signed' : 'Sign to set budget'} mono={false} />
								<Metric label="Selected budget left" value={formatAtomicCollateral(selectedRemaining)} detail={selectedAgent?.name ?? 'No agent'} />
							</div>
						</CardContent>
					</Card>
				</section>

				<Card>
					<CardHeader>
						<p className="text-xs font-semibold uppercase tracking-widest text-primary">Markets</p>
						<CardTitle className="text-lg">SQLite markets</CardTitle>
						<CardDescription>World Cup prediction markets stored in the backend, with each market's context API.</CardDescription>
						<CardAction>
							<span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
								<Goal className="size-5" />
							</span>
						</CardAction>
					</CardHeader>
					<CardContent>
						<MarketsList markets={state.registryMarkets} />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<p className="text-xs font-semibold uppercase tracking-widest text-primary">Registry</p>
						<CardTitle className="text-lg">Agent Registry</CardTitle>
						<CardDescription>SQLite-backed agents. Select one to run it; the agent's prompt is what the decision agent evaluates.</CardDescription>
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

				<Card>
					<CardHeader>
						<p className="text-xs font-semibold uppercase tracking-widest text-primary">Prompt an agent</p>
						<CardTitle className="text-lg">Create a new agent</CardTitle>
						<CardDescription>Author the prompt and bounds. It's stored in SQLite, owned by your paired device EOA, and ready to run.</CardDescription>
						<CardAction>
							<span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
								<PlusCircle className="size-5" />
							</span>
						</CardAction>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="grid gap-2 sm:grid-cols-2">
							<Input aria-label="Agent name" placeholder="Agent name, e.g. Value Hunter" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
							<select aria-label="Market" className={fieldClass} value={form.marketId} onChange={(event) => setForm((current) => ({ ...current, marketId: event.target.value }))}>
								{state.registryMarkets.length === 0 ? <option value="">No markets</option> : null}
								{state.registryMarkets.map((market) => (
									<option key={market.marketId} value={market.marketId}>
										{market.title}
									</option>
								))}
							</select>
						</div>
						<textarea
							aria-label="Agent prompt"
							value={form.prompt}
							maxLength={400}
							onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
							placeholder="Prompt the agent… e.g. Buy FOR when model edge is above 4% and confidence is at least 65%. Never spend more than 1 MockUSDC per run."
							className={cn(fieldClass, 'h-auto min-h-20 resize-y py-2 leading-relaxed')}
						/>
						<div className="grid gap-2 sm:grid-cols-4">
							<label className="space-y-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
								Budget (MockUSDC)
								<Input aria-label="Budget" inputMode="decimal" value={form.budget} onChange={(event) => setForm((current) => ({ ...current, budget: event.target.value }))} />
							</label>
							<label className="space-y-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
								Max trade (MockUSDC)
								<Input aria-label="Max trade" inputMode="decimal" value={form.maxTrade} onChange={(event) => setForm((current) => ({ ...current, maxTrade: event.target.value }))} />
							</label>
							<label className="space-y-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
								Min edge (bps)
								<Input aria-label="Min edge bps" inputMode="numeric" value={form.minEdge} onChange={(event) => setForm((current) => ({ ...current, minEdge: event.target.value }))} />
							</label>
							<label className="space-y-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
								Interval (s)
								<Input aria-label="Interval seconds" inputMode="numeric" value={form.interval} onChange={(event) => setForm((current) => ({ ...current, interval: event.target.value }))} />
							</label>
						</div>
						<div className="flex items-center justify-between gap-3">
							<p className="text-xs text-muted-foreground">{state.device.owner ? 'Owned by your paired device EOA.' : 'Pair a device to create an agent.'}</p>
							<ActionButton icon={PlusCircle} onClick={createAgent} disabled={Boolean(busy) || !canCreateAgent}>
								Create agent
							</ActionButton>
						</div>
					</CardContent>
				</Card>

				<section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
					<Card>
						<CardHeader>
							<p className="text-xs font-semibold uppercase tracking-widest text-primary">Agent</p>
							<CardTitle className="text-lg">{selectedAgent?.name ?? 'No agent selected'}</CardTitle>
							<CardDescription>{selectedMarket?.title ?? 'Select an agent from the registry'}</CardDescription>
							<CardAction>{selectedAgent ? <StatusPill tone={statusTone(selectedAgent.status)} label={selectedAgent.status} /> : null}</CardAction>
						</CardHeader>
						<CardContent className="space-y-3">
							{selectedAgent ? (
								<>
									<div className="rounded-lg border border-border/60 bg-muted/20 p-3">
										<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Prompt</p>
										<p className="mt-2 text-sm leading-relaxed text-foreground">{selectedAgent.prompt}</p>
									</div>
									<div className="grid gap-2 sm:grid-cols-2">
										<Metric label="Budget" value={formatAtomicCollateral(selectedAgent.budgetAtomic)} />
										<Metric label="Spent" value={formatAtomicCollateral(selectedAgent.spentAtomic)} />
										<Metric label="Max trade" value={formatAtomicCollateral(selectedAgent.maxTradeAtomic)} />
										<Metric label="Min edge" value={edge(selectedAgent.minEdgeBps)} mono={false} />
									</div>
								</>
							) : (
								<div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">Select an agent from the registry, or create one above.</div>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<p className="text-xs font-semibold uppercase tracking-widest text-primary">Decision</p>
							<CardTitle className="text-lg">Latest run</CardTitle>
							<CardDescription>Market context, decision, trade side, and execution status for the selected agent.</CardDescription>
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
						<p className="text-xs font-semibold uppercase tracking-widest text-primary">Audit</p>
						<CardTitle className="text-lg">Timeline</CardTitle>
						<CardDescription>Pair, delegate, run, trade, block, revoke, and cleanup actions.</CardDescription>
					</CardHeader>
					<CardContent>
						<Timeline events={state.events} />
					</CardContent>
				</Card>
			</div>
		</main>
	)
}
