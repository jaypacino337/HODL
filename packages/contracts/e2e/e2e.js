const ganache = require('ganache');
const { ethers } = require('ethers');
const A = require('./build.json');

const U = (n) => BigInt(Math.round(n * 1e6)); // 6-decimal USDG
const fmt = (x) => (Number(x) / 1e6).toFixed(2);

async function main() {
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, wallet: { deterministic: true } }));
  const [deployer, alice, bob] = await Promise.all([0, 1, 2].map(async i => await provider.getSigner(i)));
  const deploy = async (name, signer, ...args) =>
    (await new ethers.ContractFactory(A[name].abi, A[name].bytecode, signer).deploy(...args)).waitForDeployment();

  // ── deploy stack ──
  const usdg = await deploy('MockUSDG', deployer);
  const pool = await deploy('HousePool', deployer, await usdg.getAddress());
  const oracle = await deploy('IndexOracle', deployer);
  const factory = await deploy('MarketFactory', deployer, await usdg.getAddress(), await pool.getAddress(), await oracle.getAddress(), await deployer.getAddress());
  await (await pool.setFactory(await factory.getAddress())).wait();
  const TPL = ethers.keccak256(ethers.toUtf8Bytes('binary:index-change'));
  await (await factory.setTemplate(TPL, true, 'binary:index-change', 'Parcl (US only)')).wait();
  console.log('deployed: usdg, pool, oracle, factory ✓');

  // ── LP deposits: deployer 500, bob 100 ──
  await (await usdg.mint(await deployer.getAddress(), U(500))).wait();
  await (await usdg.connect(deployer).approve(await pool.getAddress(), U(500))).wait();
  await (await pool.deposit(U(500))).wait();
  await (await usdg.connect(bob).faucet()).wait();
  await (await usdg.connect(bob).approve(await pool.getAddress(), U(100))).wait();
  await (await pool.connect(bob).deposit(U(100))).wait();
  console.log('LP deposits ✓ pool totalAssets =', fmt(await pool.totalAssets()));

  // ── create $50-seeded binary market ──
  const now = (await provider.getBlock('latest')).timestamp;
  const locksAt = now + 3600;
  await (await factory.createProtocolMarket(TPL, 'Test: index up?', 'test-feed, YES iff > 0', 2, locksAt, U(50))).wait();
  const marketAddr = await factory.allMarkets(0);
  const market = new ethers.Contract(marketAddr, A.OverbidMarket.abi, deployer);
  console.log('market created ✓ pools =', (await market.poolBalances()).map(fmt).join('/'),
    'pool deployedAssets =', fmt(await pool.deployedAssets()), 'totalAssets =', fmt(await pool.totalAssets()));

  // ── alice trades ──
  await (await usdg.connect(alice).faucet()).wait();
  await (await usdg.connect(alice).approve(marketAddr, U(10000))).wait();
  const p0 = Number(await market.impliedProbability(0)) / 1e18;
  const q = await market.calcBuyAmount(U(20), 0);
  await (await market.connect(alice).buy(0, U(20), q)).wait();
  const p1 = Number(await market.impliedProbability(0)) / 1e18;
  console.log(`alice buys $20 YES → ${fmt(q)} shares ✓ prob ${ (p0*100).toFixed(1) }% → ${ (p1*100).toFixed(1) }%`);

  // slippage guard fires
  let threw = false;
  try { await market.connect(alice).buy.staticCall(0, U(20), q * 2n); } catch { threw = true; }
  console.log('slippage guard reverts ✓', threw);

  // sell a bit back
  const sellReturn = U(5);
  const sharesNeeded = await market.calcSellAmount(sellReturn, 0);
  await (await market.connect(alice).sell(0, sellReturn, sharesNeeded)).wait();
  console.log(`alice sells for $5 back → ${fmt(sharesNeeded)} shares in ✓`);

  // ── lock, resolve, redeem ──
  await provider.send('evm_increaseTime', [7200]);
  await provider.send('evm_mine', []);
  threw = false;
  try { await market.connect(alice).buy.staticCall(0, U(10), 0); } catch { threw = true; }
  console.log('trading locked after locksAt ✓', threw);

  await (await oracle.resolveMarket(marketAddr, 0, ethers.keccak256(ethers.toUtf8Bytes('evidence')))).wait();
  const aliceShares = await market.sharesOf(await alice.getAddress(), 0);
  const balBefore = await usdg.balanceOf(await alice.getAddress());
  await (await market.connect(alice).redeem()).wait();
  const balAfter = await usdg.balanceOf(await alice.getAddress());
  console.log(`resolved YES ✓ alice redeems ${fmt(aliceShares)} shares → +$${fmt(balAfter - balBefore)} (1:1 ✓ ${aliceShares === balAfter - balBefore})`);

  // ── fees + residual home to pool ──
  const treasuryBefore = await usdg.balanceOf(await deployer.getAddress());
  const poolBefore = await usdg.balanceOf(await pool.getAddress());
  const fees = await market.accruedFees();
  await (await market.distributeFees()).wait();
  const poolGot = (await usdg.balanceOf(await pool.getAddress())) - poolBefore;
  const treasuryGot = (await usdg.balanceOf(await deployer.getAddress())) - treasuryBefore;
  console.log(`fees $${fmt(fees)} distributed ✓ pool +$${fmt(poolGot)} (80% = lp+creator), treasury +$${fmt(treasuryGot)} (20%)`);

  await (await market.sweepResidualToPool()).wait();
  await (await factory.reconcileSettled(marketAddr)).wait();
  const marketLeft = await usdg.balanceOf(marketAddr);
  console.log(`residual swept ✓ market balance left $${fmt(marketLeft)}, pool deployedAssets = ${fmt(await pool.deployedAssets())}`);

  // ── LPs withdraw everything; accounting must balance to the cent ──
  const poolAssets = await pool.totalAssets();
  const poolBal = await usdg.balanceOf(await pool.getAddress());
  console.log(`pool totalAssets $${fmt(poolAssets)} vs actual balance $${fmt(poolBal)} (must match: ${poolAssets === poolBal})`);
  for (const [who, name] of [[bob, 'bob'], [deployer, 'deployer']]) {
    const sh = await pool.sharesOf(await who.getAddress());
    const before = await usdg.balanceOf(await who.getAddress());
    await (await pool.connect(who).withdraw(sh)).wait();
    console.log(`${name} withdraws ${fmt(sh)} shares → +$${fmt(await usdg.balanceOf(await who.getAddress()) - before)}`);
  }
  console.log('final pool balance $' + fmt(await usdg.balanceOf(await pool.getAddress())), 'totalShares', (await pool.totalShares()).toString());
  console.log('\nE2E COMPLETE');
}
main().catch(e => { console.error('E2E FAILED:', e.shortMessage || e.message); process.exit(1); });
