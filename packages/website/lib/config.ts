/** Client-side config — everything here is public by design. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
export const MINT_ADDRESS = process.env.NEXT_PUBLIC_MINT_ADDRESS ?? "";
export const PUMP_FUN_URL = MINT_ADDRESS ? `https://pump.fun/coin/${MINT_ADDRESS}` : "https://pump.fun";
