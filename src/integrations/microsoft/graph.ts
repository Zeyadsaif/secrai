import { GRAPH_BASE } from "./config";

/**
 * Minimal, dependency-free Microsoft Graph client.
 * - Follows @odata.nextLink paging automatically.
 * - Honours 429/503 Retry-After with bounded exponential backoff.
 * - Returns typed rows; callers narrow with their own interfaces.
 */

interface GraphListResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

const MAX_RETRIES = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function graphFetch(url: string, token: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      // Graph responses are per-tenant live data; never cache.
      cache: "no-store",
    });
    if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 2 ** attempt;
      await sleep(Math.min(retryAfter, 30) * 1000);
      continue;
    }
    return res;
  }
}

function resolveUrl(pathOrUrl: string, base: string): string {
  return pathOrUrl.startsWith("http") ? pathOrUrl : `${base}${pathOrUrl}`;
}

/** GET a single Graph resource. Returns null on 404. */
export async function graphGet<T>(
  path: string,
  token: string,
  base: string = GRAPH_BASE,
): Promise<T | null> {
  const res = await graphFetch(resolveUrl(path, base), token);
  if (res.status === 404) return null;
  if (!res.ok) throw new GraphError(res.status, await safeText(res), path);
  return (await res.json()) as T;
}

/** GET a Graph collection, following all pages, with a hard page cap. */
export async function graphList<T>(
  path: string,
  token: string,
  opts: { base?: string; maxPages?: number } = {},
): Promise<T[]> {
  const base = opts.base ?? GRAPH_BASE;
  const maxPages = opts.maxPages ?? 50;
  let url: string | undefined = resolveUrl(path, base);
  const items: T[] = [];
  for (let page = 0; url && page < maxPages; page++) {
    const res: Response = await graphFetch(url, token);
    if (res.status === 404) break;
    if (!res.ok) throw new GraphError(res.status, await safeText(res), path);
    const body = (await res.json()) as GraphListResponse<T>;
    if (Array.isArray(body.value)) items.push(...body.value);
    url = body["@odata.nextLink"];
  }
  return items;
}

export class GraphError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public path: string,
  ) {
    super(`Graph ${status} on ${path}: ${detail}`);
    this.name = "GraphError";
  }
  /** True when the tenant simply lacks the license/data (treat as empty, not fatal). */
  get isMissingData(): boolean {
    return this.status === 403 || this.status === 404;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "<no body>";
  }
}
