/**
 * A stand-in for the Supabase project the production build talks to. The e2e build points VITE_SUPABASE_URL at
 * http://supabase.e2e.test (apps/web/.env.e2e); these routes answer it from memory, so the shipped auth, sync and
 * service-worker code runs unchanged. Only what the app uses is implemented: the documents table and the auth user.
 */
import type { BrowserContext, Route } from '@playwright/test';

export const SUPABASE_ORIGIN = 'http://supabase.e2e.test';
/** supabase-js keeps the session under sb-<first host label>-auth-token. */
export const SESSION_KEY = 'sb-supabase-auth-token';
export const E2E_USER = { id: '00000000-0000-4000-8000-0000000000e2', email: 'e2e@test' };

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

function session(expiresAt: number) {
  const user = { id: E2E_USER.id, aud: 'authenticated', role: 'authenticated', email: E2E_USER.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  // An unsigned JWT: supabase-js reads its claims but never verifies the signature (the server would).
  const access_token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: E2E_USER.id, aud: 'authenticated', role: 'authenticated', email: E2E_USER.email, exp: expiresAt })}.e2e`;
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, refresh_token: 'e2e-refresh', user };
}

/** A stored auth-js session: valid for a year, or expired an hour ago. */
export function sessionJson(opts: { expired?: boolean } = {}): string {
  const now = Math.floor(Date.now() / 1000);
  return JSON.stringify(session(opts.expired ? now - 3600 : now + 365 * 24 * 3600));
}

export interface Row {
  id: string;
  owner_id: string;
  kind: string;
  data: unknown;
  updated_at: number;
  deleted: boolean;
  is_public: boolean;
  synced_seq: number;
}

/** The documents table, with the migration's rules: last write wins on updated_at, every accepted write gets a new sequence. */
export class FakeRemote {
  rows: Row[] = [];
  /** Each upsert batch the app sent, in order. */
  pushes: Row[][] = [];
  /** Every request the app made, as "METHOD /path?query". */
  requests: string[] = [];
  private seq = 0;

  seed(docs: (Partial<Row> & Pick<Row, 'id' | 'kind' | 'data'>)[]): void {
    for (const d of docs) this.write({ owner_id: E2E_USER.id, updated_at: Date.now(), deleted: false, is_public: false, synced_seq: 0, ...d });
  }

  private write(r: Row): boolean {
    const i = this.rows.findIndex((x) => x.id === r.id);
    if (i >= 0 && r.updated_at < this.rows[i].updated_at) return false;
    const row = { ...r, synced_seq: ++this.seq };
    if (i >= 0) this.rows[i] = row;
    else this.rows.push(row);
    return true;
  }

  private select(url: URL): Row[] {
    let out = [...this.rows];
    for (const [k, v] of url.searchParams) {
      const m = /^(eq|gt)\.(.*)$/.exec(v);
      if (!m || k === 'select' || k === 'order' || k === 'limit') continue;
      out = out.filter((r) => {
        const val = (r as unknown as Record<string, unknown>)[k];
        return m[1] === 'eq' ? String(val) === m[2] : Number(val) > Number(m[2]);
      });
    }
    const order = url.searchParams.get('order');
    if (order) {
      const [col, dir] = order.split('.');
      out.sort((a, b) => (Number((a as never)[col]) - Number((b as never)[col])) * (dir === 'desc' ? -1 : 1));
    }
    const limit = Number(url.searchParams.get('limit') ?? Infinity);
    return out.slice(0, limit);
  }

  private async handle(route: Route): Promise<void> {
    const req = route.request();
    const url = new URL(req.url());
    this.requests.push(`${req.method()} ${url.pathname}${url.search}`);
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    }
    if (url.pathname === '/rest/v1/documents') {
      if (req.method() === 'GET') return json(200, this.select(url));
      if (req.method() === 'POST') {
        const body = req.postDataJSON() as Row | Row[];
        const batch = (Array.isArray(body) ? body : [body]).map((r) => ({ ...r, synced_seq: 0 }));
        this.pushes.push(batch);
        for (const r of batch) this.write(r);
        return json(201, []);
      }
    }
    if (url.pathname === '/auth/v1/user') return json(200, JSON.parse(sessionJson()).user);
    if (url.pathname === '/auth/v1/token') return json(200, JSON.parse(sessionJson()));
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    return json(404, { message: `fake supabase: no route for ${req.method()} ${url.pathname}` });
  }

  /** Routes the fake host on the whole context, so requests that pass through the service worker are answered too. */
  async install(context: BrowserContext): Promise<void> {
    await context.route(`${SUPABASE_ORIGIN}/**`, (route) => this.handle(route));
  }
}
