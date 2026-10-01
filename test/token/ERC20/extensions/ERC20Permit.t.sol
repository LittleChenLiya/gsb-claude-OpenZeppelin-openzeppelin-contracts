// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

contract PermitToken is ERC20, ERC20Permit {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) ERC20Permit(name_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ERC20PermitTest is Test {
    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    uint256 private constant OWNER_PK = 0xA11CE;
    uint256 private constant OTHER_PK = 0xB0B;

    PermitToken private token;
    address private owner;
    address private spender;
    address private other;

    function setUp() public {
        owner = vm.addr(OWNER_PK);
        other = vm.addr(OTHER_PK);
        spender = makeAddr("spender");
        token = new PermitToken("My Token", "MTKN");
        token.mint(owner, 1000 ether);
        vm.chainId(31337);
    }

    // --- helpers ---

    function _structHash(address owner_, address spender_, uint256 value, uint256 nonce, uint256 deadline)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(PERMIT_TYPEHASH, owner_, spender_, value, nonce, deadline));
    }

    function _digest(
        address owner_,
        address spender_,
        uint256 value,
        uint256 nonce,
        uint256 deadline,
        bytes32 domainSeparator
    ) internal pure returns (bytes32) {
        return
            MessageHashUtils.toTypedDataHash(
                domainSeparator,
                _structHash(owner_, spender_, value, nonce, deadline)
            );
    }

    /// @dev Rebuilds the EIP-712 domain separator that a signer would see on `chainId`.
    function _foreignDomainSeparator(uint256 chainId) internal view returns (bytes32) {
        (, string memory name, string memory version, , address verifyingContract, , ) = token.eip712Domain();
        return
            keccak256(
                abi.encode(
                    DOMAIN_TYPEHASH,
                    keccak256(bytes(name)),
                    keccak256(bytes(version)),
                    chainId,
                    verifyingContract
                )
            );
    }

    function _sign(uint256 pk, bytes32 digest) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        return vm.sign(pk, digest);
    }

    // --- tests ---

    function testInitialNonceIsZero() public view {
        assertEq(token.nonces(owner), 0);
    }

    function testDomainSeparatorMatchesEIP712() public view {
        (
            bytes1 fields,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            bytes32 salt,
            uint256[] memory extensions
        ) = token.eip712Domain();

        bytes32 expected = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifyingContract
            )
        );

        assertEq(token.DOMAIN_SEPARATOR(), expected);
        assertEq(chainId, block.chainid);
        assertEq(verifyingContract, address(token));
        assertEq(fields, hex"0f");
        assertEq(salt, bytes32(0));
        assertEq(extensions.length, 0);
    }

    /// @dev Correct signature: the pre-check returns true and does not consume the nonce;
    ///      a subsequent {permit} then succeeds and consumes the nonce.
    function testPermitCheckAcceptsValidSignatureAndDoesNotConsumeNonce() public {
        uint256 value = 42 ether;
        uint256 nonce = token.nonces(owner);
        uint256 deadline = block.timestamp + 1 days;

        bytes32 digest = _digest(owner, spender, value, nonce, deadline, token.DOMAIN_SEPARATOR());
        (uint8 v, bytes32 r, bytes32 s) = _sign(OWNER_PK, digest);

        // the pre-check succeeds ...
        assertTrue(token.permitCheck(owner, spender, value, nonce, deadline, v, r, s));
        // ... and does not consume the nonce
        assertEq(token.nonces(owner), nonce);

        // the actual permit then succeeds and consumes the nonce
        token.permit(owner, spender, value, deadline, v, r, s);
        assertEq(token.nonces(owner), nonce + 1);
        assertEq(token.allowance(owner, spender), value);
    }

    /// @dev Cross-chain domain: a signature produced for chain id 1 must be rejected on chain id
    ///      31337 because the on-chain domain separator (chain id) does not match.
    function testPermitCheckRejectsCrossChainDomain() public {
        uint256 value = 42 ether;
        uint256 nonce = token.nonces(owner);
        uint256 deadline = block.timestamp + 1 days;

        // sign over a domain claiming chain id 1 (mainnet), while the token lives on chain 31337
        bytes32 foreignDomain = _foreignDomainSeparator(1);
        bytes32 digest = _digest(owner, spender, value, nonce, deadline, foreignDomain);
        (uint8 v, bytes32 r, bytes32 s) = _sign(OWNER_PK, digest);

        // the on-chain domain separator uses chain id 31337, so recovery yields a different signer
        bytes32 onChainDigest = _digest(owner, spender, value, nonce, deadline, token.DOMAIN_SEPARATOR());
        address recovered = ECDSA.recover(onChainDigest, v, r, s);
        vm.expectRevert(abi.encodeWithSelector(ERC20Permit.ERC2612InvalidSigner.selector, recovered, owner));
        token.permitCheck(owner, spender, value, nonce, deadline, v, r, s);

        // the check must not consume the nonce
        assertEq(token.nonces(owner), nonce);
    }

    /// @dev Wrong chain id: the signature is produced on chain 31337, then the chain id changes;
    ///      the rebuilt domain separator no longer matches and the check must reject.
    function testPermitCheckRejectsChainIdChange() public {
        uint256 value = 42 ether;
        uint256 nonce = token.nonces(owner);
        uint256 deadline = block.timestamp + 1 days;

        // sign on the local chain (31337) ...
        bytes32 digest = _digest(owner, spender, value, nonce, deadline, token.DOMAIN_SEPARATOR());
        (uint8 v, bytes32 r, bytes32 s) = _sign(OWNER_PK, digest);

        // ... then move the fork to chain id 1: the domain separator rebuilds with chain id 1
        vm.chainId(1);
        bytes32 onChainDigest = _digest(owner, spender, value, nonce, deadline, token.DOMAIN_SEPARATOR());
        address recovered = ECDSA.recover(onChainDigest, v, r, s);
        vm.expectRevert(abi.encodeWithSelector(ERC20Permit.ERC2612InvalidSigner.selector, recovered, owner));
        token.permitCheck(owner, spender, value, nonce, deadline, v, r, s);
    }

    /// @dev Expired signature: the check must reject and must not consume the nonce.
    function testPermitCheckRejectsExpiredSignature() public {
        uint256 value = 42 ether;
        uint256 nonce = token.nonces(owner);
        uint256 deadline = block.timestamp - 1; // already expired

        bytes32 digest = _digest(owner, spender, value, nonce, deadline, token.DOMAIN_SEPARATOR());
        (uint8 v, bytes32 r, bytes32 s) = _sign(OWNER_PK, digest);

        vm.expectRevert(abi.encodeWithSelector(ERC20Permit.ERC2612ExpiredSignature.selector, deadline));
        token.permitCheck(owner, spender, value, nonce, deadline, v, r, s);

        assertEq(token.nonces(owner), nonce);
    }

    /// @dev Duplicate submission: after {permit} consumes the nonce, re-checking the same
    ///      signature must fail on the nonce, and re-submitting {permit} must also be rejected.
    function testPermitCheckRejectsDuplicateSubmission() public {
        uint256 value = 42 ether;
        uint256 nonce = token.nonces(owner);
        uint256 deadline = block.timestamp + 1 days;

        bytes32 digest = _digest(owner, spender, value, nonce, deadline, token.DOMAIN_SEPARATOR());
        (uint8 v, bytes32 r, bytes32 s) = _sign(OWNER_PK, digest);

        // first submission succeeds and consumes the nonce
        token.permit(owner, spender, value, deadline, v, r, s);
        assertEq(token.nonces(owner), nonce + 1);

        // pre-checking the same signature again now fails on the nonce
        vm.expectRevert(abi.encodeWithSelector(Nonces.InvalidAccountNonce.selector, owner, nonce + 1));
        token.permitCheck(owner, spender, value, nonce, deadline, v, r, s);

        // re-submitting the permit itself is also rejected (replay protection)
        bytes32 replayedDigest = _digest(owner, spender, value, nonce + 1, deadline, token.DOMAIN_SEPARATOR());
        address recovered = ECDSA.recover(replayedDigest, v, r, s);
        vm.expectRevert(abi.encodeWithSelector(ERC20Permit.ERC2612InvalidSigner.selector, recovered, owner));
        token.permit(owner, spender, value, deadline, v, r, s);
    }

    /// @dev Nonce mismatch: a signature carrying a future nonce must be rejected.
    function testPermitCheckRejectsWrongNonce() public {
        uint256 value = 42 ether;
        uint256 nonce = token.nonces(owner) + 1; // sign with a future nonce
        uint256 deadline = block.timestamp + 1 days;

        bytes32 digest = _digest(owner, spender, value, nonce, deadline, token.DOMAIN_SEPARATOR());
        (uint8 v, bytes32 r, bytes32 s) = _sign(OWNER_PK, digest);

        vm.expectRevert(abi.encodeWithSelector(Nonces.InvalidAccountNonce.selector, owner, nonce - 1));
        token.permitCheck(owner, spender, value, nonce, deadline, v, r, s);
    }

    /// @dev Wrong signer: a signature from another key must be rejected.
    function testPermitCheckRejectsOtherSigner() public {
        uint256 value = 42 ether;
        uint256 nonce = token.nonces(owner);
        uint256 deadline = block.timestamp + 1 days;

        bytes32 digest = _digest(owner, spender, value, nonce, deadline, token.DOMAIN_SEPARATOR());
        (uint8 v, bytes32 r, bytes32 s) = _sign(OTHER_PK, digest);

        vm.expectRevert(abi.encodeWithSelector(ERC20Permit.ERC2612InvalidSigner.selector, other, owner));
        token.permitCheck(owner, spender, value, nonce, deadline, v, r, s);
    }
}
