// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CampaignVault.sol";

contract CampaignFactory {
    address public immutable dao;
    address public immutable oracle;
    address public immutable institutionRegistry;
    address public immutable opsTreasury;
    address public immutable rewardPool;
    address public immutable protocolReserve;

    address[] public campaigns;

    event CampaignCreated(uint256 indexed id, address vault, string metadataCID);

    modifier onlyOracle() { require(msg.sender == oracle, "Not oracle"); _; }

    constructor(
        address _dao, address _oracle, address _registry,
        address _ops, address _reward, address _protocol
    ) {
        dao = _dao; oracle = _oracle; institutionRegistry = _registry;
        opsTreasury = _ops; rewardPool = _reward; protocolReserve = _protocol;
    }

    function createCampaign(uint256 deadlineDays, string calldata metadataCID)
        external onlyOracle returns (address)
    {
        CampaignVault vault = new CampaignVault(
            dao, oracle, institutionRegistry,
            opsTreasury, rewardPool, protocolReserve,
            deadlineDays
        );
        uint256 id = campaigns.length;
        campaigns.push(address(vault));
        emit CampaignCreated(id, address(vault), metadataCID);
        return address(vault);
    }

    function campaignCount() external view returns (uint256) {
        return campaigns.length;
    }
}
