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

      describe('vote difference', function () {
        beforeEach(async function () {
          // mint 3 tokens to holder
          await this.votes.$_mint(this.holder, tokens[1]);
          await this.votes.$_mint(this.holder, tokens[2]);
          await this.votes.$_mint(this.holder, tokens[3]);
        });

        it('returns the vote difference between two past timepoints after transfer', async function () {
          // holder delegates to other1
          const delegateTx = await this.votes.connect(this.holder).delegate(this.other1);
          const t1 = await time.clockFromReceipt[mode](delegateTx);

          // advance blocks
          await mine(2);

          // holder transfers 1 token to other2
          const transferTx = await this.votes.connect(this.holder).transferFrom(this.holder, this.other2, tokens[1]);
          const t2 = await time.clockFromReceipt[mode](transferTx);

          // advance blocks so that t1 and t2 are in the past
          await mine(2);

          // old snapshot keeps its original value (3 votes)
          expect(await this.votes.getPastVotes(this.other1, t1)).to.equal(3n);
          // new snapshot reflects the transfer (2 votes)
          expect(await this.votes.getPastVotes(this.other1, t2)).to.equal(2n);

          // difference: new - old = 2 - 3 = -1
          expect(await this.votes.getPastVotesDifference(this.other1, t1, t2)).to.equal(-1n);
          // reverse direction: old - new = 3 - 2 = 1
          expect(await this.votes.getPastVotesDifference(this.other1, t2, t1)).to.equal(1n);
        });

        it('returns the vote difference between two past timepoints after delegation change', async function () {
          // holder delegates to other1
          const delegateTx1 = await this.votes.connect(this.holder).delegate(this.other1);
          const t1 = await time.clockFromReceipt[mode](delegateTx1);

          // advance blocks
          await mine(2);

          // holder changes delegation to other2
          const delegateTx2 = await this.votes.connect(this.holder).delegate(this.other2);
          const t2 = await time.clockFromReceipt[mode](delegateTx2);

          // advance blocks so that t1 and t2 are in the past
          await mine(2);

          // old snapshot keeps its original value (other1 had 3 votes)
          expect(await this.votes.getPastVotes(this.other1, t1)).to.equal(3n);
          // new snapshot: other1 no longer has votes
          expect(await this.votes.getPastVotes(this.other1, t2)).to.equal(0n);
          // new snapshot: other2 now has 3 votes
          expect(await this.votes.getPastVotes(this.other2, t2)).to.equal(3n);

          // difference for other1: 0 - 3 = -3
          expect(await this.votes.getPastVotesDifference(this.other1, t1, t2)).to.equal(-3n);
          // difference for other2: 3 - 0 = 3
          expect(await this.votes.getPastVotesDifference(this.other2, t1, t2)).to.equal(3n);
        });

        it('returns the vote difference between two past timepoints after mint', async function () {
          // holder delegates to other1
          const delegateTx = await this.votes.connect(this.holder).delegate(this.other1);
          const t1 = await time.clockFromReceipt[mode](delegateTx);

          // advance blocks
          await mine(2);

          // mint 1 more token to holder (delegatee gets more votes)
          const mintTx = await this.votes.$_mint(this.holder, 40n);
          const t2 = await time.clockFromReceipt[mode](mintTx);

          // advance blocks so that t1 and t2 are in the past
          await mine(2);

          // old snapshot keeps its original value (3 votes)
          expect(await this.votes.getPastVotes(this.other1, t1)).to.equal(3n);
          // new snapshot reflects the mint (4 votes)
          expect(await this.votes.getPastVotes(this.other1, t2)).to.equal(4n);

          // difference: 4 - 3 = 1
          expect(await this.votes.getPastVotesDifference(this.other1, t1, t2)).to.equal(1n);
        });

        it('reverts when querying future timepoints', async function () {
          // holder delegates to other1
          const delegateTx = await this.votes.connect(this.holder).delegate(this.other1);
          const t1 = await time.clockFromReceipt[mode](delegateTx);

          // advance blocks so that t1 is in the past
          await mine(2);

          const clock = await time.clock[mode]();
          const futureTimepoint = clock + 100n;

          // future lookup reverts
          await expect(this.votes.getPastVotesDifference(this.other1, t1, futureTimepoint))
            .to.be.revertedWithCustomError(this.votes, 'ERC5805FutureLookup')
            .withArgs(futureTimepoint, clock);

          await expect(this.votes.getPastVotesDifference(this.other1, futureTimepoint, t1))
            .to.be.revertedWithCustomError(this.votes, 'ERC5805FutureLookup')
            .withArgs(futureTimepoint, clock);
        });

        it('returns zero when both timepoints are equal', async function () {
          // holder delegates to other1
          const delegateTx = await this.votes.connect(this.holder).delegate(this.other1);
          const t1 = await time.clockFromReceipt[mode](delegateTx);

          // advance blocks so that t1 is in the past
          await mine(2);

          // difference with same timepoint is zero
          expect(await this.votes.getPastVotesDifference(this.other1, t1, t1)).to.equal(0n);
        });
      });
    });
  }
});
