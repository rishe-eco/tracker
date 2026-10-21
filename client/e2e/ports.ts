import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The one place the e2e ports and URLs are read. playwright.config.ts,
 * globalSetup.ts and helpers/api.ts all import from here, so they can't drift.
 * Defaults are distinct from the dev servers' ports.
 */
export const API_PORT = Number(process.env.E2E_API_PORT ?? 4010);
export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5183);

export const API_URL = `http://localhost:${API_PORT}/graphql`;
export const API_HEALTH_URL = `http://localhost:${API_PORT}/.well-known/apollo/server-health`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;

/**
 * Per-slot credentials file: two slots in one checkout would otherwise
 * overwrite each other's token, and a token only means something in the
 * database of the API that issued it.
 */
export const AUTH_FILE = path.join(__dirname, ".auth", `e2e-user.${API_PORT}.json`);
