interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

declare module "cloudflare:workers" {
  export const env: {
    DB: D1Database;
    ASSETS: Fetcher;
    TURNSTILE_SITE_KEY: string;
    TURNSTILE_SECRET_KEY: string;
    RATE_LIMIT_HMAC_SECRET: string;
  };
}
