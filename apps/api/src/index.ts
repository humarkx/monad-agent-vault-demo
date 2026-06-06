import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { Hono } from 'hono'
import { config } from './config'
import { routes } from './routes'

const app = new Hono()
const allowedOrigins = new Set(config.API_CORS_ORIGINS)
const isLocalViteOrigin = (origin: string): boolean => {
	try {
		const url = new URL(origin)
		return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1') && url.port.startsWith('517')
	} catch {
		return false
	}
}

app.use(
	'*',
	cors({
		origin: (origin) => (allowedOrigins.has(origin) || isLocalViteOrigin(origin) ? origin : undefined),
		allowHeaders: ['Content-Type', 'Authorization'],
		allowMethods: ['GET', 'POST', 'OPTIONS'],
	}),
)

app.route('/', routes)

app.onError((error, c) => {
	console.error(error)
	return c.json({ error: error.message }, 500)
})

serve(
	{
		fetch: app.fetch,
		port: config.PORT,
	},
	(info) => {
		console.log(`Monad Agent Vault API listening on http://localhost:${info.port}`)
	},
)
