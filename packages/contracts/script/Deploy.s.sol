// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../src/interfaces/IERC20.sol";
import {HousePool} from "../src/HousePool.sol";
import {IndexOracle} from "../src/IndexOracle.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {OverbidMarket} from "../src/OverbidMarket.sol";
import {MockUSDG} from "../src/test/MockUSDG.sol";

/// Minimal cheatcode surface so this script needs no forge-std checkout.
interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
    function envOr(string calldata name, address defaultValue) external returns (address);
    function envOr(string calldata name, uint256 defaultValue) external returns (uint256);
}

/// @title Deploy — one-command OVERBID testnet deployment
/// @notice Deploys the full stack and creates the five launch markets:
///
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url arbitrum_sepolia --private-key $KEY --broadcast
///
/// (If you sign with a keystore or hardware wallet instead of --private-key,
/// also pass --sender <your address> so msg.sender is your account.)
///
/// Env overrides:
///   USDG=0x...        use an existing collateral token (default: deploy MockUSDG)
///   SEED_USD=50       per-market seed in whole dollars   (default 50)
///   POOL_FLOAT_USD=500  extra idle USDG deposited to the House Pool (default 500)
///
/// The five launch markets mirror packages/shared/src/markets.ts. Timestamps
/// are the markets' lock times (UTC): edit both files together if they change.
contract Deploy {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint64 internal constant LOCKS_AUG_31_2026 = 1788220799; // 2026-08-31T23:59:59Z
    uint64 internal constant LOCKS_SEP_30_2026 = 1790812799; // 2026-09-30T23:59:59Z
    uint64 internal constant LOCKS_DEC_31_2026 = 1798761599; // 2026-12-31T23:59:59Z

    bytes32 internal constant TPL_CITY_RACE = keccak256("city-race:max-gain");
    bytes32 internal constant TPL_BINARY = keccak256("binary:index-change");

    function run() external {
        uint256 seed = vm.envOr("SEED_USD", uint256(50)) * 1e6;
        uint256 poolFloat = vm.envOr("POOL_FLOAT_USD", uint256(500)) * 1e6;
        address usdgAddr = vm.envOr("USDG", address(0));

        vm.startBroadcast();

        // 1 · collateral
        if (usdgAddr == address(0)) {
            MockUSDG mock = new MockUSDG();
            mock.mint(msg.sender, 5 * seed + poolFloat);
            usdgAddr = address(mock);
        }
        IERC20 usdg = IERC20(usdgAddr);

        // 2 · core
        HousePool pool = new HousePool(usdg);
        IndexOracle oracle = new IndexOracle();
        MarketFactory factory = new MarketFactory(usdg, pool, address(oracle), msg.sender);
        pool.setFactory(address(factory));

        // 3 · templates
        factory.setTemplate(TPL_CITY_RACE, true, "city-race:max-gain", "Parcl Labs metro price feed (US only)");
        factory.setTemplate(TPL_BINARY, true, "binary:index-change", "Parcl Labs price/rental feed (US only)");

        // 4 · fund the pool: seeds for five markets + idle float for the vault
        usdg.approve(address(pool), 5 * seed + poolFloat);
        pool.deposit(5 * seed + poolFloat);

        // 5 · the launch board (order matches packages/shared/src/markets.ts)
        factory.createProtocolMarket(
            TPL_CITY_RACE,
            "Hottest housing market of 2026",
            "Parcl Labs price feeds, 2026-01-01..2026-12-31, max % gain: miami/new-york/austin/phoenix/chicago",
            5,
            LOCKS_DEC_31_2026,
            seed
        );
        factory.createProtocolMarket(
            TPL_CITY_RACE,
            "Austin vs Phoenix - Q3 head-to-head",
            "Parcl Labs price feeds, 2026-07-01..2026-09-30, better % change: austin/phoenix",
            2,
            LOCKS_SEP_30_2026,
            seed
        );
        factory.createProtocolMarket(
            TPL_BINARY,
            "Manhattan rent growth positive in August?",
            "Parcl Labs NY rental feed, 2026-08-01..2026-08-31, YES iff change > 0",
            2,
            LOCKS_AUG_31_2026,
            seed
        );
        factory.createProtocolMarket(
            TPL_BINARY,
            "Miami up 5%+ in 2026?",
            "Parcl Labs Miami price feed, 2026-01-01..2026-12-31, YES iff change >= 5%",
            2,
            LOCKS_DEC_31_2026,
            seed
        );
        factory.createProtocolMarket(
            TPL_BINARY,
            "US housing up this quarter?",
            "Parcl Labs US aggregate feed, 2026-07-01..2026-09-30, YES iff change > 0",
            2,
            LOCKS_SEP_30_2026,
            seed
        );

        vm.stopBroadcast();
    }
}
