import { network } from 'hardhat';
import { expect } from 'chai';
import { selector } from '../../helpers/methods';
import * as duration from '../../helpers/time';
import { hashOperation } from '../../helpers/access-manager';

const connection = await network.create();
const {
  ethers,
  helpers: { time },
  networkHelpers: { loadFixture },
} = connection;

// Two roles: one without and one with an execution delay
const ROLE_IMMEDIATE = 1n;
const ROLE_DELAYED = 2n;
const EXECUTION_DELAY = duration.hours(10);

async function fixture() {
  const [admin, caller, other] = await ethers.getSigners();

  const manager = await ethers.deployContract('AccessManagerMock', [admin]);
  const target = await ethers.deployContract('$AccessManagedTarget', [manager]);

  // Three target calls: immediate, delayed and denied (denied keeps the default ADMIN_ROLE)
  const selectors = {
    immediate: selector('fnRestricted()'),
    delayed: selector('setIsConsumingScheduledOp(bool,bytes32)'),
    denied: selector('fnUnrestricted()'),
  };

  // The caller is a member of both roles
  await manager.connect(admin).grantRole(ROLE_IMMEDIATE, caller, 0);
  await manager.connect(admin).grantRole(ROLE_DELAYED, caller, EXECUTION_DELAY);

  await manager.connect(admin).setTargetFunctionRole(target, [selectors.immediate], ROLE_IMMEDIATE);
  await manager.connect(admin).setTargetFunctionRole(target, [selectors.delayed], ROLE_DELAYED);

  return { admin, caller, other, manager, target, selectors };
}

describe('AccessManager canCallBatch', function () {
  beforeEach(async function () {
    Object.assign(this, await loadFixture(fixture));
  });

  it('returns per-item executable time for immediate, delayed and denied calls', async function () {
    const now = await time.clock.timestamp();

    const [immediate, executableAt] = await this.manager.canCallBatch(
      this.caller,
      [this.target, this.target, this.target],
      [this.selectors.immediate, this.selectors.delayed, this.selectors.denied],
    );

    // immediate call: executable right now
    // delayed call: executable at now + execution delay
    // denied call: not executable (0), and does not affect the other items
    expect(Array.from(immediate)).to.deep.equal([true, false, false]);
    expect(Array.from(executableAt)).to.deep.equal([now, now + EXECUTION_DELAY, 0n]);
  });

  it('returns all-denied for a caller without any of the required roles', async function () {
    const [immediate, executableAt] = await this.manager.canCallBatch(
      this.other,
      [this.target, this.target, this.target],
      [this.selectors.immediate, this.selectors.delayed, this.selectors.denied],
    );

    expect(Array.from(immediate)).to.deep.equal([false, false, false]);
    expect(Array.from(executableAt)).to.deep.equal([0n, 0n, 0n]);
  });

  it('does not schedule operations nor modify roles', async function () {
    const operationId = hashOperation(this.caller, this.target, this.selectors.immediate);
    const accessBefore = Array.from(await this.manager.getAccess(ROLE_DELAYED, this.caller));

    await this.manager.canCallBatch(
      this.caller,
      [this.target, this.target, this.target],
      [this.selectors.immediate, this.selectors.delayed, this.selectors.denied],
    );

    // Nothing was scheduled
    expect(await this.manager.getSchedule(operationId)).to.equal(0n);
    // Roles were not modified
    expect(Array.from(await this.manager.getAccess(ROLE_DELAYED, this.caller))).to.deep.equal(accessBefore);

    const [isMemberImmediate, delayImmediate] = await this.manager.hasRole(ROLE_IMMEDIATE, this.caller);
    expect(isMemberImmediate).to.be.true;
    expect(delayImmediate).to.equal(0n);

    const [isMemberDelayed, delayDelayed] = await this.manager.hasRole(ROLE_DELAYED, this.caller);
    expect(isMemberDelayed).to.be.true;
    expect(delayDelayed).to.equal(EXECUTION_DELAY);
  });

  it('returns empty arrays for an empty batch', async function () {
    const [immediate, executableAt] = await this.manager.canCallBatch(this.caller, [], []);

    expect(Array.from(immediate)).to.deep.equal([]);
    expect(Array.from(executableAt)).to.deep.equal([]);
  });

  it('reverts when targets and selectors lengths differ', async function () {
    await expect(this.manager.canCallBatch(this.caller, [this.target, this.target], [this.selectors.immediate]))
      .to.be.revertedWithCustomError(this.manager, 'AccessManagerInvalidBatchLength')
      .withArgs(2n, 1n);
  });
});
