import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";

function clientId() { return process.env["GOOGLE_CLIENT_ID"] ?? ""; }
function clientSecret() { return process.env["GOOGLE_CLIENT_SECRET"] ?? ""; }

export function getRedirectUri(): string {
  return (
    process.env["GOOGLE_REDIRECT_URI"] ??
    `http://localhost:${process.env["PORT"] ?? 8080}/oauth2callback`
  );
}

export function getAuthorizationUrl(): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/gmail.send",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value, updated_at: new Date() },
    });
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    error?: string;
  };
  if (data.error) throw new Error(`OAuth error: ${data.error}`);
  await setSetting("google_access_token", data.access_token);
  await setSetting(
    "google_token_expiry",
    new Date(Date.now() + data.expires_in * 1000).toISOString()
  );
  if (data.refresh_token) {
    await setSetting("google_refresh_token", data.refresh_token);
  }
}

export async function isGoogleAuthorized(): Promise<boolean> {
  const token = await getSetting("google_refresh_token");
  return !!token;
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await getSetting("google_refresh_token");
  if (!refreshToken) {
    throw new Error("Google no autorizado. Visita /api/auth/google para autorizar.");
  }
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    error?: string;
  };
  if (data.error) throw new Error(`Token refresh error: ${data.error}`);
  await setSetting("google_access_token", data.access_token);
  await setSetting(
    "google_token_expiry",
    new Date(Date.now() + data.expires_in * 1000).toISOString()
  );
  return data.access_token;
}

export async function getValidAccessToken(): Promise<string> {
  const expiry = await getSetting("google_token_expiry");
  const accessToken = await getSetting("google_access_token");
  const stillValid =
    accessToken && expiry && new Date(expiry) > new Date(Date.now() + 60_000);
  if (stillValid) return accessToken!;
  return refreshAccessToken();
}

export async function googleFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getValidAccessToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export { CALENDAR_BASE, GMAIL_BASE };
