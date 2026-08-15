/**
 * Full-lifecycle Anchor test: setup -> pause -> mint -> redeem -> re-mint, plus every
 * failure path that matters.
 *
 * Run with `anchor test`. This needs the Solana toolchain (cargo-build-sbf and
 * solana-test-validator) plus the mpl-core program cloned into the validator — see
 * Anchor.toml's [test.validator] section.
 *
 * NOT YET EXECUTED: the container this was written in has no Solana toolchain
 * (release.anza.xyz is blocked by the egress proxy), so the programs have been
 * compile-verified with `cargo check` but these assertions have never run against a
 * validator. Treat every expectation below as unverified until it goes green on your
 * machine. That is the first thing to do before any devnet rehearsal.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";
import {
  BUYBACK_PAYOUT,
  HONORARY_COUNT,
  MINT_PRICE,
  TOTAL_SUPPLY,
} from "../../config";

const MPL_CORE = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
const HONORARY_INDICES = Array.from({ length: HONORARY_COUNT }, (_, i) => i);

describe("pumpbrokers lifecycle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const mintProgram = anchor.workspace.PumpbrokerMint as Program;
  const buybackProgram = anchor.workspace.PumpbrokerBuyback as Program;

  const authority = (provider.wallet as anchor.Wallet).payer;
  const buyer = Keypair.generate();

  let paymentMint: PublicKey;
  let collection: Keypair;
  let configPda: PublicKey;
  let poolPda: PublicKey;
  let vaultPda: PublicKey;
  let treasuryPda: PublicKey;
  let buybackPda: PublicKey;
  let buyerAta: PublicKey;

  const seed = (s: string) => Buffer.from(s, "utf8");
  const assetPda = (n: number) => {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(n, 0);
    return PublicKey.findProgramAddressSync(
      [seed("asset"), configPda.toBuffer(), b],
      mintProgram.programId,
    )[0];
  };

  before(async () => {
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(buyer.publicKey, 5e9),
    );

    // A throwaway stand-in for $PUMPBROKER, at the same 6 decimals.
    paymentMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      6,
    );
    buyerAta = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        buyer,
        paymentMint,
        buyer.publicKey,
      )
    ).address;
    // Enough for three mints.
    await mintTo(provider.connection, authority, paymentMint, buyerAta, authority, 3_000_000_000_000n);

    collection = Keypair.generate();
    [configPda] = PublicKey.findProgramAddressSync([seed("config")], mintProgram.programId);
    [poolPda] = PublicKey.findProgramAddressSync([seed("pool")], mintProgram.programId);
    [vaultPda] = PublicKey.findProgramAddressSync([seed("vault")], mintProgram.programId);
    [treasuryPda] = PublicKey.findProgramAddressSync(
      [seed("treasury"), configPda.toBuffer()],
      mintProgram.programId,
    );
    [buybackPda] = PublicKey.findProgramAddressSync(
      [seed("buyback")],
      buybackProgram.programId,
    );

    // The collection is created off-program by scripts/create-collection.ts; here we
    // create it directly so the test is self-contained.
    // (See that script for the production path.)
  });

  it("initializes paused", async () => {
    await mintProgram.methods
      .initialize({
        price: new BN(MINT_PRICE.toString()),
        totalSupply: TOTAL_SUPPLY,
        honoraryCount: HONORARY_COUNT,
        delayedReveal: true,
        baseUri: "https://arweave.net/test/",
        placeholderUri: "https://arweave.net/test/placeholder.json",
      })
      .accounts({
        authority: authority.publicKey,
        config: configPda,
        vault: vaultPda,
        paymentMint,
        treasury: treasuryPda,
        collection: collection.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const cfg = await mintProgram.account.config.fetch(configPda);
    // The single most important assertion in this file: a fresh deploy cannot mint.
    assert.isFalse(cfg.isActive);
    assert.equal(cfg.minted, 0);
    assert.equal(cfg.redeemer.toBase58(), PublicKey.default.toBase58());
  });

  it("seeds the pool with 990 indices, excluding the honoraries", async () => {
    await mintProgram.methods
      .initPool(HONORARY_INDICES)
      .accounts({
        authority: authority.publicKey,
        config: configPda,
        pool: poolPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const pool = await mintProgram.account.pool.fetch(poolPda);
    assert.equal(pool.indices.length, TOTAL_SUPPLY - HONORARY_COUNT);
    for (const h of HONORARY_INDICES) {
      assert.notInclude(pool.indices, h, `honorary ${h} must not be mintable`);
    }
  });

  it("refuses to mint while paused", async () => {
    await assert.isRejected(mintOnce(0), /MintPaused|paused/i);
  });

  it("refuses to open the mint for a non-authority", async () => {
    await assert.isRejected(
      mintProgram.methods
        .setActive(true)
        .accounts({ authority: buyer.publicKey, config: configPda, pool: poolPda })
        .signers([buyer])
        .rpc(),
      /Unauthorized|ConstraintAddress/i,
    );
  });

  it("opens with one transaction", async () => {
    await mintProgram.methods
      .setActive(true)
      .accounts({ authority: authority.publicKey, config: configPda, pool: poolPda })
      .rpc();
    assert.isTrue((await mintProgram.account.config.fetch(configPda)).isActive);
  });

  it("mints, charges the buyer, and credits the program treasury", async () => {
    const before = (await getAccount(provider.connection, treasuryPda)).amount;
    await mintOnce(0);

    const after = (await getAccount(provider.connection, treasuryPda)).amount;
    assert.equal((after - before).toString(), MINT_PRICE.toString());

    const cfg = await mintProgram.account.config.fetch(configPda);
    assert.equal(cfg.minted, 1);

    // The drawn index is recorded on chain, so the reveal cannot rewrite it.
    const pool = await mintProgram.account.pool.fetch(poolPda);
    assert.equal(pool.assigned.length, 1);
    assert.notInclude(HONORARY_INDICES, pool.assigned[0]);
    assert.equal(pool.indices.length, TOTAL_SUPPLY - HONORARY_COUNT - 1);
  });

  it("rejects a stale mint number instead of a confusing runtime error", async () => {
    // This is the two-wallets-race-for-the-last-broker case: the loser sends the
    // number that was correct a moment ago and must get MintRaced back.
    await assert.isRejected(mintOnce(0), /MintRaced|took that broker/i);
  });

  it("rejects a buyer who cannot cover the price", async () => {
    const broke = Keypair.generate();
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(broke.publicKey, 2e9),
    );
    const brokeAta = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        broke,
        paymentMint,
        broke.publicKey,
      )
    ).address;
    await assert.isRejected(
      mintOnce(1, broke, brokeAta),
      /InsufficientTokens|don't have enough/i,
    );
  });

  it("refuses redemption while the buyback program is not connected", async () => {
    await buybackProgram.methods
      .initialize(new BN(BUYBACK_PAYOUT.toString()))
      .accounts({
        authority: authority.publicKey,
        config: buybackPda,
        mintConfig: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Deployed but not switched on, and not connected — redemption must be dead.
    assert.isFalse((await buybackProgram.account.buybackConfig.fetch(buybackPda)).isActive);
    await assert.isRejected(redeem(0), /BuybackPaused|paused/i);
  });

  it("rejects a payout above the mint price", async () => {
    await assert.isRejected(
      buybackProgram.methods
        .setPayoutAmount(new BN((MINT_PRICE + 1n).toString()))
        .accounts({ authority: authority.publicKey, config: buybackPda, mintConfig: configPda })
        .rpc(),
      /PayoutExceedsMintPrice|drains/i,
    );
  });

  it("connects piece 3 without redeploying piece 2", async () => {
    await mintProgram.methods
      .setRedeemer(buybackPda)
      .accounts({ authority: authority.publicKey, config: configPda, pool: poolPda })
      .rpc();
    await buybackProgram.methods
      .setActive(true)
      .accounts({ authority: authority.publicKey, config: buybackPda })
      .rpc();

    const cfg = await mintProgram.account.config.fetch(configPda);
    assert.equal(cfg.redeemer.toBase58(), buybackPda.toBase58());
  });

  it("redeems: asset goes to the vault, tokens come back, supply is unchanged", async () => {
    const balBefore = (await getAccount(provider.connection, buyerAta)).amount;
    await redeem(0);

    const balAfter = (await getAccount(provider.connection, buyerAta)).amount;
    assert.equal((balAfter - balBefore).toString(), BUYBACK_PAYOUT.toString());

    const vault = await mintProgram.account.vault.fetch(vaultPda);
    assert.deepEqual([...vault.queue], [0], "the broker must be queued as re-mintable");

    // Nothing burned, nothing created: still exactly one asset in existence.
    const cfg = await mintProgram.account.config.fetch(configPda);
    assert.equal(cfg.minted, 1);
  });

  it("keeps the spread in the treasury", async () => {
    const treasury = (await getAccount(provider.connection, treasuryPda)).amount;
    assert.equal(treasury.toString(), (MINT_PRICE - BUYBACK_PAYOUT).toString());
  });

  it("re-mints the returned broker instead of creating a new one", async () => {
    await remint(0);
    const vault = await mintProgram.account.vault.fetch(vaultPda);
    assert.equal(vault.queue.length, 0);
    // minted is still 1 — a re-mint moves an existing asset, it does not create one.
    assert.equal((await mintProgram.account.config.fetch(configPda)).minted, 1);
  });

  it("refuses redemption when the treasury cannot cover it", async () => {
    await mintProgram.methods
      .withdrawTreasury(new BN((await getAccount(provider.connection, treasuryPda)).amount.toString()))
      .accounts({
        authority: authority.publicKey,
        config: configPda,
        paymentMint,
        treasury: treasuryPda,
        destination: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    await assert.isRejected(redeem(0), /VaultInsufficient|can't cover/i);
  });

  it("disconnects piece 3 instantly, without touching piece 2's deployment", async () => {
    await mintProgram.methods
      .setRedeemer(null)
      .accounts({ authority: authority.publicKey, config: configPda, pool: poolPda })
      .rpc();

    const cfg = await mintProgram.account.config.fetch(configPda);
    assert.equal(cfg.redeemer.toBase58(), PublicKey.default.toBase58());
    // ...and the mint keeps running.
    assert.isTrue(cfg.isActive);
  });

  // ---------------------------------------------------------------- helpers

  function mintOnce(n: number, who = buyer, ata = buyerAta) {
    return mintProgram.methods
      .mint(n)
      .accounts({
        minter: who.publicKey,
        config: configPda,
        pool: poolPda,
        paymentMint,
        minterTokenAccount: ata,
        treasury: treasuryPda,
        asset: assetPda(n),
        collection: collection.publicKey,
        mplCoreProgram: MPL_CORE,
        slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([who])
      .rpc();
  }

  function remint(n: number) {
    return mintProgram.methods
      .remint(n)
      .accounts({
        minter: buyer.publicKey,
        config: configPda,
        vault: vaultPda,
        paymentMint,
        minterTokenAccount: buyerAta,
        treasury: treasuryPda,
        asset: assetPda(n),
        collection: collection.publicKey,
        mplCoreProgram: MPL_CORE,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();
  }

  function redeem(n: number) {
    return buybackProgram.methods
      .redeem(n)
      .accounts({
        holder: buyer.publicKey,
        config: buybackPda,
        mintConfig: configPda,
        mintVault: vaultPda,
        asset: assetPda(n),
        collection: collection.publicKey,
        paymentMint,
        treasury: treasuryPda,
        holderTokenAccount: buyerAta,
        mintProgram: mintProgram.programId,
        mplCoreProgram: MPL_CORE,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();
  }
});
