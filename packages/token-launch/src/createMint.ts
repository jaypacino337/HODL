/**
 * Optional self-launch path: creates a Token-2022 mint with the TransferFee
 * extension, so every on-chain transfer automatically withholds a fee that
 * the fee-harvester can later withdraw. This is NOT the pump.fun path —
 * pump.fun mints plain SPL tokens with no per-transfer tax, so on pump.fun
 * the "fee" comes from claiming creator rewards instead (see
 * packages/fee-harvester/src/harvestPumpFunCreatorFees.ts).
 *
 * Use this script only if you are launching directly (own AMM pool) rather
 * than bonding-curve-first on pump.fun.
 */
import {
  clusterApiUrl,
  Connection,
  Keypair,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ExtensionType,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  getMintLen,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const DECIMALS = 6;
const TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(DECIMALS);

/** 3% transfer fee, capped at 5,000,000 base units per single transfer. */
const TRANSFER_FEE_BASIS_POINTS = 300;
const MAX_TRANSFER_FEE = 5_000_000n * 10n ** BigInt(DECIMALS);

function loadOrCreateKeypair(filePath: string): Keypair {
  if (fs.existsSync(filePath)) {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  const kp = Keypair.generate();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

async function main() {
  const rpcUrl = process.env.RPC_URL ?? clusterApiUrl("devnet");
  const connection = new Connection(rpcUrl, "confirmed");

  const payer = loadOrCreateKeypair(process.env.PAYER_KEYPAIR_PATH ?? "./keys/payer.json");
  const mintAuthority = loadOrCreateKeypair(
    process.env.MINT_AUTHORITY_KEYPAIR_PATH ?? "./keys/mint-authority.json"
  );
  const transferFeeAuthority = loadOrCreateKeypair(
    process.env.FEE_AUTHORITY_KEYPAIR_PATH ?? "./keys/fee-authority.json"
  );
  const mintKeypair = Keypair.generate();

  console.log("Payer:", payer.publicKey.toBase58());
  console.log("Mint:", mintKeypair.publicKey.toBase58());
  console.log("Mint authority:", mintAuthority.publicKey.toBase58());
  console.log("Transfer fee / withdraw authority:", transferFeeAuthority.publicKey.toBase58());

  const balance = await connection.getBalance(payer.publicKey);
  if (balance === 0) {
    throw new Error(
      `Payer ${payer.publicKey.toBase58()} has 0 SOL. Fund it (e.g. \`solana airdrop 2\` on devnet) before running this script.`
    );
  }

  const extensions = [ExtensionType.TransferFeeConfig];
  const mintLen = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeTransferFeeConfigInstruction(
      mintKeypair.publicKey,
      transferFeeAuthority.publicKey, // authority allowed to change fee config
      transferFeeAuthority.publicKey, // authority allowed to withdraw withheld fees
      TRANSFER_FEE_BASIS_POINTS,
      MAX_TRANSFER_FEE,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      DECIMALS,
      mintAuthority.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
    )
  );

  const mintSig = await sendAndConfirmTransaction(connection, tx, [payer, mintKeypair]);
  console.log("Mint created:", mintSig);

  const payerAta = await createAssociatedTokenAccountIdempotent(
    connection,
    payer,
    mintKeypair.publicKey,
    payer.publicKey,
    {},
    TOKEN_2022_PROGRAM_ID
  );

  const mintSig2 = await mintTo(
    connection,
    payer,
    mintKeypair.publicKey,
    payerAta,
    mintAuthority,
    TOTAL_SUPPLY,
    [],
    {},
    TOKEN_2022_PROGRAM_ID
  );
  console.log(`Minted ${TOTAL_SUPPLY.toString()} base units to ${payerAta.toBase58()}:`, mintSig2);

  console.log("\nAdd this to your .env:");
  console.log(`MINT_ADDRESS=${mintKeypair.publicKey.toBase58()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
