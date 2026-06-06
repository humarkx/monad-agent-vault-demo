import type * as React from 'react'

import { cn } from '../../lib/utils'

/**
 * Shared premium page header used across app shells and showcase pages.
 */
export interface PageHeaderProps extends React.ComponentProps<'div'> {
	/**
	 * Small uppercase label shown above the title.
	 */
	category?: string
	/**
	 * Main page title.
	 */
	title: string
	/**
	 * Optional supporting copy shown below the title.
	 */
	subtitle?: string
	/**
	 * Optional actions rendered below or beside the title block.
	 */
	actions?: React.ReactNode
	/**
	 * Centers the header block for hero-style pages.
	 */
	centered?: boolean
	/**
	 * Enables the premium glow treatment on the title.
	 */
	glowTitle?: boolean
}

/**
 * Premium page header with hero and utility variants.
 */
export function PageHeader({ category, title, subtitle, actions, centered = true, glowTitle = true, className, ...props }: PageHeaderProps) {
	if (centered) {
		return (
			<div className={cn('flex w-full flex-col items-center gap-10 text-center', className)} {...props}>
				<div className="max-w-2xl">
					{category ? <p className="mb-2 text-xs uppercase tracking-widest text-primary">{category}</p> : null}
					<h1 className={cn(glowTitle && 'text-glow', 'text-5xl font-bold tracking-tight sm:text-6xl')}>{title}</h1>
					{subtitle ? <p className="mt-4 text-balance text-sm text-muted-foreground sm:text-base">{subtitle}</p> : null}
				</div>
				{actions ? <div className="flex w-full max-w-5xl flex-col items-center gap-3">{actions}</div> : null}
			</div>
		)
	}

	return (
		<div className={cn('flex flex-col gap-2 md:flex-row md:items-center md:justify-between', className)} {...props}>
			<div>
				{category ? <p className="mb-1 text-xs uppercase tracking-widest text-primary">{category}</p> : null}
				<h1 className="text-2xl font-bold tracking-tight">{title}</h1>
				{subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
			</div>
			{actions ? <div className="flex items-center gap-2">{actions}</div> : null}
		</div>
	)
}
