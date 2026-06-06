import type * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const cardVariants = cva('text-card-foreground group/card relative flex flex-col gap-4 overflow-hidden text-sm', {
	variants: {
		variant: {
			default:
				'ring-foreground/10 bg-card/25 rounded-xl py-4 backdrop-blur-sm ring-1 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl',
			premium:
				'bg-[linear-gradient(180deg,rgba(11,17,28,0.76),rgba(9,12,18,0.88))] rounded-none border border-white/8 py-4 shadow-[0_20px_56px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[18px] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:has-data-[slot=card-footer]:pb-0',
		},
		size: {
			default: '',
			sm: 'gap-3 py-3',
		},
	},
	defaultVariants: {
		variant: 'default',
		size: 'default',
	},
})

function Card({ className, size = 'default', variant = 'default', ...props }: React.ComponentProps<'div'> & VariantProps<typeof cardVariants>) {
	return (
		<div
			data-slot="card"
			data-size={size}
			data-variant={variant}
			className={cn(cardVariants({ variant, size }), 'data-[variant=default]:*:[img:first-child]:rounded-t-xl data-[variant=default]:*:[img:last-child]:rounded-b-xl', className)}
			{...props}
		/>
	)
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-header"
			className={cn(
				'gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3 group/card-header @container/card-header grid auto-rows-min items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]',
				className,
			)}
			{...props}
		/>
	)
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
	return <div data-slot="card-title" className={cn('text-base leading-snug font-medium group-data-[size=sm]/card:text-sm', className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
	return <div data-slot="card-description" className={cn('text-muted-foreground text-sm', className)} {...props} />
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
	return <div data-slot="card-action" className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
	return <div data-slot="card-content" className={cn('px-4 group-data-[size=sm]/card:px-3', className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-footer"
			className={cn(
				'bg-muted/50 rounded-b-xl border-t p-4 group-data-[size=sm]/card:p-3 flex items-center group-data-[variant=premium]/card:rounded-none group-data-[variant=premium]/card:border-white/8 group-data-[variant=premium]/card:bg-white/[0.02]',
				className,
			)}
			{...props}
		/>
	)
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent, cardVariants }
