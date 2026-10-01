import { network } from 'hardhat';
import { expect } from 'chai';
import { shouldBehaveLikeVotes } from '../../../governance/utils/Votes.behavior';

const connection = await network.create();
const {
  ethers,
  helpers: { time },
  networkHelpers: { loadFixture, mine },
} = connection;

const TOKENS = [
  { Token: '$ERC721Votes', mode: 'blockNumber' },
  // no timestamp mode for ERC721Votes yet
];

const name = 'My Vote';
const symbol = 'MTKN';
const version = '1';
const tokens = [ethers.parseEther('10000000'), 10n, 20n, 30n];

describe('ERC721Votes', function () {
  for (const { Token, mode } of TOKENS) {
    const fixture = async () => {
      // accounts is required by shouldBehaveLikeVotes
      const accounts = await ethers.getSigners();
      const [holder, recipient, other1, other2] = accounts;

      const token = await ethers.deployContract(Token, [name, symbol, name, version]);

      return { accounts, holder, recipient, other1, other2, token };
    };

    describe(`vote with ${mode}`, function () {
      beforeEach(async function () {
        Object.assign(this, connection, await loadFixture(fixture));
        this.votes = this.token;
      });

      // includes ERC6372 behavior check
      shouldBehaveLikeVotes(tokens, { mode, fungible: false });

      describe('balanceOf', function () {
        beforeEach(async function () {
          await this.votes.$_mint(this.holder, tokens[0]);
          await this.votes.$_mint(this.holder, tokens[1]);
          await this.votes.$_mint(this.holder, tokens[2]);
          await this.votes.$_mint(this.holder, tokens[3]);
        });

        it('grants to initial account', async function () {
          expect(await this.votes.balanceOf(this.holder)).to.equal(4n);
        });
      });

      describe('transfers', function () {
        beforeEach(async function () {
          await this.votes.$_mint(this.holder, tokens[0]);
        });

        it('no delegation', async function () {
          await expect(this.votes.connect(this.holder).transferFrom(this.holder, this.recipient, tokens[0]))
            .to.emit(this.token, 'Transfer')
            .withArgs(this.holder, this.recipient, tokens[0])
            .to.not.emit(this.token, 'DelegateVotesChanged');

          this.holderVotes = 0n;
          this.recipientVotes = 0n;
        });

        it('sender delegation', async function () {
          await this.votes.connect(this.holder).delegate(this.holder);

          const tx = await this.votes.connect(this.holder).transferFrom(this.holder, this.recipient, tokens[0]);
          await expect(tx)
            .to.emit(this.token, 'Transfer')
            .withArgs(this.holder, this.recipient, tokens[0])
            .to.emit(this.token, 'DelegateVotesChanged')
            .withArgs(this.holder, 1n, 0n);

          const { logs } = await tx.wait();
          const { index } = logs.find(event => event.fragment.name == 'DelegateVotesChanged');
          for (const event of logs.filter(event => event.fragment.name == 'Transfer')) {
            expect(event.index).to.lt(index);
          }

          this.holderVotes = 0n;
          this.recipientVotes = 0n;
        });

        it('receiver delegation', async function () {
          await this.votes.connect(this.recipient).delegate(this.recipient);

          const tx = await this.votes.connect(this.holder).transferFrom(this.holder, this.recipient, tokens[0]);
          await expect(tx)
            .to.emit(this.token, 'Transfer')
            .withArgs(this.holder, this.recipient, tokens[0])
            .to.emit(this.token, 'DelegateVotesChanged')
            .withArgs(this.recipient, 0n, 1n);

          const { logs } = await tx.wait();
          const { index } = logs.find(event => event.fragment.name == 'DelegateVotesChanged');
          for (const event of logs.filter(event => event.fragment.name == 'Transfer')) {
            expect(event.index).to.lt(index);
          }

          this.holderVotes = 0n;
          this.recipientVotes = 1n;
        });

        it('full delegation', async function () {
          await this.votes.connect(this.holder).delegate(this.holder);
          await this.votes.connect(this.recipient).delegate(this.recipient);

          const tx = await this.votes.connect(this.holder).transferFrom(this.holder, this.recipient, tokens[0]);
          await expect(tx)
            .to.emit(this.token, 'Transfer')
            .withArgs(this.holder, this.recipient, tokens[0])
            .to.emit(this.token, 'DelegateVotesChanged')
            .withArgs(this.holder, 1n, 0n)
            .to.emit(this.token, 'DelegateVotesChanged')
            .withArgs(this.recipient, 0n, 1n);

          const { logs } = await tx.wait();
          const { index } = logs.find(event => event.fragment.name == 'DelegateVotesChanged');
          for (const event of logs.filter(event => event.fragment.name == 'Transfer')) {
            expect(event.index).to.lt(index);
          }

          this.holderVotes = 0;
          this.recipientVotes = 1n;
        });

        it('returns the same total supply on transfers', async function () {
          await this.votes.connect(this.holder).delegate(this.holder);

          const tx = await this.votes.connect(this.holder).transferFrom(this.holder, this.recipient, tokens[0]);
          const timepoint = await time.clockFromReceipt[mode](tx);

          await mine(2);

          expect(await this.votes.getPastTotalSupply(timepoint - 1n)).to.equal(1n);
          expect(await this.votes.getPastTotalSupply(timepoint + 1n)).to.equal(1n);

          this.holderVotes = 0n;
          this.recipientVotes = 0n;
        });

        it('generally returns the voting balance at the appropriate checkpoint', async function () {
          await this.votes.$_mint(this.holder, tokens[1]);
          await this.votes.$_mint(this.holder, tokens[2]);
          await this.votes.$_mint(this.holder, tokens[3]);

          const total = await this.votes.balanceOf(this.holder);

          const t1 = await this.votes.connect(this.holder).delegate(this.other1);
          await mine(2);
          const t2 = await this.votes.connect(this.holder).transferFrom(this.holder, this.other2, tokens[0]);
          await mine(2);
          const t3 = await this.votes.connect(this.holder).transferFrom(this.holder, this.other2, tokens[2]);
          await mine(2);
          const t4 = await this.votes.connect(this.other2).transferFrom(this.other2, this.holder, tokens[2]);
          await mine(2);

          t1.timepoint = await time.clockFromReceipt[mode](t1);
          t2.timepoint = await time.clockFromReceipt[mode](t2);
          t3.timepoint = await time.clockFromReceipt[mode](t3);
          t4.timepoint = await time.clockFromReceipt[mode](t4);

          expect(await this.votes.getPastVotes(this.other1, t1.timepoint - 1n)).to.equal(0n);
          expect(await this.votes.getPastVotes(this.other1, t1.timepoint)).to.equal(total);
          expect(await this.votes.getPastVotes(this.other1, t1.timepoint + 1n)).to.equal(total);
          expect(await this.votes.getPastVotes(this.other1, t2.timepoint)).to.equal(3n);
          expect(await this.votes.getPastVotes(this.other1, t2.timepoint + 1n)).to.equal(3n);
          expect(await this.votes.getPastVotes(this.other1, t3.timepoint)).to.equal(2n);
          expect(await this.votes.getPastVotes(this.other1, t3.timepoint + 1n)).to.equal(2n);
          expect(await this.votes.getPastVotes(this.other1, t4.timepoint)).to.equal('3');
          expect(await this.votes.getPastVotes(this.other1, t4.timepoint + 1n)).to.equal(3n);

          this.holderVotes = 0n;
          this.recipientVotes = 0n;
        });

        afterEach(async function () {
          expect(await this.votes.getVotes(this.holder)).to.equal(this.holderVotes);
          expect(await this.votes.getVotes(this.recipient)).to.equal(this.recipientVotes);

          // need to advance 2 blocks to see the effect of a transfer on "getPastVotes"
          const timepoint = await time.clock[mode]();
          await mine();
          expect(await this.votes.getPastVotes(this.holder, timepoint)).to.equal(this.holderVotes);
          expect(await this.votes.getPastVotes(this.recipient, timepoint)).to.equal(this.recipientVotes);
        });
      });

      describe('getPastVotesDifference', function () {
        it('reports the delegate vote difference between two snapshots across mint, delegate and transfer', async function () {
          // t0: 2 NFTs are minted to the holder before anyone has delegated. Votes are not tracked yet.
          await this.votes.$_mint(this.holder, tokens[1]);
          const t0mint1 = await this.votes.$_mint(this.holder, tokens[2]);
          await mine();
          const t0 = await time.clockFromReceipt[mode](t0mint1);

          // t1: the holder delegates to itself, so the 2 mints are retroactively reflected as 2 votes.
          const t1delegate = await this.votes.connect(this.holder).delegate(this.holder);
          await mine();
          const t1 = await time.clockFromReceipt[mode](t1delegate);

          // recipient also delegates to itself, but it does not own any NFT yet
          await this.votes.connect(this.recipient).delegate(this.recipient);

          // t2: a third NFT is minted to the holder (votes 2 -> 3)
          const t2mint = await this.votes.$_mint(this.holder, tokens[3]);
          await mine();
          const t2 = await time.clockFromReceipt[mode](t2mint);

          // t3: one NFT is transferred from the holder to the recipient (holder 3 -> 2, recipient 0 -> 1)
          const t3transfer = await this.votes.connect(this.holder).transferFrom(this.holder, this.recipient, tokens[1]);
          await mine(2);
          const t3 = await time.clockFromReceipt[mode](t3transfer);

          // mint + delegation: holder goes from 0 to 3 votes between t0 and t2
          expect(await this.votes.getPastVotesDifference(this.holder, t0, t2)).to.equal(3n);
          // delegation alone: the holder gains 2 votes between t0 and t1
          expect(await this.votes.getPastVotesDifference(this.holder, t0, t1)).to.equal(2n);
          // transfer: holder loses 1 vote between t2 and t3; recipient gains 1
          expect(await this.votes.getPastVotesDifference(this.holder, t2, t3)).to.equal(-1n);
          expect(await this.votes.getPastVotesDifference(this.recipient, t2, t3)).to.equal(1n);
          // full interval: holder +2, recipient +1
          expect(await this.votes.getPastVotesDifference(this.holder, t0, t3)).to.equal(2n);
          expect(await this.votes.getPastVotesDifference(this.recipient, t0, t3)).to.equal(1n);

          // an account that never delegated nor held NFTs always has a zero difference
          expect(await this.votes.getPastVotesDifference(this.other1, t0, t3)).to.equal(0n);

          // zero-length interval
          expect(await this.votes.getPastVotesDifference(this.holder, t3, t3)).to.equal(0n);

          // swapped timepoints return the negated difference
          expect(await this.votes.getPastVotesDifference(this.holder, t3, t0)).to.equal(-2n);
          expect(await this.votes.getPastVotesDifference(this.recipient, t3, t2)).to.equal(-1n);

          // the difference is consistent with the underlying historical snapshots, and old snapshots
          // keep their original value after later transfers
          expect(await this.votes.getPastVotes(this.holder, t0)).to.equal(0n);
          expect(await this.votes.getPastVotes(this.holder, t3)).to.equal(2n);
          expect(await this.votes.getPastVotes(this.recipient, t3)).to.equal(1n);
        });

        it('keeps old snapshots unchanged when votes are transferred or redelegated after them', async function () {
          const mint = await this.votes.$_mint(this.holder, tokens[1]);
          const tMint = await time.clockFromReceipt[mode](mint);

          const delegateHolder = await this.votes.connect(this.holder).delegate(this.holder);
          const tDelegate = await time.clockFromReceipt[mode](delegateHolder);
          await this.votes.connect(this.recipient).delegate(this.recipient);
          await mine(2);

          // snapshot at the mint block predates the delegation, so it keeps reporting 0 votes
          expect(await this.votes.getPastVotes(this.holder, tMint)).to.equal(0n);
          expect(await this.votes.getPastVotes(this.holder, tDelegate)).to.equal(1n);

          const transfer = await this.votes.connect(this.holder).transferFrom(this.holder, this.recipient, tokens[1]);
          const tTransfer = await time.clockFromReceipt[mode](transfer);

          // the recipient later redelegates its single NFT, which must not rewrite older snapshots
          await this.votes.connect(this.recipient).delegate(this.other2);
          await mine(2);

          // transfer impact between the two snapshots: holder -1, recipient +1
          expect(await this.votes.getPastVotesDifference(this.holder, tDelegate, tTransfer)).to.equal(-1n);
          expect(await this.votes.getPastVotesDifference(this.recipient, tDelegate, tTransfer)).to.equal(1n);

          // later transfer and redelegation do not mutate any earlier snapshot
          expect(await this.votes.getPastVotes(this.holder, tMint)).to.equal(0n);
          expect(await this.votes.getPastVotes(this.holder, tDelegate)).to.equal(1n);
          expect(await this.votes.getPastVotes(this.holder, tTransfer)).to.equal(0n);
          expect(await this.votes.getPastVotes(this.recipient, tDelegate)).to.equal(0n);
          expect(await this.votes.getPastVotes(this.recipient, tTransfer)).to.equal(1n);
          expect(await this.votes.getPastVotesDifference(this.holder, tDelegate, tTransfer)).to.equal(-1n);
          expect(await this.votes.getPastVotesDifference(this.recipient, tDelegate, tTransfer)).to.equal(1n);
        });

        it('reverts if either timepoint is the current block or in the future', async function () {
          await this.votes.$_mint(this.holder, tokens[1]);
          await mine(2);

          const pastTimepoint = await this.votes.clock();
          await mine();

          // newTimepoint in the future
          await expect(this.votes.getPastVotesDifference(this.holder, pastTimepoint, pastTimepoint + 1n))
            .to.be.revertedWithCustomError(this.votes, 'ERC5805FutureLookup')
            .withArgs(pastTimepoint + 1n, pastTimepoint + 1n);

          // oldTimepoint in the future
          await expect(this.votes.getPastVotesDifference(this.holder, pastTimepoint + 1n, pastTimepoint))
            .to.be.revertedWithCustomError(this.votes, 'ERC5805FutureLookup')
            .withArgs(pastTimepoint + 1n, pastTimepoint + 1n);

          // current block cannot be queried
          const currentTimepoint = await this.votes.clock();
          await expect(this.votes.getPastVotesDifference(this.holder, currentTimepoint, currentTimepoint))
            .to.be.revertedWithCustomError(this.votes, 'ERC5805FutureLookup')
            .withArgs(currentTimepoint, currentTimepoint);
        });
      });
    });
  }
});
