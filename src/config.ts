export interface Config {
  sourceUrl: string;
  publicBaseUrl: string;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  sendInitialEvents: boolean;
  fetchTimeoutMs: number;
}

const DEFAULT_SOURCE_URL = "https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public";

export function getConfig(): Config {
  return {
    sourceUrl: process.env.SOURCE_URL?.trim() || DEFAULT_SOURCE_URL,
    publicBaseUrl: trimTrailingSlash(process.env.PUBLIC_BASE_URL?.trim() || ""),
    telegramBotToken: emptyToNull(process.env.TELEGRAM_BOT_TOKEN),
    telegramChatId: emptyToNull(process.env.TELEGRAM_CHAT_ID),
    sendInitialEvents: parseBoolean(process.env.SEND_INITIAL_EVENTS, false),
    fetchTimeoutMs: parsePositiveInt(process.env.FETCH_TIMEOUT_MS, 20_000)
  };
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (typeof value === "undefined") return fallback;
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
