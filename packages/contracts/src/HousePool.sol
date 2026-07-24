// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title HousePool — OVERBID's LP vault
/// @notice Liquidity providers deposit USDG and receive pool shares. The pool
///         seeds new markets (via the factory), earns 70% of every trading
///         fee, receives residual AMM inventory when markets settle, and —
///         for protocol-created markets — the creator fee cut too. LP shares
///         are the "holders get a piece" mechanism: the people funding the
///         book earn the book's fees, and carry its market risk.
/// @dev    Share accounting is ERC-4626-style but deliberately minimal.
///         `totalAssets` = idle USDG here + capital deployed as market seeds.
contract HousePool {
    string public constant name = "OVERBID House Pool";
    string public constant symbol = "ovLP";
    uint8 public constant decimals = 18;

    IERC20 public immutable asset; // USDG
    address public owner; // protocol multisig
    address public factory; // allowed to draw seed capital

    uint256 public totalShares;
    mapping(address => uint256) public sharesOf;
    /// USDG currently deployed as live-market seed liquidity.
    uint256 public deployedAssets;

    event Deposit(address indexed lp, uint256 assets, uint256 shares);
    event Withdraw(address indexed lp, uint256 assets, uint256 shares);
    event SeedDeployed(address indexed market, uint256 assets);
    event SeedReturned(uint256 assets);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(IERC20 _asset) {
        asset = _asset;
        owner = msg.sender;
    }

    function setFactory(address _factory) external onlyOwner {
        factory = _factory;
    }

    function setOwner(address _owner) external onlyOwner {
        owner = _owner;
    }

    /// @notice Idle + deployed capital. Fees and settlement residues arrive as
    ///         plain USDG transfers, so they raise every LP share's value.
    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this)) + deployedAssets;
    }

    function deposit(uint256 assets) external returns (uint256 shares) {
        require(assets > 0, "zero deposit");
        uint256 total = totalAssets();
        shares = totalShares == 0 ? assets : (assets * totalShares) / total;
        require(shares > 0, "zero shares");
        require(asset.transferFrom(msg.sender, address(this), assets), "transfer failed");
        totalShares += shares;
        sharesOf[msg.sender] += shares;
        emit Deposit(msg.sender, assets, shares);
    }

    function withdraw(uint256 shares) external returns (uint256 assets) {
        require(shares > 0 && sharesOf[msg.sender] >= shares, "bad shares");
        assets = (shares * totalAssets()) / totalShares;
        require(asset.balanceOf(address(this)) >= assets, "capital deployed; try later");
        sharesOf[msg.sender] -= shares;
        totalShares -= shares;
        require(asset.transfer(msg.sender, assets), "transfer failed");
        emit Withdraw(msg.sender, assets, shares);
    }

    /// @notice Factory draws seed capital for a newly created market.
    function drawSeed(address market, uint256 assets) external {
        require(msg.sender == factory, "only factory");
        deployedAssets += assets;
        require(asset.approve(factory, assets), "approve failed");
        emit SeedDeployed(market, assets);
    }

    /// @notice Book deployed capital back in when a market's residual sweeps
    ///         home (the USDG itself arrives via plain transfer).
    function markSeedReturned(uint256 assets) external {
        require(msg.sender == factory, "only factory");
        deployedAssets = deployedAssets >= assets ? deployedAssets - assets : 0;
        emit SeedReturned(assets);
    }
}
