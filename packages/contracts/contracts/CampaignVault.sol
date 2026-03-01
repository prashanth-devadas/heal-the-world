// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./InstitutionRegistry.sol";

contract CampaignVault {
    enum Status { ACTIVE, TRIGGERED, VOTING, FUNDED, REFUNDABLE, EXPIRED }

    Status public status;
    address public immutable dao;
    address public immutable oracle;
    InstitutionRegistry public immutable institutionRegistry;
    address public immutable opsTreasury;
    address public immutable rewardPool;
    address public immutable protocolReserve;

    uint256 public totalRaised;
    uint256 public campaignDeadline;
    uint256 public refundDeadline;

    mapping(address => uint256) public donations;

    event Donated(address indexed donor, uint256 amount);
    event Triggered();
    event MarkedRefundable(uint256 deadline);
    event RefundClaimed(address indexed donor, uint256 amount);
    event Disbursed(address indexed institution, uint256 amount, uint256 fee);

    modifier onlyDAO() { require(msg.sender == dao, "Not DAO"); _; }
    modifier onlyOracle() { require(msg.sender == oracle, "Not oracle"); _; }
    modifier onlyDAOorOracle() {
        require(msg.sender == dao || msg.sender == oracle, "Not authorized");
        _;
    }

    constructor(
        address _dao,
        address _oracle,
        address _registry,
        address _opsTreasury,
        address _rewardPool,
        address _protocolReserve,
        uint256 deadlineDays
    ) {
        dao = _dao;
        oracle = _oracle;
        institutionRegistry = InstitutionRegistry(_registry);
        opsTreasury = _opsTreasury;
        rewardPool = _rewardPool;
        protocolReserve = _protocolReserve;
        campaignDeadline = block.timestamp + (deadlineDays * 1 days);
        status = Status.ACTIVE;
    }

    function donate() external payable {
        require(status == Status.ACTIVE, "Not accepting donations");
        donations[msg.sender] += msg.value;
        totalRaised += msg.value;
        emit Donated(msg.sender, msg.value);
    }

    function markTriggered() external onlyOracle {
        require(status == Status.ACTIVE, "Wrong status");
        status = Status.TRIGGERED;
        emit Triggered();
    }

    function markRefundable() external onlyDAOorOracle {
        require(
            status == Status.ACTIVE ||
            status == Status.TRIGGERED ||
            status == Status.VOTING,
            "Wrong status"
        );
        status = Status.REFUNDABLE;
        refundDeadline = block.timestamp + 90 days;
        emit MarkedRefundable(refundDeadline);
    }

    function claimRefund() external {
        require(status == Status.REFUNDABLE, "Not in refund state");
        require(block.timestamp <= refundDeadline, "Refund window closed");
        uint256 amount = donations[msg.sender];
        require(amount > 0, "Nothing to refund");
        donations[msg.sender] = 0; // CEI: state before transfer
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");
        emit RefundClaimed(msg.sender, amount);
    }

    function disburse(address institution) external onlyDAO {
        require(
            status == Status.TRIGGERED || status == Status.VOTING,
            "Wrong status"
        );
        require(institutionRegistry.isVerified(institution), "Institution not verified");

        uint256 balance = address(this).balance;
        uint256 fee = balance * 150 / 10000; // 1.5%
        uint256 share = fee / 3;

        status = Status.FUNDED;

        _safeTransfer(opsTreasury, share);
        _safeTransfer(rewardPool, share);
        _safeTransfer(protocolReserve, fee - (share * 2));
        _safeTransfer(institution, address(this).balance);

        emit Disbursed(institution, address(this).balance, fee);
    }

    function sweep(address reliefPool) external onlyDAO {
        require(status == Status.REFUNDABLE, "Not refundable");
        require(block.timestamp > refundDeadline, "Window still open");
        _safeTransfer(reliefPool, address(this).balance);
    }

    function _safeTransfer(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok,) = payable(to).call{value: amount}("");
        require(ok, "Transfer failed");
    }
}
