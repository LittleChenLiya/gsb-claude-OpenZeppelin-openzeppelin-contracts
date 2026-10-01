// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.5.0) (token/ERC721/extensions/ERC721Votes.sol)

pragma solidity ^0.8.24;

import {Votes} from "../../../governance/utils/Votes.sol";
import {ERC721} from "../ERC721.sol";

/**
 * @dev Extension of ERC-721 to support voting and delegation as implemented by {Votes}, where each individual NFT counts
 * as 1 vote unit.
 *
 * Tokens do not count as votes until they are delegated, because votes must be tracked which incurs an additional cost
 * on every transfer. Token holders can either delegate to a trusted representative who will decide how to make use of
 * the votes in governance decisions, or they can delegate to themselves to be their own representative.
 */
abstract contract ERC721Votes is ERC721, Votes {
    /**
     * @dev See {ERC721-_update}. Adjusts votes when tokens are transferred.
     *
     * Emits a {IVotes-DelegateVotesChanged} event.
     */
    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        address previousOwner = super._update(to, tokenId, auth);

        _transferVotingUnits(previousOwner, to, 1);

        return previousOwner;
    }

    /**
     * @dev Returns the balance of `account`.
     *
     * WARNING: Overriding this function will likely result in incorrect vote tracking.
     */
    function _getVotingUnits(address account) internal view virtual override returns (uint256) {
        return balanceOf(account);
    }

    /**
     * @dev Returns the difference in voting power for `account` between two past timepoints.
     *
     * The difference is computed as `getPastVotes(account, toTimepoint) - getPastVotes(account, fromTimepoint)`.
     * A positive value indicates an increase in voting power, while a negative value indicates a decrease.
     *
     * NOTE: Both `fromTimepoint` and `toTimepoint` must be in the past. Historical checkpoints are never
     * modified by transfers or delegation changes, so the old snapshot keeps its original value.
     *
     * Requirements:
     *
     * - Both `fromTimepoint` and `toTimepoint` must be in the past (i.e. strictly less than the current clock).
     */
    function getPastVotesDifference(
        address account,
        uint256 fromTimepoint,
        uint256 toTimepoint
    ) public view virtual returns (int256) {
        int256 fromVotes = int256(getPastVotes(account, fromTimepoint));
        int256 toVotes = int256(getPastVotes(account, toTimepoint));
        return toVotes - fromVotes;
    }

    /**
     * @dev See {ERC721-_increaseBalance}. We need that to account tokens that were minted in batch.
     */
    function _increaseBalance(address account, uint128 amount) internal virtual override {
        super._increaseBalance(account, amount);
        _transferVotingUnits(address(0), account, amount);
    }
}
