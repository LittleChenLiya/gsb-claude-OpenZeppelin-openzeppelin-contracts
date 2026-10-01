// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.7.0) (token/ERC721/extensions/ERC721Votes.sol)

pragma solidity ^0.8.24;

import {Votes} from "../../../governance/utils/Votes.sol";
import {SafeCast} from "../../../utils/math/SafeCast.sol";
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
     * @dev Returns the difference in the amount of votes that `account` had between two past timepoints. The result is
     * the voting balance at `newTimepoint` minus the voting balance at `oldTimepoint`, so a positive value indicates
     * that `account` gained votes over the interval, while a negative value indicates that it lost votes.
     *
     * This is a convenience view over {getPastVotes} that is useful, for example, to audit the impact of a batch of
     * mints, delegations and transfers that took place between two voting snapshots.
     *
     * Requirements:
     *
     * - Both timepoints must be in the past. If operating using block numbers, the blocks must be already mined.
     * - Historical snapshots are immutable, so votes that are transferred or redelegated after a timepoint do not
     * affect the value returned for it.
     */
    function getPastVotesDifference(
        address account,
        uint256 oldTimepoint,
        uint256 newTimepoint
    ) public view virtual returns (int256) {
        return
            SafeCast.toInt256(getPastVotes(account, newTimepoint)) -
            SafeCast.toInt256(getPastVotes(account, oldTimepoint));
    }

    /**
     * @dev See {ERC721-_increaseBalance}. We need that to account tokens that were minted in batch.
     */
    function _increaseBalance(address account, uint128 amount) internal virtual override {
        super._increaseBalance(account, amount);
        _transferVotingUnits(address(0), account, amount);
    }
}
