// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../src/AgentVaultDelegate.sol";

contract AgentVaultDelegateTest {
	function testImplementationAddressIsSelf() public {
		AgentVaultDelegate delegate = new AgentVaultDelegate();
		require(delegate.implementation() == address(delegate), "implementation mismatch");
	}

	function testDomainSeparatorExists() public {
		AgentVaultDelegate delegate = new AgentVaultDelegate();
		require(delegate.domainSeparator() != bytes32(0), "empty domain");
	}
}
