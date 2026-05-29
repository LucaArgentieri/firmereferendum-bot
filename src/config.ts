import type { EventType } from "./types.js";

export interface Config {
  sourceUrl: string;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  telegramEventTypes: EventType[];
  sendInitialEvents: boolean;
  baselineOnly: boolean;
  fetchTimeoutMs: number;
}

const EVENT_TYPES = new Set<EventType>(["created", "updated", "removed"]);

const DEFAULT_SOURCE_URL = "https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public";

export function getConfig(): Config {
  return {
    sourceUrl: process.env.SOURCE_URL?.trim() || DEFAULT_SOURCE_URL,
    telegramBotToken: emptyToNull(process.env.TELEGRAM_BOT_TOKEN),
    telegramChatId: emptyToNull(process.env.TELEGRAM_CHAT_ID),
    telegramEventTypes: parseTelegramEventTypes(process.env.TELEGRAM_EVENT_TYPES),
    sendInitialEvents: parseBoolean(process.env.SEND_INITIAL_EVENTS, false),
    baselineOnly: parseBoolean(process.env.BASELINE_ONLY, false),
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

function parseTelegramEventTypes(value: string | undefined): EventType[] {
  if (!value?.trim()) return ["created"];

  const eventTypes = value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is EventType => EVENT_TYPES.has(item as EventType));

  return eventTypes.length > 0 ? eventTypes : ["created"];
}
