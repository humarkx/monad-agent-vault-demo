export const agentVaultDelegateAbi = [
	{
		type: 'function',
		name: 'pay',
		stateMutability: 'nonpayable',
		inputs: [
			{
				name: 'mandate',
				type: 'tuple',
				components: [
					{ name: 'owner', type: 'address' },
					{ name: 'agent', type: 'address' },
					{ name: 'delegate', type: 'address' },
					{ name: 'token', type: 'address' },
					{ name: 'merchant', type: 'address' },
					{ name: 'serviceHash', type: 'bytes32' },
					{ name: 'maxTotalAtomic', type: 'uint256' },
					{ name: 'maxPerPaymentAtomic', type: 'uint256' },
					{ name: 'expiresAt', type: 'uint256' },
					{ name: 'nonce', type: 'bytes32' },
				],
			},
			{ name: 'amountAtomic', type: 'uint256' },
			{ name: 'serviceHash', type: 'bytes32' },
			{ name: 'paymentId', type: 'bytes32' },
			{ name: 'signature', type: 'bytes' },
		],
		outputs: [],
	},
] as const
