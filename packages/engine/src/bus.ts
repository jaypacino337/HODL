import type { BoardMessage } from "@board/shared";
import type { Response } from "express";

/**
 * Live event bus → Server-Sent Events. Ordered by per-session seq, replayed
 * from Last-Event-ID on reconnect (the API pulls missed rows from the DB and
 * streams them before attaching), duplicates impossible because seq is the
 * event id. Heartbeats keep proxies from closing idle streams.
 */

export type LiveEvent =
  | { type: "message"; message: BoardMessage }
  | { type: "stage"; sessionId: string; stage: string }
  | { type: "proposal"; proposalId: string; status: string }
  | { type: "state"; launchState: string };

interface Client {
  res: Response;
}

const clients = new Set<Client>();

export function attachClient(res: Response): () => void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  res.write(`retry: 3000\n\n`);
  const client: Client = { res };
  clients.add(client);
  return () => clients.delete(client);
}

export function sendTo(res: Response, event: LiveEvent, id?: number): void {
  const idLine = id !== undefined ? `id: ${id}\n` : "";
  res.write(`${idLine}event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

export function broadcast(event: LiveEvent): void {
  const id = event.type === "message" ? event.message.seq : undefined;
  for (const c of clients) {
    try {
      sendTo(c.res, event, id);
    } catch {
      clients.delete(c);
    }
  }
}

export function clientCount(): number {
  return clients.size;
}

setInterval(() => {
  for (const c of clients) {
    try {
      c.res.write(`: hb ${Date.now()}\n\n`);
    } catch {
      clients.delete(c);
    }
  }
}, 25_000).unref();
