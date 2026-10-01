// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.8.0) (token/ERC20/extensions/ERC20Permit.sol)

pragma solidity ^0.8.24;

import {ECDSA} from "../../../utils/cryptography/ECDSA.sol";
import {EIP712} from "../../../utils/cryptography/EIP712.sol";
import {Nonces} from "../../../utils/Nonces.sol";
import {ERC20} from "../ERC20.sol";
import {IERC20Permit} from "./IERC20Permit.sol";

/**
 * @dev Implementation of the ERC-20 Permit extension allowing approvals to be made via signatures, as defined in
 * https://eips.ethereum.org/EIPS/eip-2612[ERC-2612].
 *
 * Adds the {permit} method, which can be used to change an account's ERC-20 allowance (see {IERC20-allowance}) by
 * presenting a message signed by the account. By not relying on `{IERC20-approve}`, the token holder account doesn't
 * need to send a transaction, and thus is not required to hold Ether at all.
 */
abstract contract ERC20Permit is ERC20, IERC20Permit, EIP712, Nonces {
    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    /**
     * @dev Permit deadline has expired.
     */
    error ERC2612ExpiredSignature(uint256 deadline);

    /**
     * @dev Mismatched signature.
     */
    error ERC2612InvalidSigner(address signer, address owner);

    /**
     * @dev Initializes the {EIP712} domain separator using the `name` parameter, and setting `version` to `"1"`.
     *
     * It's a good idea to use the same `name` that is defined as the ERC-20 token name.
     */
    constructor(string memory name) EIP712(name, "1") {}

    /// @inheritdoc IERC20Permit
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual {
        if (block.timestamp > deadline) {
            revert ERC2612ExpiredSignature(deadline);
        }

        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, _useNonce(owner), deadline));

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, v, r, s);
        if (signer != owner) {
            revert ERC2612InvalidSigner(signer, owner);
        }

        _approve(owner, spender, value);
    }

    /**
     * @dev Returns true if the given permit signature is currently valid for `owner`, and false otherwise.
     *
     * This helper performs the same checks as {permit} (deadline not expired, EIP-712 domain — including the
     * chain ID — and the current nonce of `owner`) but WITHOUT consuming the nonce or setting any allowance.
     *
     * It lets callers (e.g. relayers or frontends) verify that a permit's domain and nonce match this contract
     * before submitting a {permit} transaction. A signature created for a different chain ID or a stale nonce
     * will not match and this function will return false.
     *
     * NOTE: A `true` result is only a snapshot of the current block. The signature may become invalid if the
     * nonce is consumed or the deadline passes before {permit} is executed.
     */
    function isValidPermit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public view virtual returns (bool) {
        if (block.timestamp > deadline) {
            return false;
        }

        // Read (not consume) the current nonce, so this check never invalidates a pending permit.
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonces(owner), deadline));

        bytes32 hash = _hashTypedDataV4(structHash);

        (address signer, ECDSA.RecoverError error, ) = ECDSA.tryRecover(hash, v, r, s);
        return error == ECDSA.RecoverError.NoError && signer == owner;
    }

    /// @inheritdoc IERC20Permit
    function nonces(address owner) public view virtual override(IERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    /// @inheritdoc IERC20Permit
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
