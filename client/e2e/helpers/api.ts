import type { APIRequestContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = "http://localhost:4000/graphql";
const AUTH_FILE = path.join(__dirname, "..", ".auth", "e2e-user.json");

let _cachedToken: string | null = null;

function getToken(): string {
  if (!_cachedToken) {
    const auth = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
    _cachedToken = auth.token;
  }
  return _cachedToken!;
}

export function getAuthData(): { email: string; password: string; token: string; friendEmail: string } {
  return JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
}

export async function gql(request: APIRequestContext, query: string, variables?: Record<string, any>): Promise<any> {
  const res = await request.post(API_URL, {
    data: JSON.stringify({ query, variables }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}
