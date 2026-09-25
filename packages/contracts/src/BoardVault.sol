// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title BoardVault — the five permanently locked 1% agent allocations
/// @notice Each board agent's $BOARD governance allocation lives in one seat
///         of this vault. The lock is structural, not administrative:
///
///         - there is NO transfer function,
///         - there is NO withdraw function,
///         - there is NO owner, admin, upgrade path or rescue hook.
///
///         Once a seat is funded, those tokens can never move again. Seat
///         delegates are *identities* (the addresses agents vote/sign with);
///         they never possess the tokens and receive nothing from the vault.
///         The allocations are governance alignment, not equity, and
///         `isExcluded` lets reward/airdrop systems exclude them on-chain.
contract BoardVault {
    IERC20 public immutable board;
    uint8 public constant SEATS = 5;

    /// seatIndex => locked token amount (only ever increases).
    uint256[SEATS] public lockedOf;
    /// seatIndex => the agent's public governance identity.
    address[SEATS] public delegateOf;
    /// seat names, fixed at deployment ("BULL", "BURN", ...).
    string[SEATS] public seatName;

    bool public funded;
    address public immutable funder; // may fund seats exactly once, then is powerless

    event SeatFunded(uint8 indexed seat, string name, address delegate, uint256 amount);

    constructor(IERC20 _board, string[SEATS] memory names, address[SEATS] memory delegates) {
        board = _board;
        funder = msg.sender;
        for (uint8 i = 0; i < SEATS; i++) {
            require(delegates[i] != address(0), "zero delegate");
            seatName[i] = names[i];
            delegateOf[i] = delegates[i];
        }
    }

    /// @notice One-shot funding of all five seats. Pulls `amountPerSeat` per
    ///         seat from the funder (5 × 1% of supply at launch) and locks it
    ///         forever. Callable exactly once, by the deployer only.
    function fundSeats(uint256 amountPerSeat) external {
        require(msg.sender == funder, "only funder");
        require(!funded, "already funded");
        require(amountPerSeat > 0, "zero amount");
        funded = true;
        for (uint8 i = 0; i < SEATS; i++) {
            require(board.transferFrom(msg.sender, address(this), amountPerSeat), "transfer failed");
            lockedOf[i] = amountPerSeat;
            emit SeatFunded(i, seatName[i], delegateOf[i], amountPerSeat);
        }
    }

    function totalLocked() external view returns (uint256 sum) {
        for (uint8 i = 0; i < SEATS; i++) sum += lockedOf[i];
    }

    /// @notice True for the vault itself and every seat delegate — reward and
    ///         airdrop systems must exclude these addresses.
    function isExcluded(address who) external view returns (bool) {
        if (who == address(this)) return true;
        for (uint8 i = 0; i < SEATS; i++) {
            if (delegateOf[i] == who) return true;
        }
        return false;
    }
}
