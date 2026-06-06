import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { Client, fetchAddress, pair, setup, signAuthorization as gridplusSignAuthorization, signMessage } from 'gridplus-sdk'
import { privateKeyToAccount } from 'viem/accounts'
import type { Address, Authorization, Hex } from 'viem'
import { agentMandateTypes, buildAgentMandateTypedData, type AgentMandate, type DeviceMode, MONAD_MAINNET } from '@gridplus-monad-agent-vault/shared'
import { appSecretFile, clientStateFile, config } from './config'

type SignatureLike = {
	sig?: {
		r: Buffer | Uint8Array | string
		s: Buffer | Uint8Array | string
		v?: Buffer | Uint8Array | string | number | bigint
	}
}

const localSignerAccount = () => privateKeyToAccount(config.LOCAL_SIGNER_PRIVATE_KEY as Hex)

type StoredClientState = {
	deviceId: string
	name?: string
	ephemeralPub: string
	fwVersion: string
	baseUrl: string
	privKey: string
}

const decodeClientState = (encoded: string): StoredClientState | null => {
	try {
		const decoded = Buffer.from(encoded, 'base64').toString('utf8')
		const parsed = JSON.parse(decoded) as Partial<StoredClientState>
		if (typeof parsed.deviceId !== 'string' || !parsed.deviceId || typeof parsed.ephemeralPub !== 'string' || !parsed.ephemeralPub || typeof parsed.fwVersion !== 'string' || !parsed.fwVersion || typeof parsed.baseUrl !== 'string' || !parsed.baseUrl || typeof parsed.privKey !== 'string' || !parsed.privKey) {
			return null
		}
		return parsed as StoredClientState
	} catch {
		return null
	}
}

const readStoredClientState = (): { raw: string; parsed: StoredClientState } | null => {
	if (!existsSync(clientStateFile)) {
		return null
	}
	const raw = readFileSync(clientStateFile, 'utf8').trim()
	if (!raw) {
		return null
	}
	const parsed = decodeClientState(raw)
	if (!parsed) {
		unlinkSync(clientStateFile)
		return null
	}
	return { raw, parsed }
}

const readClientState = async (): Promise<string> => readStoredClientState()?.raw ?? ''

const writeClientState = async (data: string | null): Promise<void> => {
	if (data) {
		writeFileSync(clientStateFile, data, { mode: 0o600 })
	}
}

export function resetDeviceSession(): void {
	if (existsSync(clientStateFile)) {
		unlinkSync(clientStateFile)
	}
	if (existsSync(appSecretFile) && !config.GRIDPLUS_APP_SECRET) {
		unlinkSync(appSecretFile)
	}
}

export function getStoredDeviceContext(): { deviceId: string | null; appName: string } {
	const stored = readStoredClientState()
	return {
		deviceId: stored?.parsed.deviceId ?? config.GRIDPLUS_DEVICE_ID ?? null,
		appName: stored?.parsed.name ?? config.GRIDPLUS_APP_NAME,
	}
}

const normalizeAppSecret = (secret: string): string => (secret.startsWith('0x') ? secret.slice(2) : secret)

const readOrCreateAppSecret = (): string => {
	if (config.GRIDPLUS_APP_SECRET) {
		return normalizeAppSecret(config.GRIDPLUS_APP_SECRET)
	}
	if (existsSync(appSecretFile)) {
		return normalizeAppSecret(readFileSync(appSecretFile, 'utf8').trim())
	}
	const secret = randomBytes(32).toString('hex')
	writeFileSync(appSecretFile, `${secret}\n`, { mode: 0o600 })
	return secret
}

const primeStoredClient = async (): Promise<void> => {
	await setup({
		getStoredClient: readClientState,
		setStoredClient: writeClientState,
	})
}

const fetchOwnerIfAvailable = async (): Promise<Address | null> => {
	try {
		return (await fetchAddress(0)) as Address
	} catch {
		return null
	}
}

const normalizeHexPart = (value: Buffer | Uint8Array | string | number | bigint | undefined, bytes?: number): string => {
	if (value === undefined) return ''
	if (typeof value === 'number' || typeof value === 'bigint') {
		return Number(value).toString(16).padStart(bytes ? bytes * 2 : 2, '0')
	}
	if (typeof value === 'string') {
		const raw = value.startsWith('0x') ? value.slice(2) : value
		return bytes ? raw.padStart(bytes * 2, '0') : raw
	}
	return Buffer.from(value).toString('hex').padStart(bytes ? bytes * 2 : 0, '0')
}

