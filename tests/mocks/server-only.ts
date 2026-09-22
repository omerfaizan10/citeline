// Stub for the `server-only` package used by lib/*.ts. The real package
// unconditionally throws, relying on Next.js's bundler to strip it out of
// server code paths at build time -- Vitest has no such step, so tests
// alias "server-only" to this no-op instead (see vitest.config.ts).
export {};
