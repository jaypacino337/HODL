/**
 * Parcl Labs client — https://docs.parcllabs.com/
 *
 * v1 data plan: Parcl Labs covers US housing markets, which is exactly the
 * launch board (Miami, New York, Austin, Phoenix, Chicago + US aggregate).
 * Toronto / non-US cities need a licensed local index provider and a second
 * adapter behind the same Feed interface before any market can reference them.
 */

const BASE = "https://api.parcllabs.com/v1";

export interface Feed {
  /** Our stable feed id, e.g. "parcl:price:miami". */
  id: string;
  city: string;
  metric: string;
  /** Search term used to resolve the Parcl market id once. */
  searchQuery: string;
  /** "price" (sale price feed) or "rental". */
  kind: "price" | "rental";
}

/** The feeds the launch markets settle against. */
export const FEEDS: Feed[] = [
  { id: "parcl:price:miami", city: "Miami", metric: "price feed ($/sqft)", searchQuery: "Miami", kind: "price" },
  { id: "parcl:price:new-york", city: "New York", metric: "price feed ($/sqft)", searchQuery: "New York", kind: "price" },
  { id: "parcl:price:austin", city: "Austin", metric: "price feed ($/sqft)", searchQuery: "Austin", kind: "price" },
  { id: "parcl:price:phoenix", city: "Phoenix", metric: "price feed ($/sqft)", searchQuery: "Phoenix", kind: "price" },
  { id: "parcl:price:chicago", city: "Chicago", metric: "price feed ($/sqft)", searchQuery: "Chicago", kind: "price" },
  { id: "parcl:price:usa", city: "United States", metric: "price feed ($/sqft)", searchQuery: "United States", kind: "price" },
  { id: "parcl:rental:new-york", city: "New York", metric: "rental index", searchQuery: "New York", kind: "rental" },
];

export class ParclClient {
  private idCache = new Map<string, number>();

  constructor(private apiKey: string) {}

  private async get(path: string): Promise<any> {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: this.apiKey, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Parcl ${path}: HTTP ${res.status} ${await res.text()}`);
    return res.json();
  }

  /** Resolve our feed to a Parcl market id (parcl_id), cached per process. */
  async resolveParclId(feed: Feed): Promise<number> {
    const cached = this.idCache.get(feed.id);
    if (cached) return cached;
    const q = encodeURIComponent(feed.searchQuery);
    const data = await this.get(`/search/markets?query=${q}&location_type=CITY&sort_by=TOTAL_POPULATION&sort_order=DESC&limit=1`);
    const item = data?.items?.[0];
    if (!item?.parcl_id) throw new Error(`Parcl id not found for "${feed.searchQuery}"`);
    this.idCache.set(feed.id, item.parcl_id);
    return item.parcl_id;
  }

  /** Daily series for a feed, newest last: [{date: 'YYYY-MM-DD', value}]. */
  async fetchSeries(feed: Feed, startDate: string): Promise<Array<{ date: string; value: number }>> {
    const parclId = await this.resolveParclId(feed);
    const endpoint = feed.kind === "rental" ? "rental_price_feed" : "price_feed";
    const data = await this.get(`/price_feed/${parclId}/${endpoint}?start_date=${startDate}&limit=1000`);
    const items = data?.items ?? [];
    return items
      .map((it: any) => ({ date: String(it.date), value: Number(it.price_feed ?? it.rental_price_feed ?? it.value) }))
      .filter((p: { value: number }) => Number.isFinite(p.value) && p.value > 0);
  }
}
