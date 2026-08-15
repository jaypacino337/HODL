"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { decodeError, type DecodedError } from "./errors";

export type TxState =
  | { kind: "idle" }
  | { kind: "building" }
  | { kind: "simulating" }
  | { kind: "signing" }
  | { kind: "confirming"; signature: string }
  | { kind: "done"; signature: string }
  | { kind: "error"; error: DecodedError };

/**
 * Send one instruction with the connected wallet.
 *
 * Every transaction is SIMULATED before it is signed. A simulation costs nothing and
 * catches the paused mint, the empty wallet, the sold-out collection and the lost race
 * before the user is asked to approve anything — and it gives us the program logs,
 * which is where the real error message lives.
 */
export function useTx(which: "mint" | "buyback" = "mint") {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signTransaction } = useWallet();
  const [state, setState] = useState<TxState>({ kind: "idle" });

  const reset = useCallback(() => setState({ kind: "idle" }), []);

  const send = useCallback(
    async (
      build: () => TransactionInstruction,
      opts: { computeUnits?: number } = {},
    ): Promise<{ ok: true; signature: string } | { ok: false; error: DecodedError }> => {
      if (!publicKey) {
        const error = decodeError(new Error("Connect a wallet first."), which);
        setState({ kind: "error", error });
        return { ok: false, error };
      }

      try {
        setState({ kind: "building" });
        const tx = new Transaction();
        if (opts.computeUnits) {
          tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: opts.computeUnits }));
        }
        tx.add(build());

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        setState({ kind: "simulating" });
        const sim = await connection.simulateTransaction(tx);
        if (sim.value.err) {
          const error = decodeError(
            Object.assign(new Error(JSON.stringify(sim.value.err)), {
              logs: sim.value.logs ?? [],
            }),
            which,
          );
          setState({ kind: "error", error });
          return { ok: false, error };
        }

        setState({ kind: "signing" });
        const signature = await sendTransaction(tx, connection);

        setState({ kind: "confirming", signature });
        const conf = await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed",
        );
        if (conf.value.err) {
          throw Object.assign(new Error(JSON.stringify(conf.value.err)), { logs: [] });
        }

        setState({ kind: "done", signature });
        return { ok: true, signature };
      } catch (e) {
        const error = decodeError(e, which);
        setState({ kind: "error", error });
        return { ok: false, error };
      }
    },
    // signTransaction is unused directly but its presence signals wallet readiness.
    [connection, publicKey, sendTransaction, signTransaction, which],
  );

  return { state, send, reset, publicKey };
}

/** The associated token account for a given owner + mint. */
export function ata(owner: PublicKey, mint: PublicKey): PublicKey {
  const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const ASSOC = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN.toBuffer(), mint.toBuffer()],
    ASSOC,
  )[0];
}
