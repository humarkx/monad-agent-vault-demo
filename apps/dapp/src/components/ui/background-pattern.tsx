import type * as React from 'react'

import { cn } from '../../lib/utils'

/**
 * Background emphasis tone for premium app surfaces.
 */
export type BackgroundPatternTone = 'default' | 'info' | 'success' | 'warning'

const TONE_STYLES: Record<BackgroundPatternTone, string> = {
	default: 'radial-gradient(ellipse at top, rgba(63, 183, 231, 0.18) 0%, transparent 60%)',
	info: 'radial-gradient(ellipse at top, rgba(96, 165, 250, 0.18) 0%, transparent 60%)',
	success: 'radial-gradient(ellipse at top, rgba(16, 185, 129, 0.18) 0%, transparent 60%)',
	warning: 'radial-gradient(ellipse at top, rgba(234, 179, 8, 0.18) 0%, transparent 60%)',
}

/**
 * Renders the shared premium background mesh and grid treatment used by the app shells.
 */
export interface BackgroundPatternProps extends React.ComponentProps<'div'> {
	/**
	 * Visual emphasis for the spotlight gradient.
	 */
	tone?: BackgroundPatternTone
	/**
	 * Whether the background should be positioned relative to the nearest container
	 * instead of the viewport.
	 */
	position?: 'fixed' | 'absolute'
	/**
	 * Size of the grid pattern cells in pixels.
	 */
	gridSize?: number
}

/**
 * Shared atmospheric background pattern for premium screens and showcases.
 */
export function BackgroundPattern({ className, tone = 'default', position = 'fixed', gridSize = 40, ...props }: BackgroundPatternProps) {
	return (
		<div className={cn('pointer-events-none inset-0 z-0', position === 'fixed' ? 'fixed' : 'absolute', className)} {...props}>
			<div
				className="absolute inset-0"
				style={{
					backgroundImage: TONE_STYLES[tone],
				}}
			/>
			<div
				className="absolute inset-0 opacity-30"
				style={{
					backgroundImage: 'linear-gradient(to right, #1f2937 1px, transparent 1px), linear-gradient(to bottom, #1f2937 1px, transparent 1px)',
					backgroundSize: `${gridSize}px ${gridSize}px`,
					maskImage: 'radial-gradient(ellipse at center, transparent 15%, black 100%)',
				}}
			/>
		</div>
	)
}
