// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.6.0) (utils/cryptography/MerkleProof.sol)
// This file was procedurally generated from scripts/generate/templates/MerkleProof.sol.eta.

pragma solidity ^0.8.20;

import {Hashes} from "./Hashes.sol";

/**
 * @dev These functions deal with verification of Merkle Tree proofs.
 *
 * The tree and the proofs can be generated using our
 * https://github.com/OpenZeppelin/merkle-tree[JavaScript library].
 * You will find a quickstart guide in the readme.
 *
 * WARNING: You should avoid using leaf values that are 64 bytes long prior to
 * hashing, or use a hash function other than keccak256 for hashing leaves.
 * This is because the concatenation of a sorted pair of internal nodes in
 * the Merkle tree could be reinterpreted as a leaf value.
 * OpenZeppelin's JavaScript library generates Merkle trees that are safe
 * against this attack out of the box.
 *
 * IMPORTANT: Consider memory side-effects when using custom hashing functions
 * that access memory in an unsafe way.
 *
 * NOTE: This library supports proof verification for merkle trees built using
 * custom _commutative_ hashing functions (i.e. `H(a, b) == H(b, a)`). Proving
 * leaf inclusion in trees built using non-commutative hashing functions requires
 * additional logic that is not supported by this library.
 */
library MerkleProof {
    /**
     * @dev Sentinel returned by {validateMultiProof} when the multiproof is structurally valid.
     */
    uint256 internal constant MULTIPROOF_VALID = type(uint256).max;

    /**
     * @dev The multiproof provided is not valid.
     */
    error MerkleProofInvalidMultiproof();

    /**
     * @dev Returns true if a `leaf` can be proved to be a part of a Merkle tree
     * defined by `root`. For this, a `proof` must be provided, containing
     * sibling hashes on the branch from the leaf to the root of the tree. Each
     * pair of leaves and each pair of pre-images are assumed to be sorted.
     *
     * This version handles proofs in memory with the default hashing function.
     */
    function verify(bytes32[] memory proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        return processProof(proof, leaf) == root;
    }

    /**
     * @dev Returns the rebuilt hash obtained by traversing a Merkle tree up
     * from `leaf` using `proof`. A `proof` is valid if and only if the rebuilt
     * hash matches the root of the tree. When processing the proof, the pairs
     * of leaves & pre-images are assumed to be sorted.
     *
     * This version handles proofs in memory with the default hashing function.
     */
    function processProof(bytes32[] memory proof, bytes32 leaf) internal pure returns (bytes32) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            computedHash = Hashes.commutativeKeccak256(computedHash, proof[i]);
        }
        return computedHash;
    }

    /**
     * @dev Returns true if a `leaf` can be proved to be a part of a Merkle tree
     * defined by `root`. For this, a `proof` must be provided, containing
     * sibling hashes on the branch from the leaf to the root of the tree. Each
     * pair of leaves and each pair of pre-images are assumed to be sorted.
     *
     * This version handles proofs in memory with a custom hashing function.
     */
    function verify(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf,
        function(bytes32, bytes32) view returns (bytes32) hasher
    ) internal view returns (bool) {
        return processProof(proof, leaf, hasher) == root;
    }

    /**
     * @dev Returns the rebuilt hash obtained by traversing a Merkle tree up
     * from `leaf` using `proof`. A `proof` is valid if and only if the rebuilt
     * hash matches the root of the tree. When processing the proof, the pairs
     * of leaves & pre-images are assumed to be sorted.
     *
     * This version handles proofs in memory with a custom hashing function.
     */
    function processProof(
        bytes32[] memory proof,
        bytes32 leaf,
        function(bytes32, bytes32) view returns (bytes32) hasher
    ) internal view returns (bytes32) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            computedHash = hasher(computedHash, proof[i]);
        }
        return computedHash;
    }

    /**
     * @dev Returns true if a `leaf` can be proved to be a part of a Merkle tree
     * defined by `root`. For this, a `proof` must be provided, containing
     * sibling hashes on the branch from the leaf to the root of the tree. Each
     * pair of leaves and each pair of pre-images are assumed to be sorted.
     *
     * This version handles proofs in calldata with the default hashing function.
     */
    function verifyCalldata(bytes32[] calldata proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        return processProofCalldata(proof, leaf) == root;
    }

    /**
     * @dev Returns the rebuilt hash obtained by traversing a Merkle tree up
     * from `leaf` using `proof`. A `proof` is valid if and only if the rebuilt
     * hash matches the root of the tree. When processing the proof, the pairs
     * of leaves & pre-images are assumed to be sorted.
     *
     * This version handles proofs in calldata with the default hashing function.
     */
    function processProofCalldata(bytes32[] calldata proof, bytes32 leaf) internal pure returns (bytes32) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            computedHash = Hashes.commutativeKeccak256(computedHash, proof[i]);
        }
        return computedHash;
    }

    /**
     * @dev Returns true if a `leaf` can be proved to be a part of a Merkle tree
     * defined by `root`. For this, a `proof` must be provided, containing
     * sibling hashes on the branch from the leaf to the root of the tree. Each
     * pair of leaves and each pair of pre-images are assumed to be sorted.
     *
     * This version handles proofs in calldata with a custom hashing function.
     */
    function verifyCalldata(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf,
        function(bytes32, bytes32) view returns (bytes32) hasher
    ) internal view returns (bool) {
        return processProofCalldata(proof, leaf, hasher) == root;
    }

    /**
     * @dev Returns the rebuilt hash obtained by traversing a Merkle tree up
     * from `leaf` using `proof`. A `proof` is valid if and only if the rebuilt
     * hash matches the root of the tree. When processing the proof, the pairs
     * of leaves & pre-images are assumed to be sorted.
     *
     * This version handles proofs in calldata with a custom hashing function.
     */
    function processProofCalldata(
        bytes32[] calldata proof,
        bytes32 leaf,
        function(bytes32, bytes32) view returns (bytes32) hasher
    ) internal view returns (bytes32) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            computedHash = hasher(computedHash, proof[i]);
        }
        return computedHash;
    }

    /**
     * @dev Returns true if the `leaves` can be simultaneously proven to be a part of a Merkle tree defined by
     * `root`, according to `proof` and `proofFlags` as described in {processMultiProof}.
     *
     * This version handles multiproofs in memory with the default hashing function.
     *
     * CAUTION: Not all Merkle trees admit multiproofs. See {processMultiProof} for details.
     *
     * NOTE: Consider the case where `root == proof[0] && leaves.length == 0` as it will return `true`.
     * The `leaves` must be validated independently. See {processMultiProof}.
     */
    function multiProofVerify(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32 root,
        bytes32[] memory leaves
    ) internal pure returns (bool) {
        return processMultiProof(proof, proofFlags, leaves) == root;
    }

    /**
     * @dev Returns the root of a tree reconstructed from `leaves` and sibling nodes in `proof`. The reconstruction
     * proceeds by incrementally reconstructing all inner nodes by combining a leaf/inner node with either another
     * leaf/inner node or a proof sibling node, depending on whether each `proofFlags` item is true or false
     * respectively.
     *
     * This version handles multiproofs in memory with the default hashing function.
     *
     * CAUTION: Not all Merkle trees admit multiproofs. To use multiproofs, it is sufficient to ensure that: 1) the tree
     * is complete (but not necessarily perfect), 2) the leaves to be proven are in the opposite order they are in the
     * tree (i.e., as seen from right to left starting at the deepest layer and continuing at the next layer).
     *
     * NOTE: The _empty set_ (i.e. the case where `proof.length == 1 && leaves.length == 0`) is considered a no-op,
     * and therefore a valid multiproof (i.e. it returns `proof[0]`). Consider disallowing this case if you're not
     * validating the leaves elsewhere.
     */
    function processMultiProof(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32[] memory leaves
    ) internal pure returns (bytes32 merkleRoot) {
        // This function rebuilds the root hash by traversing the tree up from the leaves. The root is rebuilt by
        // consuming and producing values on a queue. The queue starts with the `leaves` array, then goes onto the
        // `hashes` array. At the end of the process, the last hash in the `hashes` array should contain the root of
        // the Merkle tree.
        uint256 leavesLen = leaves.length;
        uint256 proofFlagsLen = proofFlags.length;

        // Check proof validity.
        if (leavesLen + proof.length != proofFlagsLen + 1) {
            revert MerkleProofInvalidMultiproof();
        }

        if (proofFlagsLen > 0) {
            // The xxxPos values are "pointers" to the next value to consume in each array. All accesses are done using
            // `xxx[xxxPos++]`, which return the current value and increment the pointer, thus mimicking a queue's "pop".
            bytes32[] memory hashes = new bytes32[](proofFlagsLen);
            uint256 leafPos = 0;
            uint256 hashPos = 0;
            uint256 proofPos = 0;
            // At each step, we compute the next hash using two values:
            // - a value from the "main queue". If not all leaves have been consumed, we get the next leaf, otherwise we
            //   get the next hash.
            // - depending on the flag, either another value from the "main queue" (merging branches) or an element from the
            //   `proof` array.
            for (uint256 i = 0; i < proofFlagsLen; i++) {
                bytes32 a = leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++];
                bytes32 b = proofFlags[i]
                    ? (leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++])
                    : proof[proofPos++];
                hashes[i] = Hashes.commutativeKeccak256(a, b);
            }
            if (proofPos != proof.length) {
                revert MerkleProofInvalidMultiproof();
            }
            unchecked {
                return hashes[proofFlagsLen - 1];
            }
        } else if (leavesLen > 0) {
            return leaves[0];
        } else {
            return proof[0];
        }
    }

    /**
     * @dev Returns true if the `leaves` can be simultaneously proven to be a part of a Merkle tree defined by
     * `root`, according to `proof` and `proofFlags` as described in {processMultiProof}.
     *
     * This version handles multiproofs in memory with a custom hashing function.
     *
     * CAUTION: Not all Merkle trees admit multiproofs. See {processMultiProof} for details.
     *
     * NOTE: Consider the case where `root == proof[0] && leaves.length == 0` as it will return `true`.
     * The `leaves` must be validated independently. See {processMultiProof}.
     */
    function multiProofVerify(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32 root,
        bytes32[] memory leaves,
        function(bytes32, bytes32) view returns (bytes32) hasher
    ) internal view returns (bool) {
        return processMultiProof(proof, proofFlags, leaves, hasher) == root;
    }

    /**
     * @dev Returns the root of a tree reconstructed from `leaves` and sibling nodes in `proof`. The reconstruction
     * proceeds by incrementally reconstructing all inner nodes by combining a leaf/inner node with either another
     * leaf/inner node or a proof sibling node, depending on whether each `proofFlags` item is true or false
     * respectively.
     *
     * This version handles multiproofs in memory with a custom hashing function.
     *
     * CAUTION: Not all Merkle trees admit multiproofs. To use multiproofs, it is sufficient to ensure that: 1) the tree
     * is complete (but not necessarily perfect), 2) the leaves to be proven are in the opposite order they are in the
     * tree (i.e., as seen from right to left starting at the deepest layer and continuing at the next layer).
     *
     * NOTE: The _empty set_ (i.e. the case where `proof.length == 1 && leaves.length == 0`) is considered a no-op,
     * and therefore a valid multiproof (i.e. it returns `proof[0]`). Consider disallowing this case if you're not
     * validating the leaves elsewhere.
     */
    function processMultiProof(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32[] memory leaves,
        function(bytes32, bytes32) view returns (bytes32) hasher
    ) internal view returns (bytes32 merkleRoot) {
        // This function rebuilds the root hash by traversing the tree up from the leaves. The root is rebuilt by
        // consuming and producing values on a queue. The queue starts with the `leaves` array, then goes onto the
        // `hashes` array. At the end of the process, the last hash in the `hashes` array should contain the root of
        // the Merkle tree.
        uint256 leavesLen = leaves.length;
        uint256 proofFlagsLen = proofFlags.length;

        // Check proof validity.
        if (leavesLen + proof.length != proofFlagsLen + 1) {
            revert MerkleProofInvalidMultiproof();
        }

        if (proofFlagsLen > 0) {
            // The xxxPos values are "pointers" to the next value to consume in each array. All accesses are done using
            // `xxx[xxxPos++]`, which return the current value and increment the pointer, thus mimicking a queue's "pop".
            bytes32[] memory hashes = new bytes32[](proofFlagsLen);
            uint256 leafPos = 0;
            uint256 hashPos = 0;
            uint256 proofPos = 0;
            // At each step, we compute the next hash using two values:
            // - a value from the "main queue". If not all leaves have been consumed, we get the next leaf, otherwise we
            //   get the next hash.
            // - depending on the flag, either another value from the "main queue" (merging branches) or an element from the
            //   `proof` array.
            for (uint256 i = 0; i < proofFlagsLen; i++) {
                bytes32 a = leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++];
                bytes32 b = proofFlags[i]
                    ? (leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++])
                    : proof[proofPos++];
                hashes[i] = hasher(a, b);
            }
            if (proofPos != proof.length) {
                revert MerkleProofInvalidMultiproof();
            }
            unchecked {
                return hashes[proofFlagsLen - 1];
            }
        } else if (leavesLen > 0) {
            return leaves[0];
        } else {
            return proof[0];
        }
    }

    /**
     * @dev Returns true if the `leaves` can be simultaneously proven to be a part of a Merkle tree defined by
     * `root`, according to `proof` and `proofFlags` as described in {processMultiProof}.
     *
     * This version handles multiproofs in calldata with the default hashing function.
     *
     * CAUTION: Not all Merkle trees admit multiproofs. See {processMultiProof} for details.
     *
     * NOTE: Consider the case where `root == proof[0] && leaves.length == 0` as it will return `true`.
     * The `leaves` must be validated independently. See {processMultiProofCalldata}.
     */
    function multiProofVerifyCalldata(
        bytes32[] calldata proof,
        bool[] calldata proofFlags,
        bytes32 root,
        bytes32[] memory leaves
    ) internal pure returns (bool) {
        return processMultiProofCalldata(proof, proofFlags, leaves) == root;
    }

    /**
     * @dev Returns the root of a tree reconstructed from `leaves` and sibling nodes in `proof`. The reconstruction
     * proceeds by incrementally reconstructing all inner nodes by combining a leaf/inner node with either another
     * leaf/inner node or a proof sibling node, depending on whether each `proofFlags` item is true or false
     * respectively.
     *
     * This version handles multiproofs in calldata with the default hashing function.
     *
     * CAUTION: Not all Merkle trees admit multiproofs. To use multiproofs, it is sufficient to ensure that: 1) the tree
     * is complete (but not necessarily perfect), 2) the leaves to be proven are in the opposite order they are in the
     * tree (i.e., as seen from right to left starting at the deepest layer and continuing at the next layer).
     *
     * NOTE: The _empty set_ (i.e. the case where `proof.length == 1 && leaves.length == 0`) is considered a no-op,
     * and therefore a valid multiproof (i.e. it returns `proof[0]`). Consider disallowing this case if you're not
     * validating the leaves elsewhere.
     */
    function processMultiProofCalldata(
        bytes32[] calldata proof,
        bool[] calldata proofFlags,
        bytes32[] memory leaves
    ) internal pure returns (bytes32 merkleRoot) {
        // This function rebuilds the root hash by traversing the tree up from the leaves. The root is rebuilt by
        // consuming and producing values on a queue. The queue starts with the `leaves` array, then goes onto the
        // `hashes` array. At the end of the process, the last hash in the `hashes` array should contain the root of
        // the Merkle tree.
        uint256 leavesLen = leaves.length;
        uint256 proofFlagsLen = proofFlags.length;

        // Check proof validity.
        if (leavesLen + proof.length != proofFlagsLen + 1) {
            revert MerkleProofInvalidMultiproof();
        }

        if (proofFlagsLen > 0) {
            // The xxxPos values are "pointers" to the next value to consume in each array. All accesses are done using
            // `xxx[xxxPos++]`, which return the current value and increment the pointer, thus mimicking a queue's "pop".
            bytes32[] memory hashes = new bytes32[](proofFlagsLen);
            uint256 leafPos = 0;
            uint256 hashPos = 0;
            uint256 proofPos = 0;
            // At each step, we compute the next hash using two values:
            // - a value from the "main queue". If not all leaves have been consumed, we get the next leaf, otherwise we
            //   get the next hash.
            // - depending on the flag, either another value from the "main queue" (merging branches) or an element from the
            //   `proof` array.
            for (uint256 i = 0; i < proofFlagsLen; i++) {
                bytes32 a = leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++];
                bytes32 b = proofFlags[i]
                    ? (leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++])
                    : proof[proofPos++];
                hashes[i] = Hashes.commutativeKeccak256(a, b);
            }
            if (proofPos != proof.length) {
                revert MerkleProofInvalidMultiproof();
            }
            unchecked {
                return hashes[proofFlagsLen - 1];
            }
        } else if (leavesLen > 0) {
            return leaves[0];
        } else {
            return proof[0];
        }
    }

    /**
     * @dev Returns true if the `leaves` can be simultaneously proven to be a part of a Merkle tree defined by
     * `root`, according to `proof` and `proofFlags` as described in {processMultiProof}.
     *
     * This version handles multiproofs in calldata with a custom hashing function.
     *
     * CAUTION: Not all Merkle trees admit multiproofs. See {processMultiProof} for details.
     *
     * NOTE: Consider the case where `root == proof[0] && leaves.length == 0` as it will return `true`.
     * The `leaves` must be validated independently. See {processMultiProofCalldata}.
     */
    function multiProofVerifyCalldata(
        bytes32[] calldata proof,
        bool[] calldata proofFlags,
        bytes32 root,
        bytes32[] memory leaves,
        function(bytes32, bytes32) view returns (bytes32) hasher
    ) internal view returns (bool) {
        return processMultiProofCalldata(proof, proofFlags, leaves, hasher) == root;
    }

    /**
     * @dev Returns the root of a tree reconstructed from `leaves` and sibling nodes in `proof`. The reconstruction
     * proceeds by incrementally reconstructing all inner nodes by combining a leaf/inner node with either another
     * leaf/inner node or a proof sibling node, depending on whether each `proofFlags` item is true or false
     * respectively.
     *
     * This version handles multiproofs in calldata with a custom hashing function.
     *
     * CAUTION: Not all Merkle trees admit multiproofs. To use multiproofs, it is sufficient to ensure that: 1) the tree
     * is complete (but not necessarily perfect), 2) the leaves to be proven are in the opposite order they are in the
     * tree (i.e., as seen from right to left starting at the deepest layer and continuing at the next layer).
     *
     * NOTE: The _empty set_ (i.e. the case where `proof.length == 1 && leaves.length == 0`) is considered a no-op,
     * and therefore a valid multiproof (i.e. it returns `proof[0]`). Consider disallowing this case if you're not
     * validating the leaves elsewhere.
     */
    function processMultiProofCalldata(
        bytes32[] calldata proof,
        bool[] calldata proofFlags,
        bytes32[] memory leaves,
        function(bytes32, bytes32) view returns (bytes32) hasher
    ) internal view returns (bytes32 merkleRoot) {
        // This function rebuilds the root hash by traversing the tree up from the leaves. The root is rebuilt by
        // consuming and producing values on a queue. The queue starts with the `leaves` array, then goes onto the
        // `hashes` array. At the end of the process, the last hash in the `hashes` array should contain the root of
        // the Merkle tree.
        uint256 leavesLen = leaves.length;
        uint256 proofFlagsLen = proofFlags.length;

        // Check proof validity.
        if (leavesLen + proof.length != proofFlagsLen + 1) {
            revert MerkleProofInvalidMultiproof();
        }

        if (proofFlagsLen > 0) {
            // The xxxPos values are "pointers" to the next value to consume in each array. All accesses are done using
            // `xxx[xxxPos++]`, which return the current value and increment the pointer, thus mimicking a queue's "pop".
            bytes32[] memory hashes = new bytes32[](proofFlagsLen);
            uint256 leafPos = 0;
            uint256 hashPos = 0;
            uint256 proofPos = 0;
            // At each step, we compute the next hash using two values:
            // - a value from the "main queue". If not all leaves have been consumed, we get the next leaf, otherwise we
            //   get the next hash.
            // - depending on the flag, either another value from the "main queue" (merging branches) or an element from the
            //   `proof` array.
            for (uint256 i = 0; i < proofFlagsLen; i++) {
                bytes32 a = leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++];
                bytes32 b = proofFlags[i]
                    ? (leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++])
                    : proof[proofPos++];
                hashes[i] = hasher(a, b);
            }
            if (proofPos != proof.length) {
                revert MerkleProofInvalidMultiproof();
            }
            unchecked {
                return hashes[proofFlagsLen - 1];
            }
        } else if (leavesLen > 0) {
            return leaves[0];
        } else {
            return proof[0];
        }
    }

    /**
     * @dev Pre-checks the _structure_ of a multiproof without performing any hash computation, and returns the
     * index of the first `proofFlags` entry that makes the multiproof structurally invalid.
     *
     * This version handles multiproofs in memory.
     *
     * Returns {MULTIPROOF_VALID} if the multiproof is structurally valid. In that case, {processMultiProof}
     * does not revert for structural reasons (it may still produce a root that differs from the expected one).
     * Otherwise, the returned value is the index (in `proofFlags`) of the first step whose reconstruction is
     * impossible. If the issue is global (i.e. `leaves.length + proof.length != proofFlags.length + 1`, or the
     * reconstruction ends with unconsumed nodes), the returned value is `proofFlags.length`.
     *
     * This pre-check is independent of the hashing function and does NOT replace the root comparison performed by
     * {multiProofVerify}: a structurally valid multiproof can still verify against a different root.
     *
     * The _empty set_ (i.e. the case where `proof.length == 1 && leaves.length == 0`) is considered valid, matching
     * {processMultiProof}.
     */
    function validateMultiProof(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32[] memory leaves
    ) internal pure returns (uint256) {
        uint256 leavesLen = leaves.length;
        uint256 proofFlagsLen = proofFlags.length;

        // Global counting invariant: every flag combines 2 inputs into 1 output, and the reconstruction ends
        // with a single root.
        if (leavesLen + proof.length != proofFlagsLen + 1) {
            return proofFlagsLen;
        }

        // A multiproof with no flag is a no-op: it consists of a single leaf, or a single element in `proof`.
        if (proofFlagsLen == 0) {
            return MULTIPROOF_VALID;
        }

        // Simulate the reconstruction performed by {processMultiProof}, keeping track of the number of
        // values available in the "main queue" (first the leaves, then the hashes produced at earlier steps) and of
        // the number of nodes consumed from `proof`. No hashing is performed: only the availability of inputs is
        // checked, so that the first structurally invalid step can be located.
        uint256 available = leavesLen;
        uint256 proofPos = 0;
        for (uint256 i = 0; i < proofFlagsLen; i++) {
            // One value from the "main queue" is always needed.
            if (available == 0) {
                return i;
            }
            available--;
            if (proofFlags[i]) {
                // A second value from the "main queue" is needed to merge two branches.
                if (available == 0) {
                    return i;
                }
                available--;
            } else {
                // A node from `proof` is needed as the second value.
                if (proofPos >= proof.length) {
                    return i;
                }
                proofPos++;
            }
            // Combining two values produces one new hash.
            available++;
        }
        // All nodes from `proof` must have been consumed.
        return proofPos == proof.length ? MULTIPROOF_VALID : proofFlagsLen;
    }

    /**
     * @dev Pre-checks the _structure_ of a multiproof without performing any hash computation, and returns the
     * index of the first `proofFlags` entry that makes the multiproof structurally invalid.
     *
     * This version handles multiproofs in calldata.
     *
     * Returns {MULTIPROOF_VALID} if the multiproof is structurally valid. In that case, {processMultiProofCalldata}
     * does not revert for structural reasons (it may still produce a root that differs from the expected one).
     * Otherwise, the returned value is the index (in `proofFlags`) of the first step whose reconstruction is
     * impossible. If the issue is global (i.e. `leaves.length + proof.length != proofFlags.length + 1`, or the
     * reconstruction ends with unconsumed nodes), the returned value is `proofFlags.length`.
     *
     * This pre-check is independent of the hashing function and does NOT replace the root comparison performed by
     * {multiProofVerifyCalldata}: a structurally valid multiproof can still verify against a different root.
     *
     * The _empty set_ (i.e. the case where `proof.length == 1 && leaves.length == 0`) is considered valid, matching
     * {processMultiProofCalldata}.
     */
    function validateMultiProofCalldata(
        bytes32[] calldata proof,
        bool[] calldata proofFlags,
        bytes32[] memory leaves
    ) internal pure returns (uint256) {
        uint256 leavesLen = leaves.length;
        uint256 proofFlagsLen = proofFlags.length;

        // Global counting invariant: every flag combines 2 inputs into 1 output, and the reconstruction ends
        // with a single root.
        if (leavesLen + proof.length != proofFlagsLen + 1) {
            return proofFlagsLen;
        }

        // A multiproof with no flag is a no-op: it consists of a single leaf, or a single element in `proof`.
        if (proofFlagsLen == 0) {
            return MULTIPROOF_VALID;
        }

        // Simulate the reconstruction performed by {processMultiProofCalldata}, keeping track of the number of
        // values available in the "main queue" (first the leaves, then the hashes produced at earlier steps) and of
        // the number of nodes consumed from `proof`. No hashing is performed: only the availability of inputs is
        // checked, so that the first structurally invalid step can be located.
        uint256 available = leavesLen;
        uint256 proofPos = 0;
        for (uint256 i = 0; i < proofFlagsLen; i++) {
            // One value from the "main queue" is always needed.
            if (available == 0) {
                return i;
            }
            available--;
            if (proofFlags[i]) {
                // A second value from the "main queue" is needed to merge two branches.
                if (available == 0) {
                    return i;
                }
                available--;
            } else {
                // A node from `proof` is needed as the second value.
                if (proofPos >= proof.length) {
                    return i;
                }
                proofPos++;
            }
            // Combining two values produces one new hash.
            available++;
        }
        // All nodes from `proof` must have been consumed.
        return proofPos == proof.length ? MULTIPROOF_VALID : proofFlagsLen;
    }
}
