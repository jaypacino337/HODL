// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OverbidMarket} from "./OverbidMarket.sol";

/// @title IndexOracle — posts housing-index values and resolves markets
/// @notice v1 is a transparent-but-trusted oracle: an allow-listed poster
///         (the oracle worker in packages/oracle-worker) writes index values
///         sourced from Parcl Labs onto the chain, then resolves markets
///         against them. Every observation is stored, so anyone can audit
///         that a resolution matches the posted series. Decentralizing this
///         (multiple posters + dispute window) is the road-map step after
///         launch. Non-US feeds (e.g. Toronto) need a licensed provider and
///         their own adapter before markets can reference them.
contract IndexOracle {
    address public owner;
    mapping(address => bool) public posters;

    /// feedId = keccak256("parcl:price-feed:miami") etc.
    /// feedId => observation date (unix day) => value (1e6 fixed point).
    mapping(bytes32 => mapping(uint64 => uint256)) public observations;

    event Posted(bytes32 indexed feedId, uint64 indexed date, uint256 value);
    event MarketResolved(address indexed market, uint8 winningOutcome, bytes32 evidence);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier onlyPoster() {
        require(posters[msg.sender], "only poster");
        _;
    }

    constructor() {
        owner = msg.sender;
        posters[msg.sender] = true;
    }

    function setPoster(address poster, bool allowed) external onlyOwner {
        posters[poster] = allowed;
    }

    function setOwner(address _owner) external onlyOwner {
        owner = _owner;
    }

    function post(bytes32 feedId, uint64 date, uint256 value) external onlyPoster {
        require(value > 0, "zero value");
        observations[feedId][date] = value;
        emit Posted(feedId, date, value);
    }

    function postBatch(bytes32[] calldata feedIds, uint64[] calldata dates, uint256[] calldata values)
        external
        onlyPoster
    {
        require(feedIds.length == dates.length && dates.length == values.length, "length mismatch");
        for (uint256 i = 0; i < feedIds.length; i++) {
            require(values[i] > 0, "zero value");
            observations[feedIds[i]][dates[i]] = values[i];
            emit Posted(feedIds[i], dates[i], values[i]);
        }
    }

    /// @notice Resolve a market. `evidence` commits to the feed ids + window
    ///         used, so the resolution is auditable against `observations`.
    function resolveMarket(OverbidMarket market, uint8 winningOutcome, bytes32 evidence) external onlyPoster {
        market.resolve(winningOutcome);
        emit MarketResolved(address(market), winningOutcome, evidence);
    }
}
