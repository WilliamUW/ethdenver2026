//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/**
 * Stores a list of credit profiles per wallet address.
 * Simple: addProfile for msg.sender, getProfiles(address) to read.
 */
contract CreditPassport {
    struct CreditProfile {
        string country;
        string name;
        string score;
        uint256 ageMonths;
        uint256 cards;
        uint256 totalAccounts;
        string utilization;
        uint256 delinquencies;
        string ipfsCid;
        uint256 timestamp;
    }

    mapping(address => CreditProfile[]) private _profiles;

    event ProfileAdded(address indexed user, uint256 index);

    function addProfile(
        string calldata country,
        string calldata name,
        string calldata score,
        uint256 ageMonths,
        uint256 cards,
        uint256 totalAccounts,
        string calldata utilization,
        uint256 delinquencies,
        string calldata ipfsCid
    ) external {
        _profiles[msg.sender].push(
            CreditProfile({
                country: country,
                name: name,
                score: score,
                ageMonths: ageMonths,
                cards: cards,
                totalAccounts: totalAccounts,
                utilization: utilization,
                delinquencies: delinquencies,
                ipfsCid: ipfsCid,
                timestamp: block.timestamp
            })
        );
        emit ProfileAdded(msg.sender, _profiles[msg.sender].length - 1);
    }

    function getProfileCount(address user) external view returns (uint256) {
        return _profiles[user].length;
    }

    function getProfile(address user, uint256 index) external view returns (
        string memory country,
        string memory name,
        string memory score,
        uint256 ageMonths,
        uint256 cards,
        uint256 totalAccounts,
        string memory utilization,
        uint256 delinquencies,
        string memory ipfsCid,
        uint256 timestamp
    ) {
        CreditProfile storage p = _profiles[user][index];
        return (
            p.country,
            p.name,
            p.score,
            p.ageMonths,
            p.cards,
            p.totalAccounts,
            p.utilization,
            p.delinquencies,
            p.ipfsCid,
            p.timestamp
        );
    }

    /// Returns all profiles for a user in one call (convenience for frontends).
    function getProfiles(address user) external view returns (CreditProfile[] memory) {
        return _profiles[user];
    }
}
