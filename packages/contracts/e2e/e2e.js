const ganache = require('ganache');
const { ethers } = require('ethers');
const A = require('./build.json');

const U = (n) => ethers.parseEther(String(n));
let passed = 0;
let failed = 0;
async function expectRevert(promise, label) {
  try {
    const r = await promise;
    if (r && typeof r.wait === 'function') await r.wait(); // reverts surface at receipt time
    failed++;
    console.error(`  ✗ ${label} (did NOT revert)`);
  } catch {
    passed++;
    console.log(`  ✓ ${label}`);
  }
}
function ok(cond, label) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.error(`  ✗ ${label}`); }
}

async function main() {
  const provider = new ethers.BrowserProvider(
    ganache.provider({ logging: { quiet: true }, wallet: { deterministic: true } })
  );
  const [deployer, keeper, dev, mallory, ...delegates] = await Promise.all(
    [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => provider.getSigner(i))
  );
  const deploy = async (name, signer, ...args) =>
    (await new ethers.ContractFactory(A[name].abi, A[name].bytecode, signer).deploy(...args)).waitForDeployment();
  const addr = async (s) => await s.getAddress();

  // ── BoardVault: the permanent lock ──────────────────────────────────────
  console.log('BoardVault — locked 1% allocations');
  const board = await deploy('MockToken', deployer, 'BOARD', 'BOARD');
  const SUPPLY = U(1_000_000_000);
  const ONE_PCT = SUPPLY / 100n;
  await (await board.mint(await addr(deployer), SUPPLY)).wait();

  const seatNames = ['BULL', 'BURN', 'DIVIDEND', 'VAULT', 'DEGEN'];
  const delegateAddrs = await Promise.all([delegates[0], delegates[1], delegates[2], delegates[3], keeper].map(addr));
  const vault = await deploy('BoardVault', deployer, await board.getAddress(), seatNames, delegateAddrs);

  await (await board.approve(await vault.getAddress(), ONE_PCT * 5n)).wait();
  await (await vault.fundSeats(ONE_PCT)).wait();
  ok((await vault.totalLocked()) === ONE_PCT * 5n, 'five seats funded with 1% each (5% total)');
  ok((await board.balanceOf(await vault.getAddress())) === ONE_PCT * 5n, 'tokens physically in the vault');
  await expectRevert(vault.fundSeats(ONE_PCT), 'funding is one-shot (second fund reverts)');
  ok(
    !A.BoardVault.abi.some((f) => ['transfer', 'withdraw', 'rescue', 'sweep', 'setOwner', 'upgrade'].includes(f.name)),
    'ABI has no transfer/withdraw/rescue/owner path — lock is structural'
  );
  ok(await vault.isExcluded(await vault.getAddress()), 'vault excluded from rewards');
  ok(await vault.isExcluded(delegateAddrs[2]), 'seat delegates excluded from rewards');
  ok(!(await vault.isExcluded(await addr(mallory))), 'ordinary wallets not excluded');

  // ── TreasuryExecutor: guarded execution ─────────────────────────────────
  console.log('TreasuryExecutor — guarded execution');
  const usdg = await deploy('MockToken', deployer, 'USDG', 'USDG');
  const exec = await deploy('TreasuryExecutor', deployer, await addr(keeper));
  await (await usdg.mint(await exec.getAddress(), U(50_000))).wait();

  await (await exec.setTokenLimits(await usdg.getAddress(), U(5_000), U(8_000))).wait();
  await (await exec.setRecipient(await addr(dev), true)).wait();
  await (await exec.banAgentWallet(delegateAddrs[4])).wait();

  const usdgAddr = await usdg.getAddress();
  const key = (s) => ethers.id(s);
  const exeK = exec.connect(keeper);
  const far = BigInt(Math.floor(Date.now() / 1000) + 3600);

  // happy path transfer
  await (await exeK.execute(key('p1'), 0, usdgAddr, await addr(dev), U(3_000), far)).wait();
  ok((await usdg.balanceOf(await addr(dev))) === U(3_000), 'allowlisted TRANSFER executes');

  await expectRevert(exeK.execute(key('p1'), 0, usdgAddr, await addr(dev), U(3_000), far), 'duplicate idempotency key reverts');
  await expectRevert(exeK.execute(key('p2'), 0, usdgAddr, await addr(mallory), U(100), far), 'non-allowlisted recipient reverts');
  await expectRevert(exeK.execute(key('p3'), 0, usdgAddr, delegateAddrs[4], U(100), far), 'payment to agent wallet reverts');
  await expectRevert(exec.connect(deployer).setRecipient(delegateAddrs[4], true), 'agent wallet cannot be allowlisted');
  await expectRevert(exeK.execute(key('p4'), 0, usdgAddr, await addr(dev), U(5_001), far), 'per-action limit reverts');
  await (await exeK.execute(key('p5'), 0, usdgAddr, await addr(dev), U(5_000), far)).wait(); // day now at 8,000/8,000
  await expectRevert(exeK.execute(key('p6'), 0, usdgAddr, await addr(dev), U(1), far), 'daily limit reverts once 8,000/day is spent');
  await expectRevert(exeK.execute(key('p7'), 0, usdgAddr, await addr(dev), U(10), BigInt(Math.floor(Date.now() / 1000) - 10)), 'expired intent reverts');
  await expectRevert(exec.connect(mallory).execute(key('p8'), 0, usdgAddr, await addr(mallory), U(1), far), 'only keeper/owner may execute');

  // burn path
  const boardAddr = await board.getAddress();
  await (await board.mint(await exec.getAddress(), U(2_000))).wait();
  await (await exec.setTokenLimits(boardAddr, U(2_000), U(2_000))).wait();
  await (await exeK.execute(key('p9'), 1, boardAddr, ethers.ZeroAddress, U(1_500), far)).wait();
  ok((await board.balanceOf('0x000000000000000000000000000000000000dEaD')) === U(1_500), 'BURN sends to dead address');
  await expectRevert(exeK.execute(key('p10'), 1, boardAddr, await addr(mallory), U(10), far), 'BURN cannot redirect to a live wallet');

  // pause
  await (await exec.setPaused(true)).wait();
  await expectRevert(exeK.execute(key('p11'), 0, usdgAddr, await addr(dev), U(10), far), 'emergency pause blocks execution');
  await (await exec.setPaused(false)).wait();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
  console.log('E2E COMPLETE');
}
main().catch((e) => { console.error('E2E FAILED:', e.shortMessage || e.message || e); process.exit(1); });
