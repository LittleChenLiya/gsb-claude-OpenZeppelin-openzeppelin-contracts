import { network } from 'hardhat';
import { expect } from 'chai';
import { selector } from '../../helpers/methods';

const connection = await network.create();
const {
  ethers,
  helpers: { impersonate, time },
  networkHelpers: { loadFixture },
} = connection;

const ROLE_IMMEDIATE = 100n;
const ROLE_DELAYED = 200n;
const EXECUTION_DELAY = time.duration.hours(1);

async function fixture() {
  const [admin, caller, stranger] = await ethers.getSigners();

  const manager = await ethers.deployContract('$AccessManagerMock', [admin]);
  const target1 = await ethers.deployContract('$AccessManagedTarget', [manager]);
  const target2 = await ethers.deployContract('$AccessManagedTarget', [manager]);
  const target3 = await ethers.deployContract('$AccessManagedTarget', [manager]);

  const fnSelector = selector('fnRestricted()');

  // Two roles: one immediate (no delay), one delayed (1 hour execution delay).
  await manager.$_grantRole(ROLE_IMMEDIATE, caller, 0, 0);
  await manager.$_grantRole(ROLE_DELAYED, caller, 0, EXECUTION_DELAY);

  // Three target calls:
  // - target1 requires ROLE_IMMEDIATE held by `caller`  -> immediate
  // - target2 requires ROLE_DELAYED held by `caller`    -> delayed
  // - target3 requires ROLE_IMMEDIATE, `stranger` lacks -> denied
  await manager.$_setTargetFunctionRole(target1, fnSelector, ROLE_IMMEDIATE);
  await manager.$_setTargetFunctionRole(target2, fnSelector, ROLE_DELAYED);
  await manager.$_setTargetFunctionRole(target3, fnSelector, ROLE_IMMEDIATE);

  return { admin, caller, stranger, manager, target1, target2, target3, fnSelector };
}

describe('AccessManager#canCallBatch', function () {
  beforeEach(async function () {
    Object.assign(this, await loadFixture(fixture));
  });

  it('returns the executable time per item: immediate, delayed and denied', async function () {
    const { caller, stranger, manager, target1, target2, target3, fnSelector } = this;

    const now = await time.clock.timestamp();

    const results = await manager.canCallBatch(
      [caller, caller, stranger],
      [target1, target2, target3],
      [fnSelector, fnSelector, fnSelector],
    );

    expect(results).to.have.lengthOf(3);

    // Immediate: authorized, no delay, executable right now.
    expect(results[0].allowed).to.be.true;
    expect(results[0].immediate).to.be.true;
    expect(results[0].delay).to.equal(0n);
    expect(results[0].executableAt).to.equal(now);

    // Delayed: authorized, must wait the execution delay.
    expect(results[1].allowed).to.be.true;
    expect(results[1].immediate).to.be.false;
    expect(results[1].delay).to.equal(EXECUTION_DELAY);
    expect(results[1].executableAt).to.equal(now + EXECUTION_DELAY);

    // Denied: no permission, never executable.
    expect(results[2].allowed).to.be.false;
    expect(results[2].immediate).to.be.false;
    expect(results[2].delay).to.equal(0n);
    expect(results[2].executableAt).to.equal(0n);
  });

  it('does not let one denied item affect the other previews', async function () {
    const { caller, stranger, manager, target1, target2, target3, fnSelector } = this;

    const results = await manager.canCallBatch(
      [stranger, caller, stranger, caller, stranger],
      [target3, target1, target2, target2, target1],
      [fnSelector, fnSelector, fnSelector, fnSelector, fnSelector],
    );

    expect(results).to.have.lengthOf(5);

    // stranger -> target3 (ROLE_IMMEDIATE) : denied
    expect(results[0].allowed).to.be.false;
    expect(results[0].executableAt).to.equal(0n);
    // caller   -> target1 (ROLE_IMMEDIATE) : immediate
    expect(results[1].allowed).to.be.true;
    expect(results[1].immediate).to.be.true;
    // stranger -> target2 (ROLE_DELAYED)   : denied
    expect(results[2].allowed).to.be.false;
    expect(results[2].executableAt).to.equal(0n);
    // caller   -> target2 (ROLE_DELAYED)  : delayed
    expect(results[3].allowed).to.be.true;
    expect(results[3].immediate).to.be.false;
    expect(results[3].delay).to.equal(EXECUTION_DELAY);
    // stranger -> target1 (ROLE_IMMEDIATE): denied
    expect(results[4].allowed).to.be.false;
    expect(results[4].executableAt).to.equal(0n);
  });

  it('is read-only: it does not schedule operations or modify roles', async function () {
    const { caller, manager, target1, fnSelector } = this;

    const accessBefore = await manager.getAccess(ROLE_DELAYED, caller);
    const scheduleBefore = await manager.getSchedule(await manager.hashOperation(caller, target1, fnSelector));

    await manager.canCallBatch([caller], [target1], [fnSelector]);

    const accessAfter = await manager.getAccess(ROLE_DELAYED, caller);
    const scheduleAfter = await manager.getSchedule(await manager.hashOperation(caller, target1, fnSelector));

    expect(accessAfter.since).to.equal(accessBefore.since);
    expect(accessAfter.currentDelay).to.equal(accessBefore.currentDelay);
    expect(scheduleAfter).to.equal(scheduleBefore);
  });

  it('reverts when the input arrays have mismatched lengths', async function () {
    const { caller, stranger, manager, target1, target2, fnSelector } = this;

    await expect(manager.canCallBatch([caller, stranger], [target1], [fnSelector, fnSelector]))
      .to.be.revertedWithCustomError(manager, 'AccessManagerInvalidBatchLength')
      .withArgs(2n, 1n, 2n);
  });

  it('returns an empty array for empty inputs', async function () {
    const { manager } = this;

    const results = await manager.canCallBatch([], [], []);
    expect(results).to.have.lengthOf(0);
  });
});
