import type { DemoState } from '@gridplus-monad-agent-vault/shared'

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:10000' : 'https://monad-agent-vault-api.onrender.com'

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

export async function getState(): Promise<DemoState> {
	return fetch(`${API_BASE_URL}/demo/state`).then((response) => parseResponse<DemoState>(response))
}

export async function postAction<T = { state: DemoState }>(path: string, body: Record<string, unknown> = {}): Promise<T> {
	return fetch(`${API_BASE_URL}${path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	}).then((response) => parseResponse<T>(response))
}

export { API_BASE_URL }
