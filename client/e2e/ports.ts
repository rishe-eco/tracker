import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The one place the e2e ports and URLs are read. playwright.config.ts,
 * globalSetup.ts and helpers/api.ts all import from here, so they can't drift.
 * Defaults are distinct from the dev servers' ports.
 */
/** The dev servers' ports: with E2E_REUSE=1 an e2e run on them would sign up users in the dev database. */
const DEV_PORTS = [4000, 5173];

function readPort(name: string, fallback: number): number {
  const raw = (process.env[name] ?? String(fallback)).trim();
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || port < 1 || port > 65535) {
    throw new Error(`e2e refuses to run: ${name}="${raw}" is not a port (1-65535)`);
  }
  if (DEV_PORTS.includes(port)) {
    throw new Error(`e2e refuses to run: ${name}=${port} is a dev server's port`);
  }
  return port;
}

export const API_PORT = readPort("E2E_API_PORT", 4010);
export const WEB_PORT = readPort("E2E_WEB_PORT", 5183);
if (API_PORT === WEB_PORT) {
  throw new Error(`e2e refuses to run: E2E_API_PORT and E2E_WEB_PORT are both ${API_PORT}`);
}

export const API_URL = `http://localhost:${API_PORT}/graphql`;
export const API_HEALTH_URL = `http://localhost:${API_PORT}/.well-known/apollo/server-health`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;

/**
 * Per-slot credentials file: two slots in one checkout would otherwise
 * overwrite each other's token, and a token only means something in the
 * database of the API that issued it.
 */
export const AUTH_FILE = path.join(__dirname, ".auth", `e2e-user.${API_PORT}.json`);
