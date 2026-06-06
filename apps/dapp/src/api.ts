import type { DemoState } from '@gridplus-monad-agent-vault/shared'

const PRODUCTION_API_BASE_URL = 'https://monad-agent-vault-api.onrender.com'
const LOCAL_API_BASE_URL = 'http://localhost:10000'
const urlParams = new URLSearchParams(window.location.search)
const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
const API_BASE_URL = urlParams.get('api') === 'local' ? LOCAL_API_BASE_URL : urlParams.get('api') === 'prod' ? PRODUCTION_API_BASE_URL : isLocalHost ? LOCAL_API_BASE_URL : PRODUCTION_API_BASE_URL

export function formatError(error: unknown): string {
	if (error instanceof Error) {
		return error.message
	}
	if (typeof error === 'object' && error) {
		const candidate = error as { code?: unknown; message?: unknown; error?: unknown }
		if (typeof candidate.message === 'string') {
			return typeof candidate.code === 'number' || typeof candidate.code === 'string' ? `${candidate.message} (${candidate.code})` : candidate.message
		}
		if (candidate.error) {
			return formatError(candidate.error)
		}
		try {
			return JSON.stringify(error)
		} catch {
			return String(error)
		}
	}
	return String(error)
}

async function parseResponse<T>(response: Response): Promise<T> {
	const data = (await response.json()) as unknown
	if (!response.ok) {
		const message = typeof data === 'object' && data && 'error' in data ? formatError((data as { error: unknown }).error) : `Request failed with ${response.status}`
		throw new Error(message)
	}
	return data as T
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	try {
		const response = await fetch(`${API_BASE_URL}${path}`, init)
		return await parseResponse<T>(response)
	} catch (error) {
		if (error instanceof TypeError) {
			throw new Error(`Could not reach Demo API at ${API_BASE_URL}. ${error.message}`)
		}
		throw error
	}
}

export async function getState(): Promise<DemoState> {
	return apiFetch<DemoState>('/demo/state')
}

export async function postAction<T = { state: DemoState }>(path: string, body: Record<string, unknown> = {}): Promise<T> {
	return apiFetch<T>(path, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	})
}

export { API_BASE_URL }
