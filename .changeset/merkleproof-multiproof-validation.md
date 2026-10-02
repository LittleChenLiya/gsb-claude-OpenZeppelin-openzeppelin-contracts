---
'openzeppelin-solidity': minor
---

`MerkleProof`: Add `validateMultiProof` and `validateMultiProofCalldata` that check the structure of a multiproof and return the index of the first invalid `proofFlags` entry (`MULTIPROOF_VALID` when valid). This is a structure-only pre-check and does not replace the root hash verification performed by `multiProofVerify`.
