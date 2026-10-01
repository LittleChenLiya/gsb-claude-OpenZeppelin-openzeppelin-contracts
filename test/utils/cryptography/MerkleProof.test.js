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

      describe('multiProofStructuralCheck', function () {
        // Sentinel returned by the precheck when the multiproof structure is valid.
        const VALID = ethers.MaxUint256;

        it('returns max uint256 for a valid Merkle multi proof', async function () {
          const merkleTree = this.makeTree('abcdef');

          const root = merkleTree.root;
          const { proof, proofFlags, leaves } = merkleTree.getMultiProof(toLeaves('bdf'));
          const hashes = leaves.map(e => merkleTree.leafHash(e));

          // The precheck reports a valid structure for both memory and calldata.
          expect(await this.mock.$multiProofStructuralCheck(proof, proofFlags, hashes)).to.equal(VALID);
          expect(await this.mock.$multiProofStructuralCheckCalldata(proof, proofFlags, hashes)).to.equal(VALID);
          // The precheck does not replace hash verification: the original interface still accepts the proof.
          expect(await this.mock.$multiProofVerify(proof, proofFlags, root, hashes)).to.be.true;
          expect(await this.mock.$multiProofVerifyCalldata(proof, proofFlags, root, hashes)).to.be.true;
        });

        it('locates the missing proof node when a proof node is removed', async function () {
          const merkleTree = this.makeTree('abcdef');

          const root = merkleTree.root;
          const { proof, proofFlags, leaves } = merkleTree.getMultiProof(toLeaves('bdf'));
          const hashes = leaves.map(e => merkleTree.leafHash(e));

          // Remove the last proof node: the proof array is one node short.
          const shortProof = proof.slice(0, -1);

          // The precheck locates the first missing proof index (== shortProof.length).
          expect(await this.mock.$multiProofStructuralCheck(shortProof, proofFlags, hashes)).to.equal(
            shortProof.length,
          );
          expect(await this.mock.$multiProofStructuralCheckCalldata(shortProof, proofFlags, hashes)).to.equal(
            shortProof.length,
          );
          // The original verification interface rejects the malformed proof.
          await expect(this.mock.$processMultiProof(shortProof, proofFlags, hashes)).to.be.revertedWithCustomError(
            this.mock,
            'MerkleProofInvalidMultiproof',
          );
          await expect(this.mock.$multiProofVerify(shortProof, proofFlags, root, hashes)).to.be.revertedWithCustomError(
            this.mock,
            'MerkleProofInvalidMultiproof',
          );
        });

        it('locates the first failing flag step when an extra flag is appended', async function () {
          const merkleTree = this.makeTree('abcdef');

          const root = merkleTree.root;
          const { proof, proofFlags, leaves } = merkleTree.getMultiProof(toLeaves('bdf'));
          const hashes = leaves.map(e => merkleTree.leafHash(e));

          // Append an extra `true` flag: the flag sequence consumes more values than the leaves and
          // produced hashes can provide, so the main queue underflows at the last step.
          const extraFlags = [...proofFlags, true];

          // The precheck locates the first flag step that cannot be executed.
          expect(await this.mock.$multiProofStructuralCheck(proof, extraFlags, hashes)).to.equal(proofFlags.length);
          expect(await this.mock.$multiProofStructuralCheckCalldata(proof, extraFlags, hashes)).to.equal(
            proofFlags.length,
          );
          // The original verification interface rejects the malformed proof.
          await expect(this.mock.$processMultiProof(proof, extraFlags, hashes)).to.be.revertedWithCustomError(
            this.mock,
            'MerkleProofInvalidMultiproof',
          );
          await expect(this.mock.$multiProofVerify(proof, extraFlags, root, hashes)).to.be.revertedWithCustomError(
            this.mock,
            'MerkleProofInvalidMultiproof',
          );
        });

        it('locates the first extra proof node when proof is too long', async function () {
          const merkleTree = this.makeTree('abcdef');

          const { proof, proofFlags, leaves } = merkleTree.getMultiProof(toLeaves('bdf'));
          const hashes = leaves.map(e => merkleTree.leafHash(e));

          // Append an extra proof node that is never consumed by any flag.
          const extraProof = [...proof, random.bytes32()];

          // The precheck locates the first extra proof node (at index proof.length).
          expect(await this.mock.$multiProofStructuralCheck(extraProof, proofFlags, hashes)).to.equal(proof.length);
          expect(await this.mock.$multiProofStructuralCheckCalldata(extraProof, proofFlags, hashes)).to.equal(
            proof.length,
          );
          // The original verification interface rejects the malformed proof.
          await expect(this.mock.$processMultiProof(extraProof, proofFlags, hashes)).to.be.revertedWithCustomError(
            this.mock,
            'MerkleProofInvalidMultiproof',
          );
        });

        it('returns max uint256 for the no-op multiproofs', async function () {
          const single = this.makeTree('a');
          const singleRoot = single.root;
          const {
            proof: singleProof,
            proofFlags: singleFlags,
            leaves: singleLeaves,
          } = single.getMultiProof(toLeaves('a'));
          const singleHashes = singleLeaves.map(e => single.leafHash(e));

          expect(await this.mock.$multiProofStructuralCheck(singleProof, singleFlags, singleHashes)).to.equal(VALID);
          expect(await this.mock.$multiProofStructuralCheckCalldata(singleProof, singleFlags, singleHashes)).to.equal(
            VALID,
          );

          // Empty leaves: proof[0] is the root.
          expect(await this.mock.$multiProofStructuralCheck([singleRoot], [], [])).to.equal(VALID);
          expect(await this.mock.$multiProofStructuralCheckCalldata([singleRoot], [], [])).to.equal(VALID);
        });

        it('agrees with processMultiProof on random valid and mutated multiproofs', async function () {
          this.timeout(120000);
          for (let t = 0; t < 20; t++) {
            const n = 2 + Math.floor(Math.random() * 10);
            const letters = 'abcdefghijklmnopqrstuvwxyz';
            const merkleTree = this.makeTree(letters.slice(0, n));
            const numProven = 1 + Math.floor(Math.random() * n);
            const proven = letters.slice(0, numProven);
            const { proof, proofFlags, leaves } = merkleTree.getMultiProof(toLeaves(proven));
            const hashes = leaves.map(e => merkleTree.leafHash(e));

            // A valid multiproof passes the precheck and rebuilds the root.
            expect(await this.mock.$multiProofStructuralCheck(proof, proofFlags, hashes)).to.equal(VALID);
            expect(await this.mock.$processMultiProof(proof, proofFlags, hashes)).to.equal(merkleTree.root);

            // Mutated multiproofs: the precheck must locate the failure and processMultiProof must revert.
            for (let m = 0; m < 10; m++) {
              const mutProof = [...proof];
              const mutFlags = [...proofFlags];
              const mutLeaves = [...hashes];
              const mutation = Math.floor(Math.random() * 4);
              if (mutation === 0 && mutProof.length > 0) {
                mutProof.splice(Math.floor(Math.random() * mutProof.length), 1);
              } else if (mutation === 1) {
                mutProof.push(random.bytes32());
              } else if (mutation === 2 && mutFlags.length > 0) {
                mutFlags.splice(Math.floor(Math.random() * mutFlags.length), 1);
              } else {
                mutFlags.push(Math.random() < 0.5);
              }
              const precheck = await this.mock.$multiProofStructuralCheck(mutProof, mutFlags, mutLeaves);
              let reverted = false;
              try {
                await this.mock.$processMultiProof(mutProof, mutFlags, mutLeaves);
              } catch {
                reverted = true;
              }
              if (reverted) {
                expect(precheck).to.not.equal(VALID);
              } else {
                expect(precheck).to.equal(VALID);
              }
            }
          }
        });
      });
    });
  }
});
