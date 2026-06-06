import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type DemoConfig = {
	PORT: number
	API_CORS_ORIGINS: string[]
	MONAD_RPC_URL: string
	SPONSOR_PRIVATE_KEY?: string
	AGENT_PRIVATE_KEY?: string
	AGENT_VAULT_DELEGATE_ADDRESS?: string
	GRIDPLUS_SIGNER_MODE: 'device' | 'local-signer'
	GRIDPLUS_DEVICE_ID?: string
	GRIDPLUS_APP_SECRET?: string
	GRIDPLUS_APP_NAME: string
	GRIDPLUS_BASE_URL: string
	GRIDPLUS_SIMULATOR_URL: string
	GRIDPLUS_SIMULATOR_MQTT_WS_URL: string
	GRIDPLUS_SIMULATOR_PROVISION_URL: string
	GRIDPLUS_CLIENT_STATE_FILE: string
	GRIDPLUS_APP_SECRET_FILE: string
	LOCAL_SIGNER_PRIVATE_KEY: string
}

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

export const config: DemoConfig = {
	PORT: 10000,
	API_CORS_ORIGINS: ['http://localhost:5173', 'https://monad-agent-vault-dapp.onrender.com'],
	MONAD_RPC_URL: 'https://rpc.contract.dev/f656e8028c1916415a7d2ee076d09921',
	SPONSOR_PRIVATE_KEY: undefined,
	AGENT_PRIVATE_KEY: undefined,
	AGENT_VAULT_DELEGATE_ADDRESS: undefined,
	GRIDPLUS_SIGNER_MODE: 'device',
	GRIDPLUS_DEVICE_ID: '6OJVRM',
	GRIDPLUS_APP_SECRET: 'f41890972c37bf600028d603bfbb05378c41bc0d67dc8e1fc6bcd8f4e5884a4a',
	GRIDPLUS_APP_NAME: 'Monad Agent Vault Demo',
	GRIDPLUS_BASE_URL: 'https://api.gridplus.io/api/v1/secure',
	GRIDPLUS_SIMULATOR_URL: 'https://simulator.gridplus.io',
	GRIDPLUS_SIMULATOR_MQTT_WS_URL: 'wss://mqtt.gridplus.io/ws',
	GRIDPLUS_SIMULATOR_PROVISION_URL: 'https://api.gridplus.io/provision',
	GRIDPLUS_CLIENT_STATE_FILE: '.gridplus-client-state',
	GRIDPLUS_APP_SECRET_FILE: '.gridplus-app-secret',
	LOCAL_SIGNER_PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
}

export const clientStateFile = join(repoRoot, config.GRIDPLUS_CLIENT_STATE_FILE)
export const appSecretFile = join(repoRoot, config.GRIDPLUS_APP_SECRET_FILE)
