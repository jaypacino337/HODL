// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title OverbidMarket — one city-outcome prediction market
/// @notice An n-outcome fixed-product market maker (Gnosis FPMM design)
///         collateralized in USDG. Buying outcome i mints a complete set
///         (1 share of every outcome per 1 USDG — fully collateralized),
///         adds it to the pools, then pays out outcome-i shares to keep
///         ∏ pools constant. After the index window closes, the oracle
///         resolves the market and winning shares redeem 1:1 for USDG.
/// @dev    Mirrors packages/shared/src/amm.ts, which the website's demo
///         mode runs. Positions are an internal ledger (not ERC-1155) to
///         keep the v1 surface small.
contract OverbidMarket {
    uint256 internal constant ONE = 1e18;

    IERC20 public immutable collateral; // USDG
    address public immutable factory;
    address public immutable oracle;
    address public immutable creator; // fee recipient; House Pool for protocol markets
    address public immutable housePool;
    address public immutable treasury;

    string public question;
    string public settlementSource; // e.g. "Parcl Labs price feed, 2026-01-01..2026-12-31, max-gain"
    uint8 public immutable outcomeCount;
    uint64 public immutable locksAt; // trading stops (index window end)

    /// Fee on every trade, in wei-of-ONE (2e16 = 2%).
    uint256 public immutable feeBps18;
    /// Fee split, must sum to ONE. LPs carry the risk, LPs earn the most.
    uint256 public constant FEE_SHARE_LP = 0.7e18;
    uint256 public constant FEE_SHARE_CREATOR = 0.1e18;
    uint256 public constant FEE_SHARE_TREASURY = 0.2e18;

    /// AMM inventory of each outcome's shares.
    uint256[] public pools;
    /// user => outcome => share balance.
    mapping(address => mapping(uint8 => uint256)) public sharesOf;
    /// Undistributed fees (in USDG).
    uint256 public accruedFees;

    bool public resolved;
    uint8 public winningOutcome;

    event Buy(address indexed buyer, uint8 indexed outcome, uint256 investment, uint256 fee, uint256 sharesOut);
    event Sell(address indexed seller, uint8 indexed outcome, uint256 sharesIn, uint256 fee, uint256 amountOut);
    event Resolved(uint8 indexed winningOutcome);
    event Redeemed(address indexed holder, uint256 shares, uint256 amount);
    event FeesDistributed(uint256 toLp, uint256 toCreator, uint256 toTreasury);

    modifier onlyOpen() {
        require(!resolved && block.timestamp < locksAt, "market closed");
        _;
    }

    constructor(
        IERC20 _collateral,
        address _oracle,
        address _creator,
        address _housePool,
        address _treasury,
        string memory _question,
        string memory _settlementSource,
        uint8 _outcomeCount,
        uint64 _locksAt,
        uint256 _feeBps18
    ) {
        require(_outcomeCount >= 2 && _outcomeCount <= 8, "2..8 outcomes");
        require(_feeBps18 < ONE, "fee < 100%");
        factory = msg.sender;
        collateral = _collateral;
        oracle = _oracle;
        creator = _creator;
        housePool = _housePool;
        treasury = _treasury;
        question = _question;
        settlementSource = _settlementSource;
        outcomeCount = _outcomeCount;
        locksAt = _locksAt;
        feeBps18 = _feeBps18;
        pools = new uint256[](_outcomeCount);
    }

    /// @notice Seed liquidity: factory deposits `amount` USDG, minting `amount`
    ///         complete sets straight into the pools (uniform initial odds).
    function seed(uint256 amount) external {
        require(msg.sender == factory, "only factory");
        require(amount > 0, "zero seed");
        require(collateral.transferFrom(msg.sender, address(this), amount), "transfer failed");
        for (uint8 i = 0; i < outcomeCount; i++) {
            pools[i] += amount;
        }
    }

    // ── trading ───────────────────────────────────────────────────────────

    /// @notice Shares of `outcome` received for `investment` USDG, fee included.
    function calcBuyAmount(uint256 investment, uint8 outcome) public view returns (uint256) {
        require(outcome < outcomeCount, "bad outcome");
        uint256 a = investment - (investment * feeBps18) / ONE;
        uint256 buyPool = pools[outcome];
        uint256 ending = buyPool * ONE;
        for (uint8 i = 0; i < outcomeCount; i++) {
            if (i == outcome) continue;
            ending = _ceilDiv(ending * pools[i], pools[i] + a);
        }
        return buyPool + a - _ceilDiv(ending, ONE);
    }

    /// @notice Shares of `outcome` that must be sold to receive `returnAmount`
    ///         USDG net of fees.
    function calcSellAmount(uint256 returnAmount, uint8 outcome) public view returns (uint256) {
        require(outcome < outcomeCount, "bad outcome");
        uint256 gross = (returnAmount * ONE) / (ONE - feeBps18);
        uint256 sellPool = pools[outcome];
        uint256 ending = sellPool * ONE;
        for (uint8 i = 0; i < outcomeCount; i++) {
            if (i == outcome) continue;
            require(pools[i] > gross, "insufficient depth");
            ending = _ceilDiv(ending * pools[i], pools[i] - gross);
        }
        return gross + _ceilDiv(ending, ONE) - sellPool;
    }

    function buy(uint8 outcome, uint256 investment, uint256 minSharesOut) external onlyOpen returns (uint256 sharesOut) {
        sharesOut = calcBuyAmount(investment, outcome);
        require(sharesOut >= minSharesOut, "slippage");
        require(collateral.transferFrom(msg.sender, address(this), investment), "transfer failed");

        uint256 fee = (investment * feeBps18) / ONE;
        uint256 a = investment - fee;
        accruedFees += fee;

        // mint a complete set into every pool, hand outcome-shares to buyer
        for (uint8 i = 0; i < outcomeCount; i++) {
            pools[i] += a;
        }
        pools[outcome] -= sharesOut;
        sharesOf[msg.sender][outcome] += sharesOut;

        emit Buy(msg.sender, outcome, investment, fee, sharesOut);
    }

    function sell(uint8 outcome, uint256 returnAmount, uint256 maxSharesIn) external onlyOpen returns (uint256 sharesIn) {
        sharesIn = calcSellAmount(returnAmount, outcome);
        require(sharesIn <= maxSharesIn, "slippage");
        require(sharesOf[msg.sender][outcome] >= sharesIn, "insufficient shares");

        uint256 gross = (returnAmount * ONE) / (ONE - feeBps18);
        uint256 fee = gross - returnAmount;
        accruedFees += fee;

        sharesOf[msg.sender][outcome] -= sharesIn;
        pools[outcome] += sharesIn;
        // burn `gross` complete sets back into collateral
        for (uint8 i = 0; i < outcomeCount; i++) {
            require(pools[i] >= gross, "insufficient depth");
            pools[i] -= gross;
        }
        require(collateral.transfer(msg.sender, returnAmount), "transfer failed");

        emit Sell(msg.sender, outcome, sharesIn, fee, returnAmount);
    }

    /// @notice Implied probability of `outcome`, scaled by 1e18.
    function impliedProbability(uint8 outcome) external view returns (uint256) {
        require(outcome < outcomeCount, "bad outcome");
        // p_i ∝ 1 / pools[i]
        uint256 num;
        uint256 den;
        for (uint8 i = 0; i < outcomeCount; i++) {
            uint256 inv = (ONE * ONE) / pools[i];
            den += inv;
            if (i == outcome) num = inv;
        }
        return (num * ONE) / den;
    }

    // ── settlement ────────────────────────────────────────────────────────

    /// @notice Called by the oracle after the index window closes.
    function resolve(uint8 _winningOutcome) external {
        require(msg.sender == oracle, "only oracle");
        require(!resolved, "already resolved");
        require(block.timestamp >= locksAt, "window still open");
        require(_winningOutcome < outcomeCount, "bad outcome");
        resolved = true;
        winningOutcome = _winningOutcome;
        emit Resolved(_winningOutcome);
    }

    /// @notice Winning shares redeem 1:1 for USDG.
    function redeem() external returns (uint256 amount) {
        require(resolved, "not resolved");
        amount = sharesOf[msg.sender][winningOutcome];
        require(amount > 0, "nothing to redeem");
        sharesOf[msg.sender][winningOutcome] = 0;
        require(collateral.transfer(msg.sender, amount), "transfer failed");
        emit Redeemed(msg.sender, amount, amount);
    }

    /// @notice After resolution the AMM's own winning-outcome inventory (the
    ///         residual pool) plus leftover collateral belongs to the House
    ///         Pool — LPs carried the market risk.
    function sweepResidualToPool() external {
        require(resolved, "not resolved");
        uint256 residual = pools[winningOutcome];
        pools[winningOutcome] = 0;
        if (residual > 0) {
            require(collateral.transfer(housePool, residual), "transfer failed");
        }
    }

    // ── fees ──────────────────────────────────────────────────────────────

    /// @notice Anyone can push accrued fees out on the fixed 70/10/20 split.
    ///         For protocol-created markets `creator == housePool`, so the
    ///         creator cut also lands in the House Pool: creator fees fund
    ///         the liquidity pool.
    function distributeFees() external {
        uint256 fees = accruedFees;
        require(fees > 0, "no fees");
        accruedFees = 0;
        uint256 toLp = (fees * FEE_SHARE_LP) / ONE;
        uint256 toCreator = (fees * FEE_SHARE_CREATOR) / ONE;
        uint256 toTreasury = fees - toLp - toCreator;
        require(collateral.transfer(housePool, toLp), "lp transfer failed");
        require(collateral.transfer(creator, toCreator), "creator transfer failed");
        require(collateral.transfer(treasury, toTreasury), "treasury transfer failed");
        emit FeesDistributed(toLp, toCreator, toTreasury);
    }

    function poolBalances() external view returns (uint256[] memory) {
        return pools;
    }

    function _ceilDiv(uint256 x, uint256 y) private pure returns (uint256) {
        return x == 0 ? 0 : (x - 1) / y + 1;
    }
}
