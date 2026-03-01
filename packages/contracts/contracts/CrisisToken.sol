// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract CrisisToken is ERC20Votes, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address minter)
        ERC20("CrisisToken", "CRT")
        EIP712("CrisisToken", "1")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, minter);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    // Soulbound: block all transfers except mint (from == 0) and burn (to == 0)
    function _update(address from, address to, uint256 value)
        internal override
    {
        require(from == address(0) || to == address(0), "CrisisToken: soulbound");
        super._update(from, to, value);
    }
}
