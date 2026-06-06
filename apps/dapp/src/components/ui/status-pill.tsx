import type * as React from 'react'

import { cn } from '../../lib/utils'

/**
 * Visual emphasis options for shared status pills.
 */
export type StatusPillTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const TONE_CLASSES: Record<StatusPillTone, { surface: string; text: string; dot: string }> = {
	neutral: {
		surface: 'bg-slate-500/10 border-slate-500/30',
		text: 'text-slate-700 dark:text-slate-100',
		dot: 'bg-slate-400',
	},
	info: {
		surface: 'bg-sky-500/10 border-sky-500/40',
		text: 'text-sky-700 dark:text-sky-100',
		dot: 'bg-sky-400',
	},
	success: {
		surface: 'bg-emerald-500/10 border-emerald-500/40',
		text: 'text-emerald-700 dark:text-emerald-100',
		dot: 'bg-emerald-400',
	},
	warning: {
		surface: 'bg-amber-500/10 border-amber-500/40',
		text: 'text-amber-800 dark:text-amber-100',
		dot: 'bg-amber-400',
	},
	danger: {
		surface: 'bg-rose-500/10 border-rose-500/40',
		text: 'text-rose-700 dark:text-rose-100',
		dot: 'bg-rose-400',
	},
}

/**
 * Shared premium status pill used for environment, connectivity, and approval states.
 */
export interface StatusPillProps extends React.ComponentProps<'div'> {
	/**
	 * Main label displayed in the pill.
	 */
	label: string
	/**
	 * Optional metadata displayed after the main label.
	 */
	meta?: string
	/**
	 * Visual emphasis of the status pill.
	 */
	tone?: StatusPillTone
	/**
	 * Optional leading icon instead of the dot indicator.
	 */
	icon?: React.ReactNode
}

/**
 * Premium floating status pill with a glow dot and optional metadata.
 */
export function StatusPill({ label, meta, tone = 'neutral', icon, className, ...props }: StatusPillProps) {
	const toneClasses = TONE_CLASSES[tone]

	return (
		<div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur bg-background/80', toneClasses.surface, className)} {...props}>
			{icon ? icon : <span className={cn('h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]', toneClasses.dot)} />}
			<span className={cn('font-medium', toneClasses.text)}>{label}</span>
			{meta ? <span className="text-[11px] text-muted-foreground/80">• {meta}</span> : null}
		</div>
	)
}
