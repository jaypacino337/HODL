// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {OverbidMarket} from "./OverbidMarket.sol";
import {HousePool} from "./HousePool.sol";

/// @title MarketFactory — creates OVERBID markets from approved templates
/// @notice Anyone can launch a market, but ONLY from a template the protocol
///         has approved (a settlement rule + data source that the oracle can
///         actually serve). That keeps every market objectively settleable
///         and stops junk feeds. Creators earn 10% of trading fees on the
///         markets they launch; when the protocol itself creates a market
///         the "creator" is the House Pool, so that cut funds liquidity.
contract MarketFactory {
    IERC20 public immutable collateral; // USDG
    HousePool public immutable housePool;
    address public immutable oracle;
    address public treasury;
    address public owner;

    /// 2% trade fee, 1e18 scale.
    uint256 public constant TRADE_FEE = 0.02e18;

    struct Template {
        bool approved;
        string name; // e.g. "city-race:max-gain", "binary:threshold"
        string sourceRequirement; // e.g. "Parcl Labs metro price feed (US only)"
    }

    mapping(bytes32 => Template) public templates;
    address[] public allMarkets;
    mapping(address => bool) public isMarket;
    /// House Pool seed still counted as deployed, per protocol market.
    mapping(address => uint256) public seedOf;

    event TemplateSet(bytes32 indexed id, bool approved, string name);
    event MarketCreated(
        address indexed market, bytes32 indexed templateId, address indexed creator, uint256 seedFromPool, uint256 seedFromCreator
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(IERC20 _collateral, HousePool _housePool, address _oracle, address _treasury) {
        collateral = _collateral;
        housePool = _housePool;
        oracle = _oracle;
        treasury = _treasury;
        owner = msg.sender;
    }

    function setTemplate(bytes32 id, bool approved, string calldata name, string calldata sourceRequirement)
        external
        onlyOwner
    {
        templates[id] = Template(approved, name, sourceRequirement);
        emit TemplateSet(id, approved, name);
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function setOwner(address _owner) external onlyOwner {
        owner = _owner;
    }

    /// @notice Protocol launch: seed drawn from the House Pool, creator fee
    ///         cut assigned to the House Pool. This is how the first five
    ///         markets ship.
    function createProtocolMarket(
        bytes32 templateId,
        string calldata question,
        string calldata settlementSource,
        uint8 outcomeCount,
        uint64 locksAt,
        uint256 seedFromPool
    ) external onlyOwner returns (OverbidMarket market) {
        market = _create(templateId, address(housePool), question, settlementSource, outcomeCount, locksAt);
        if (seedFromPool > 0) {
            housePool.drawSeed(address(market), seedFromPool);
            require(collateral.transferFrom(address(housePool), address(this), seedFromPool), "draw failed");
            collateral.approve(address(market), seedFromPool);
            market.seed(seedFromPool);
            seedOf[address(market)] = seedFromPool;
        }
        emit MarketCreated(address(market), templateId, address(housePool), seedFromPool, 0);
    }

    /// @notice Community launch: creator brings their own seed liquidity and
    ///         earns the 10% creator fee cut on the market's volume.
    function createMarket(
        bytes32 templateId,
        string calldata question,
        string calldata settlementSource,
        uint8 outcomeCount,
        uint64 locksAt,
        uint256 seedFromCreator
    ) external returns (OverbidMarket market) {
        require(seedFromCreator > 0, "creator must seed");
        market = _create(templateId, msg.sender, question, settlementSource, outcomeCount, locksAt);
        require(collateral.transferFrom(msg.sender, address(this), seedFromCreator), "seed transfer failed");
        collateral.approve(address(market), seedFromCreator);
        market.seed(seedFromCreator);
        emit MarketCreated(address(market), templateId, msg.sender, 0, seedFromCreator);
    }

    function _create(
        bytes32 templateId,
        address creator,
        string calldata question,
        string calldata settlementSource,
        uint8 outcomeCount,
        uint64 locksAt
    ) private returns (OverbidMarket market) {
        require(templates[templateId].approved, "template not approved");
        require(locksAt > block.timestamp, "locks in past");
        market = new OverbidMarket(
            collateral, oracle, creator, address(housePool), treasury, question, settlementSource, outcomeCount, locksAt, TRADE_FEE
        );
        allMarkets.push(address(market));
        isMarket[address(market)] = true;
    }

    /// @notice After a protocol market resolves, anyone can reconcile the
    ///         House Pool's books: the seed is no longer deployed capital
    ///         (the market's residual value returns via sweepResidualToPool),
    ///         so stop counting it in totalAssets. Without this the pool
    ///         double-counts settled seeds and the last LP cannot withdraw.
    function reconcileSettled(address market) external {
        require(isMarket[market], "unknown market");
        require(OverbidMarket(market).resolved(), "not resolved");
        uint256 seedAmount = seedOf[market];
        require(seedAmount > 0, "nothing to reconcile");
        seedOf[market] = 0;
        housePool.markSeedReturned(seedAmount);
    }

    function marketCount() external view returns (uint256) {
        return allMarkets.length;
    }
}