export function signDataToHex(response: SignatureLike): Hex {
	if (!response.sig) {
		throw new Error('GridPlus signing response did not include signature components.')
	}
	const r = normalizeHexPart(response.sig.r, 32)
	const s = normalizeHexPart(response.sig.s, 32)
	let v = normalizeHexPart(response.sig.v ?? 27, 1)
	const numericV = Number.parseInt(v, 16)
	if (numericV === 0 || numericV === 1) {
		v = (numericV + 27).toString(16)
	}
	return `0x${r}${s}${v.padStart(2, '0')}` as Hex
}

export async function setupDevice(params: { mode: DeviceMode; deviceId?: string; appName?: string }) {
	if (params.mode === 'local-signer') {
		return {
			paired: true,
			owner: localSignerAccount().address,
			mode: 'local-signer' as const,
			deviceId: null,
			appName: 'Local signer',
		}
	}

	const stored = readStoredClientState()
	const requestedDeviceId = params.deviceId ?? config.GRIDPLUS_DEVICE_ID
	if (stored && (!requestedDeviceId || stored.parsed.deviceId === requestedDeviceId)) {
		await primeStoredClient()
		const owner = await fetchOwnerIfAvailable()
		return { paired: Boolean(owner), owner, mode: 'device' as const, deviceId: stored.parsed.deviceId, appName: stored.parsed.name ?? params.appName ?? config.GRIDPLUS_APP_NAME }
	}

	const deviceId = requestedDeviceId
	const appName = params.appName ?? config.GRIDPLUS_APP_NAME
	if (!deviceId) {
		throw new Error('GRIDPLUS_DEVICE_ID or a request deviceId is required for GridPlus device mode.')
	}

	const appSecret = readOrCreateAppSecret()
	const client = new Client({
		deviceId,
		privKey: appSecret,
		name: appName,
		baseUrl: config.GRIDPLUS_BASE_URL,
		setStoredClient: writeClientState,
	})
	const connectedAndPaired = Boolean(await client.connect(deviceId))
	await primeStoredClient()
	const owner = connectedAndPaired ? await fetchOwnerIfAvailable() : null
	return { paired: Boolean(owner), owner, mode: 'device' as const, deviceId, appName }
}

export async function pairDevice(pairingCode: string) {
	await primeStoredClient()
	const paired = await pair(pairingCode)
	const owner = paired ? await fetchOwnerIfAvailable() : null
	const stored = readStoredClientState()
	return {
		paired: Boolean(owner),
		owner,
		deviceId: stored?.parsed.deviceId ?? null,
		appName: stored?.parsed.name ?? config.GRIDPLUS_APP_NAME,
	}
}

export async function sign7702Authorization(params: { mode: DeviceMode; delegate: Address; nonce: number }): Promise<Authorization> {
	if (params.mode === 'local-signer') {
		return localSignerAccount().signAuthorization({
			chainId: MONAD_MAINNET.chainId,
			contractAddress: params.delegate,
			nonce: params.nonce,
		})
	}

	return gridplusSignAuthorization({
		chainId: MONAD_MAINNET.chainId,
		address: params.delegate,
		nonce: params.nonce,
	})
}

export async function signMandate(params: { mode: DeviceMode; mandate: AgentMandate }): Promise<Hex> {
	if (params.mode === 'local-signer') {
		const typedData = buildAgentMandateTypedData(params.mandate)
		return localSignerAccount().signTypedData({
			domain: {
				...typedData.domain,
				verifyingContract: typedData.domain.verifyingContract as Hex,
			},
			types: agentMandateTypes,
			primaryType: 'AgentMandate',
			message: {
				owner: typedData.message.owner as Hex,
				agent: typedData.message.agent as Hex,
				delegate: typedData.message.delegate as Hex,
				token: typedData.message.token as Hex,
				merchant: typedData.message.merchant as Hex,
				serviceHash: typedData.message.serviceHash as Hex,
				maxTotalAtomic: typedData.message.maxTotalAtomic,
				maxPerPaymentAtomic: typedData.message.maxPerPaymentAtomic,
				expiresAt: typedData.message.expiresAt,
				nonce: typedData.message.nonce as Hex,
			},
		})
	}

	return signDataToHex(await signMessage(buildAgentMandateTypedData(params.mandate)))
}

export function createNonce(): Hex {
	return `0x${randomBytes(32).toString('hex')}` as Hex
}
