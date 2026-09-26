// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title TreasuryExecutor — the only path from a board decision to funds
/// @notice Agents recommend; they never sign. Passed proposals become
///         execution intents that a keeper submits HERE, and this contract
///         enforces the public treasury policy no matter what the keeper,
///         the models, or the chat said:
///
///         - allowlisted action types only (v1: TRANSFER, BURN)
///         - per-action and daily spending limits
///         - recipient allowlist + hard ban on agent wallets
///         - intent expiry and idempotency keys (no duplicate execution)
///         - emergency pause; owner (multisig) override for config only
///
///         v1 deliberately supports the money legs it can enforce: TRANSFER
///         to allowlisted recipients (funding, airdrop distributor) and BURN
///         (buyback's burn leg). Swap legs wait for an audited venue adapter
///         — the board can pass them, but they queue for the multisig.
contract TreasuryExecutor {
    enum Action {
        TRANSFER,
        BURN
    }

    address public owner; // protocol multisig: config + pause only
    address public keeper; // guarded automation that submits passed intents
    bool public paused;

    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    mapping(address => bool) public recipientAllowed;
    mapping(address => bool) public agentWallet; // permanently banned recipients
    /// token => per-single-action max (0 = token not allowlisted).
    mapping(address => uint256) public perActionLimit;
    /// token => day (unix/86400) => amount spent.
    mapping(address => mapping(uint256 => uint256)) public spentOnDay;
    mapping(address => uint256) public dailyLimit;
    /// idempotency: an intent key can execute at most once, ever.
    mapping(bytes32 => bool) public executed;

    event Executed(bytes32 indexed key, Action action, address token, address to, uint256 amount);
    event Paused(bool paused);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(address _keeper) {
        owner = msg.sender;
        keeper = _keeper;
    }

    // ── config (multisig) ───────────────────────────────────────────────────

    function setOwner(address o) external onlyOwner {
        owner = o;
    }

    function setKeeper(address k) external onlyOwner {
        keeper = k;
    }

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit Paused(p);
    }

    function setRecipient(address r, bool ok) external onlyOwner {
        require(!agentWallet[r], "agent wallet");
        recipientAllowed[r] = ok;
    }

    /// @notice Marking an agent wallet is one-way — it can never be unmarked
    ///         and never allowlisted. No self-dealing, permanently.
    function banAgentWallet(address a) external onlyOwner {
        agentWallet[a] = true;
        recipientAllowed[a] = false;
    }

    function setTokenLimits(address token, uint256 perAction, uint256 perDay) external onlyOwner {
        perActionLimit[token] = perAction;
        dailyLimit[token] = perDay;
    }

    // ── execution ───────────────────────────────────────────────────────────

    /// @notice Execute one passed intent. `key` must be unique per proposal
    ///         execution (hash of proposal id + revision, computed off-chain
    ///         and recorded in the receipt).
    function execute(bytes32 key, Action action, address token, address to, uint256 amount, uint64 expiresAt)
        external
        returns (bool)
    {
        require(msg.sender == keeper || msg.sender == owner, "only keeper/owner");
        require(!paused, "paused");
        require(!executed[key], "duplicate execution");
        require(block.timestamp <= expiresAt, "intent expired");
        require(amount > 0, "zero amount");

        uint256 limit = perActionLimit[token];
        require(limit > 0, "token not allowlisted");
        require(amount <= limit, "per-action limit");

        uint256 day = block.timestamp / 86400;
        require(spentOnDay[token][day] + amount <= dailyLimit[token], "daily limit");

        address dest;
        if (action == Action.BURN) {
            require(to == BURN_ADDRESS || to == address(0), "burn goes to dead address");
            dest = BURN_ADDRESS;
        } else {
            require(!agentWallet[to], "no payments to agent wallets");
            require(recipientAllowed[to], "recipient not allowlisted");
            dest = to;
        }

        executed[key] = true;
        spentOnDay[token][day] += amount;
        require(IERC20(token).transfer(dest, amount), "transfer failed");
        emit Executed(key, action, token, dest, amount);
        return true;
    }
}
