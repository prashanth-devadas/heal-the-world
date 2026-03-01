// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract InstitutionRegistry {
    mapping(address => bool) private _verified;
    mapping(address => string) private _name;
    mapping(address => string) private _credentialCID;
    mapping(address => bool) public isAdmin;

    event InstitutionAdded(address indexed institution, string name);
    event InstitutionRemoved(address indexed institution);

    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "InstitutionRegistry: not admin");
        _;
    }

    constructor(address[] memory admins, uint256 /*threshold — reserved*/) {
        for (uint256 i = 0; i < admins.length; i++) {
            isAdmin[admins[i]] = true;
        }
    }

    function addInstitution(
        address institution,
        string calldata name,
        string calldata credCID
    ) external onlyAdmin {
        _verified[institution] = true;
        _name[institution] = name;
        _credentialCID[institution] = credCID;
        emit InstitutionAdded(institution, name);
    }

    function removeInstitution(address institution) external onlyAdmin {
        _verified[institution] = false;
        emit InstitutionRemoved(institution);
    }

    function isVerified(address institution) external view returns (bool) {
        return _verified[institution];
    }

    function credentialCID(address institution) external view returns (string memory) {
        return _credentialCID[institution];
    }

    function nameOf(address institution) external view returns (string memory) {
        return _name[institution];
    }
}
