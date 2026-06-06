// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
	function transfer(address to, uint256 value) external returns (bool);
}

contract AgentVaultDelegate {
	struct AgentMandate {
		address owner;
		address agent;
		address delegate;
		address token;
		address merchant;
		bytes32 serviceHash;
		uint256 maxTotalAtomic;
		uint256 maxPerPaymentAtomic;
		uint256 expiresAt;
		bytes32 nonce;
	}

	event AgentPayment(bytes32 indexed mandateKey, bytes32 indexed paymentId, address indexed agent, address merchant, address token, uint256 amountAtomic, bytes32 serviceHash);
	event MandateRevoked(bytes32 indexed mandateKey, address indexed owner);

	string private constant NAME = "GridPlus Monad Agent Vault";
	string private constant VERSION = "1";
	bytes32 private constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
	bytes32 private constant MANDATE_TYPEHASH = keccak256(
		"AgentMandate(address owner,address agent,address delegate,address token,address merchant,bytes32 serviceHash,uint256 maxTotalAtomic,uint256 maxPerPaymentAtomic,uint256 expiresAt,bytes32 nonce)"
	);

	address private immutable SELF = address(this);

	mapping(bytes32 mandateKey => uint256 spentAtomic) public spentByMandate;
	mapping(bytes32 paymentId => bool used) public usedPaymentIds;
	mapping(bytes32 mandateKey => bool revoked) public revokedMandates;

	function implementation() external view returns (address) {
		return SELF;
	}

	function pay(AgentMandate calldata mandate, uint256 amountAtomic, bytes32 serviceHash, bytes32 paymentId, bytes calldata signature) external {
		bytes32 key = mandateKey(mandate);
		_validateMandate(mandate, key, signature);
		require(msg.sender == mandate.agent, "AGENT_ONLY");
		require(mandate.serviceHash == serviceHash, "SERVICE_NOT_ALLOWED");
		require(!usedPaymentIds[paymentId], "PAYMENT_REPLAY");
		require(amountAtomic <= mandate.maxPerPaymentAtomic, "PER_PAYMENT_CAP");

		uint256 nextSpent = spentByMandate[key] + amountAtomic;
		require(nextSpent <= mandate.maxTotalAtomic, "TOTAL_CAP");

		usedPaymentIds[paymentId] = true;
		spentByMandate[key] = nextSpent;

		require(IERC20(mandate.token).transfer(mandate.merchant, amountAtomic), "TOKEN_TRANSFER_FAILED");
		emit AgentPayment(key, paymentId, mandate.agent, mandate.merchant, mandate.token, amountAtomic, serviceHash);
	}

	function revoke(AgentMandate calldata mandate, bytes calldata signature) external {
		bytes32 key = mandateKey(mandate);
		_validateMandate(mandate, key, signature);
		revokedMandates[key] = true;
		emit MandateRevoked(key, mandate.owner);
	}

	function mandateKey(AgentMandate calldata mandate) public pure returns (bytes32) {
		return keccak256(
			abi.encode(
				MANDATE_TYPEHASH,
				mandate.owner,
				mandate.agent,
				mandate.delegate,
				mandate.token,
				mandate.merchant,
				mandate.serviceHash,
				mandate.maxTotalAtomic,
				mandate.maxPerPaymentAtomic,
				mandate.expiresAt,
				mandate.nonce
			)
		);
	}

	function domainSeparator() public view returns (bytes32) {
		return keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(NAME)), keccak256(bytes(VERSION)), block.chainid, address(this)));
	}

	function digest(AgentMandate calldata mandate) public view returns (bytes32) {
		return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), mandateKey(mandate)));
	}

	function _validateMandate(AgentMandate calldata mandate, bytes32 key, bytes calldata signature) private view {
		require(mandate.owner == address(this), "OWNER_MUST_BE_DELEGATED_EOA");
		require(mandate.delegate == SELF, "DELEGATE_MISMATCH");
		require(!revokedMandates[key], "MANDATE_REVOKED");
		require(block.timestamp <= mandate.expiresAt, "MANDATE_EXPIRED");
		require(_recover(digest(mandate), signature) == mandate.owner, "BAD_MANDATE_SIGNATURE");
	}

	function _recover(bytes32 hash, bytes calldata signature) private pure returns (address) {
		require(signature.length == 65, "BAD_SIGNATURE_LENGTH");

		bytes32 r;
		bytes32 s;
		uint8 v;
		assembly {
			r := calldataload(signature.offset)
			s := calldataload(add(signature.offset, 32))
			v := byte(0, calldataload(add(signature.offset, 64)))
		}
		if (v < 27) {
			v += 27;
		}
		require(v == 27 || v == 28, "BAD_SIGNATURE_V");
		return ecrecover(hash, v, r, s);
	}
}
