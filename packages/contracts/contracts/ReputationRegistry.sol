// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CrisisToken.sol";

contract ReputationRegistry {
    CrisisToken public immutable token;
    address public oracle;

    mapping(address => uint256) private _reputation;
    mapping(address => bool) private _isExpert;
    mapping(address => string) private _expertType;

    event ReputationUpdated(address indexed user, uint256 score);
    event ExpertVerified(address indexed user, bool verified, string expertType);

    modifier onlyOracle() {
        require(msg.sender == oracle, "ReputationRegistry: not oracle");
        _;
    }

    constructor(address tokenAddress, address oracleAddress) {
        token = CrisisToken(tokenAddress);
        oracle = oracleAddress;
    }

    function setReputation(address user, uint256 score) external onlyOracle {
        _reputation[user] = score;
        emit ReputationUpdated(user, score);
    }

    function setExpert(address user, bool verified, string calldata expType)
        external onlyOracle
    {
        _isExpert[user] = verified;
        _expertType[user] = expType;
        emit ExpertVerified(user, verified, expType);
    }

    function reputationOf(address user) external view returns (uint256) {
        return _reputation[user];
    }

    function isExpert(address user) external view returns (bool) {
        return _isExpert[user];
    }

    function expertType(address user) external view returns (string memory) {
        return _expertType[user];
    }

    /// @notice Voting power = floor(sqrt(tokenBalance * reputation))
    function votingPower(address user) external view returns (uint256) {
        uint256 bal = token.getVotes(user);
        uint256 rep = _reputation[user] == 0 ? 1 : _reputation[user];
        return _sqrt(bal * rep);
    }

    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) { y = z; z = (x / z + z) / 2; }
        return y;
    }
}
