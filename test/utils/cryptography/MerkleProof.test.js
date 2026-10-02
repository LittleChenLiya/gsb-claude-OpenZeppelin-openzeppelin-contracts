import { network } from 'hardhat';
import { expect } from 'chai';
import { PANIC_CODES } from '@nomicfoundation/hardhat-ethers-chai-matchers/panic';
import { SimpleMerkleTree } from '@openzeppelin/merkle-tree';
import * as random from '../../helpers/random';

const { ethers } = await network.create();

// generate bytes32 leaves from a string
const toLeaves = (str, separator = '') => str.split(separator).map(e => ethers.keccak256(ethers.toUtf8Bytes(e)));
// internal node hashes
const concatSorted = (...elements) => Buffer.concat(elements.map(ethers.getBytes).sort(Buffer.compare));
const defaultHash = (a, b) => ethers.keccak256(concatSorted(a, b));
const customHash = (a, b) => ethers.sha256(concatSorted(a, b));

// Sentinel returned by `validateMultiProof` when the multiproof is structurally valid
const MULTIPROOF_VALID = ethers.MaxUint256;

describe('MerkleProof', function () {
  for (const { title, contractName, nodeHash } of [
    { title: 'default hash', contractName: '$MerkleProof', nodeHash: defaultHash },
    { title: 'custom hash', contractName: '$MerkleProofCustomHashMock', nodeHash: customHash },
  ]) {
    describe(title, function () {
      // stateless: no need for a fixture, just use before
      before(async function () {
        this.mock = await ethers.deployContract(contractName);
        this.makeTree = str => SimpleMerkleTree.of(toLeaves(str), { nodeHash });
      });

      describe('verify', function () {
        it('returns true for a valid Merkle proof', async function () {
          const merkleTree = this.makeTree('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=');

          const root = merkleTree.root;
          const hash = merkleTree.at(0);
          const proof = merkleTree.getProof(0);

          expect(await this.mock.$processProof(proof, hash)).to.equal(root);
          expect(await this.mock.$processProofCalldata(proof, hash)).to.equal(root);
          expect(await this.mock.$verify(proof, root, hash)).to.be.true;
          expect(await this.mock.$verifyCalldata(proof, root, hash)).to.be.true;

          // For demonstration, it is also possible to create valid proofs for certain 64-byte values *not* in elements:
          const noSuchLeaf = nodeHash(hash, proof.at(0));

          expect(await this.mock.$processProof(proof.slice(1), noSuchLeaf)).to.equal(root);
          expect(await this.mock.$processProofCalldata(proof.slice(1), noSuchLeaf)).to.equal(root);
          expect(await this.mock.$verify(proof.slice(1), root, noSuchLeaf)).to.be.true;
          expect(await this.mock.$verifyCalldata(proof.slice(1), root, noSuchLeaf)).to.be.true;
        });

        it('returns false for an invalid Merkle proof', async function () {
          const correctMerkleTree = this.makeTree('abc');
          const otherMerkleTree = this.makeTree('def');

          const root = correctMerkleTree.root;
          const hash = correctMerkleTree.at(0);
          const proof = otherMerkleTree.getProof(0);

          expect(await this.mock.$processProof(proof, hash)).to.not.equal(root);
          expect(await this.mock.$processProofCalldata(proof, hash)).to.not.equal(root);
          expect(await this.mock.$verify(proof, root, hash)).to.be.false;
          expect(await this.mock.$verifyCalldata(proof, root, hash)).to.be.false;
        });

        it('returns false for a Merkle proof of invalid length', async function () {
          const merkleTree = this.makeTree('abc');

          const root = merkleTree.root;
          const hash = merkleTree.at(0);
          const proof = merkleTree.getProof(0);
          const badProof = proof.slice(0, -1);

          expect(await this.mock.$processProof(badProof, hash)).to.not.equal(root);
          expect(await this.mock.$processProofCalldata(badProof, hash)).to.not.equal(root);
          expect(await this.mock.$verify(badProof, root, hash)).to.be.false;
          expect(await this.mock.$verifyCalldata(badProof, root, hash)).to.be.false;
        });
      });

      describe('multiProofVerify', function () {
        it('returns true for a valid Merkle multi proof', async function () {
          const merkleTree = this.makeTree('abcdef');

          const root = merkleTree.root;
          const { proof, proofFlags, leaves } = merkleTree.getMultiProof(toLeaves('bdf'));
          const hashes = leaves.map(e => merkleTree.leafHash(e));

          expect(await this.mock.$processMultiProof(proof, proofFlags, hashes)).to.equal(root);
          expect(await this.mock.$processMultiProofCalldata(proof, proofFlags, hashes)).to.equal(root);
          expect(await this.mock.$multiProofVerify(proof, proofFlags, root, hashes)).to.be.true;
          expect(await this.mock.$multiProofVerifyCalldata(proof, proofFlags, root, hashes)).to.be.true;
        });

        it('returns false for an invalid Merkle multi proof', async function () {
          const merkleTree = this.makeTree('abcdef');
          const otherMerkleTree = this.makeTree('ghi');

          const root = merkleTree.root;
          const { proof, proofFlags, leaves } = otherMerkleTree.getMultiProof(toLeaves('ghi'));
          const hashes = leaves.map(e => merkleTree.leafHash(e));

          expect(await this.mock.$processMultiProof(proof, proofFlags, hashes)).to.not.equal(root);
          expect(await this.mock.$processMultiProofCalldata(proof, proofFlags, hashes)).to.not.equal(root);
          expect(await this.mock.$multiProofVerify(proof, proofFlags, root, hashes)).to.be.false;
          expect(await this.mock.$multiProofVerifyCalldata(proof, proofFlags, root, hashes)).to.be.false;
        });

        it('revert with invalid multi proof #1', async function () {
          const merkleTree = this.makeTree('abcd');

          const root = merkleTree.root;
          const hashA = merkleTree.at(0);
          const hashB = merkleTree.at(1);
          const hashCD = nodeHash(merkleTree.at(2), merkleTree.at(3));
          const hashE = random.bytes32(); // incorrect (not part of the tree)
          const fill = random.bytes32();

          await expect(
            this.mock.$processMultiProof([hashB, fill, hashCD], [false, false, false], [hashA, hashE]),
          ).to.be.revertedWithCustomError(this.mock, 'MerkleProofInvalidMultiproof');

          await expect(
            this.mock.$processMultiProofCalldata([hashB, fill, hashCD], [false, false, false], [hashA, hashE]),
          ).to.be.revertedWithCustomError(this.mock, 'MerkleProofInvalidMultiproof');

          await expect(
            this.mock.$multiProofVerify([hashB, fill, hashCD], [false, false, false], root, [hashA, hashE]),
          ).to.be.revertedWithCustomError(this.mock, 'MerkleProofInvalidMultiproof');

          await expect(
            this.mock.$multiProofVerifyCalldata([hashB, fill, hashCD], [false, false, false], root, [hashA, hashE]),
          ).to.be.revertedWithCustomError(this.mock, 'MerkleProofInvalidMultiproof');
        });

        it('revert with invalid multi proof #2', async function () {
          const merkleTree = this.makeTree('abcd');

          const root = merkleTree.root;
          const hashA = merkleTree.at(0);
          const hashB = merkleTree.at(1);
          const hashCD = nodeHash(merkleTree.at(2), merkleTree.at(3));
          const hashE = random.bytes32(); // incorrect (not part of the tree)
          const fill = random.bytes32();

          await expect(
            this.mock.$processMultiProof([hashB, fill, hashCD], [false, false, false, false], [hashE, hashA]),
          ).to.be.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS);

          await expect(
            this.mock.$processMultiProofCalldata([hashB, fill, hashCD], [false, false, false, false], [hashE, hashA]),
          ).to.be.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS);

          await expect(
            this.mock.$multiProofVerify([hashB, fill, hashCD], [false, false, false, false], root, [hashE, hashA]),
          ).to.be.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS);

          await expect(
            this.mock.$multiProofVerifyCalldata([hashB, fill, hashCD], [false, false, false, false], root, [
              hashE,
              hashA,
            ]),
          ).to.be.revertedWithPanic(PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS);
        });

        it('limit case: works for tree containing a single leaf', async function () {
          const merkleTree = this.makeTree('a');

          const root = merkleTree.root;
          const { proof, proofFlags, leaves } = merkleTree.getMultiProof(toLeaves('a'));
          const hashes = leaves.map(e => merkleTree.leafHash(e));

          expect(await this.mock.$processMultiProof(proof, proofFlags, hashes)).to.equal(root);
          expect(await this.mock.$processMultiProofCalldata(proof, proofFlags, hashes)).to.equal(root);
          expect(await this.mock.$multiProofVerify(proof, proofFlags, root, hashes)).to.be.true;
          expect(await this.mock.$multiProofVerifyCalldata(proof, proofFlags, root, hashes)).to.be.true;
        });

        it('limit case: can prove empty leaves', async function () {
          const merkleTree = this.makeTree('abcd');

          const root = merkleTree.root;
          expect(await this.mock.$processMultiProof([root], [], [])).to.equal(root);
          expect(await this.mock.$processMultiProofCalldata([root], [], [])).to.equal(root);
          expect(await this.mock.$multiProofVerify([root], [], root, [])).to.be.true;
          expect(await this.mock.$multiProofVerifyCalldata([root], [], root, [])).to.be.true;
        });

        it('reverts processing manipulated proofs with a zero-value node at depth 1', async function () {
          // Create a merkle tree that contains a zero leaf at depth 1
          const leave = ethers.id('real leaf');
          const root = nodeHash(leave, ethers.ZeroHash);

          // Now we can pass any **malicious** fake leaves as valid!
          const maliciousLeaves = ['malicious', 'leaves']
            .map(ethers.id)
            .map(id => ethers.toBeArray(id))
            .sort(Buffer.compare);
          const maliciousProof = [leave, leave];
          const maliciousProofFlags = [true, true, false];

          await expect(
            this.mock.$processMultiProof(maliciousProof, maliciousProofFlags, maliciousLeaves),
          ).to.be.revertedWithCustomError(this.mock, 'MerkleProofInvalidMultiproof');

          await expect(
            this.mock.$processMultiProofCalldata(maliciousProof, maliciousProofFlags, maliciousLeaves),
          ).to.be.revertedWithCustomError(this.mock, 'MerkleProofInvalidMultiproof');

          await expect(
            this.mock.$multiProofVerify(maliciousProof, maliciousProofFlags, root, maliciousLeaves),
          ).to.be.revertedWithCustomError(this.mock, 'MerkleProofInvalidMultiproof');

          await expect(
            this.mock.$multiProofVerifyCalldata(maliciousProof, maliciousProofFlags, root, maliciousLeaves),
          ).to.be.revertedWithCustomError(this.mock, 'MerkleProofInvalidMultiproof');
        });
      });

      describe('validateMultiProof', function () {
        // A structurally valid multiproof that verifies against the tree it was built from must be reported as
        // valid, and its verification result must match the original `multiProofVerify` interface.
        it('returns the valid sentinel for multiproofs of a valid tree', async function () {
          const merkleTree = this.makeTree('abcdef');

          const root = merkleTree.root;
          const { proof, proofFlags, leaves } = merkleTree.getMultiProof(toLeaves('bdf'));
          const hashes = leaves.map(e => merkleTree.leafHash(e));

          expect(await this.mock.$validateMultiProof(proof, proofFlags, hashes)).to.equal(MULTIPROOF_VALID);
          expect(await this.mock.$validateMultiProofCalldata(proof, proofFlags, hashes)).to.equal(MULTIPROOF_VALID);

          // The pre-check does not replace hash verification: for a valid structure, verify still agrees.
          expect(await this.mock.$multiProofVerify(proof, proofFlags, root, hashes)).to.be.true;
          expect(await this.mock.$multiProofVerifyCalldata(proof, proofFlags, root, hashes)).to.be.true;
        });

        it('returns the valid sentinel but verify returns false for a structurally valid multiproof of another tree', async function () {
          const merkleTree = this.makeTree('abcdef');
          const otherMerkleTree = this.makeTree('ghi');

          const root = merkleTree.root;
          const { proof, proofFlags, leaves } = otherMerkleTree.getMultiProof(toLeaves('ghi'));
          const hashes = leaves.map(e => merkleTree.leafHash(e));

          // Structure is fine, so pre-check passes...
          expect(await this.mock.$validateMultiProof(proof, proofFlags, hashes)).to.equal(MULTIPROOF_VALID);
          expect(await this.mock.$validateMultiProofCalldata(proof, proofFlags, hashes)).to.equal(MULTIPROOF_VALID);

          // ...but the rebuilt root differs, so the original interface returns false. Pre-checks are not hash checks.
          expect(await this.mock.$multiProofVerify(proof, proofFlags, root, hashes)).to.be.false;
          expect(await this.mock.$multiProofVerifyCalldata(proof, proofFlags, root, hashes)).to.be.false;
        });

        it('locates the first invalid flag when a proof node is missing', async function () {
          const merkleTree = this.makeTree('abcd');

          const root = merkleTree.root;
          const hashA = merkleTree.at(0);
          const hashB = merkleTree.at(1);
          const hashE = random.bytes32(); // incorrect (not part of the tree)
          const fill = random.bytes32();

          // Flags 0 and 1 consume the two available proof nodes (`hashB` and `fill`). Flag 2 needs a third one,
          // but the proof is one node short. The counts still balance (`2 + 2 == 3 + 1`), so this is a positional
          // failure, not a global one: the first structurally invalid `proofFlags` entry is the one at index 2.
          const proof = [hashB, fill];
          const proofFlags = [false, false, false];
          const hashes = [hashA, hashE];

          expect(await this.mock.$validateMultiProof(proof, proofFlags, hashes)).to.equal(2);
          expect(await this.mock.$validateMultiProofCalldata(proof, proofFlags, hashes)).to.equal(2);

          // Without the pre-check, the original interface reads past the end of the proof and panics, with no
          // information about where the structure broke.
          await expect(this.mock.$multiProofVerify(proof, proofFlags, root, hashes)).to.be.revertedWithPanic(
            PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS,
          );
          await expect(this.mock.$multiProofVerifyCalldata(proof, proofFlags, root, hashes)).to.be.revertedWithPanic(
            PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS,
          );
        });

        it('locates the first invalid flag when an extra flag forces an unavailable second input', async function () {
          const merkleTree = this.makeTree('abcd');

          const root = merkleTree.root;
          const hashA = merkleTree.at(0);
          const hashB = merkleTree.at(1);
          const hashCD = nodeHash(merkleTree.at(2), merkleTree.at(3));
          const hashE = random.bytes32(); // incorrect (not part of the tree)
          const fill = random.bytes32();

          const proof = [hashB, fill, hashCD];
          // Extra flag at the end. The counts balance (`2 + 3 == 4 + 1`), but step 3 has no second value available
          // from the main queue and no proof node left, so flag index 3 is the first structurally invalid one.
          const proofFlags = [false, false, false, false];
          const hashes = [hashE, hashA];

          expect(await this.mock.$validateMultiProof(proof, proofFlags, hashes)).to.equal(3);
          expect(await this.mock.$validateMultiProofCalldata(proof, proofFlags, hashes)).to.equal(3);

          // The original interface reads past the end of the proof and panics.
          await expect(this.mock.$multiProofVerify(proof, proofFlags, root, hashes)).to.be.revertedWithPanic(
            PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS,
          );
          await expect(this.mock.$multiProofVerifyCalldata(proof, proofFlags, root, hashes)).to.be.revertedWithPanic(
            PANIC_CODES.ARRAY_ACCESS_OUT_OF_BOUNDS,
          );
        });

        it('reports a global issue when the counts of leaves, proof and flags do not add up', async function () {
          const merkleTree = this.makeTree('abcd');

          const root = merkleTree.root;
          const fill = random.bytes32();

          // `0 + 2 != 0 + 1`: there is no flag to point at, so a global inconsistency is reported as
          // `proofFlags.length` (i.e. 0).
          expect(await this.mock.$validateMultiProof([root, fill], [], [])).to.equal(0);
          expect(await this.mock.$validateMultiProofCalldata([root, fill], [], [])).to.equal(0);

          await expect(this.mock.$multiProofVerify([root, fill], [], root, [])).to.be.revertedWithCustomError(
            this.mock,
            'MerkleProofInvalidMultiproof',
          );
        });

        it('locates the first impossible merge in the manipulated zero-value tree fixture', async function () {
          const leave = ethers.id('real leaf');
          const root = nodeHash(leave, ethers.ZeroHash);

          const maliciousLeaves = ['malicious', 'leaves']
            .map(ethers.id)
            .map(id => ethers.toBeArray(id))
            .sort(Buffer.compare);
          const maliciousProof = [leave, leave];
          const maliciousProofFlags = [true, true, false];

          // Flag 0 merges the two malicious leaves. Flag 1 is also set, but no second value is available in the
          // main queue at that point: flag index 1 is the first structurally invalid entry.
          expect(await this.mock.$validateMultiProof(maliciousProof, maliciousProofFlags, maliciousLeaves)).to.equal(1);
          expect(
            await this.mock.$validateMultiProofCalldata(maliciousProof, maliciousProofFlags, maliciousLeaves),
          ).to.equal(1);

          // The original interface silently consumes uninitialized (zero) nodes and only notices the inconsistency
          // at the end of the reconstruction, when a proof node remains unconsumed.
          await expect(
            this.mock.$multiProofVerify(maliciousProof, maliciousProofFlags, root, maliciousLeaves),
          ).to.be.revertedWithCustomError(this.mock, 'MerkleProofInvalidMultiproof');
          await expect(
            this.mock.$multiProofVerifyCalldata(maliciousProof, maliciousProofFlags, root, maliciousLeaves),
          ).to.be.revertedWithCustomError(this.mock, 'MerkleProofInvalidMultiproof');
        });

        it('limit case: accepts proving empty leaves from a single proof node', async function () {
          const merkleTree = this.makeTree('abcd');

          const root = merkleTree.root;
          expect(await this.mock.$validateMultiProof([root], [], [])).to.equal(MULTIPROOF_VALID);
          expect(await this.mock.$validateMultiProofCalldata([root], [], [])).to.equal(MULTIPROOF_VALID);
          expect(await this.mock.$multiProofVerify([root], [], root, [])).to.be.true;
        });

        it('limit case: accepts a tree containing a single leaf', async function () {
          const merkleTree = this.makeTree('a');

          const root = merkleTree.root;
          const { proof, proofFlags, leaves } = merkleTree.getMultiProof(toLeaves('a'));
          const hashes = leaves.map(e => merkleTree.leafHash(e));

          expect(await this.mock.$validateMultiProof(proof, proofFlags, hashes)).to.equal(MULTIPROOF_VALID);
          expect(await this.mock.$validateMultiProofCalldata(proof, proofFlags, hashes)).to.equal(MULTIPROOF_VALID);
          expect(await this.mock.$multiProofVerify(proof, proofFlags, root, hashes)).to.be.true;
        });
      });
    });
  }
});
