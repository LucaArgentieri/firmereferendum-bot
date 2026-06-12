import type { Config } from "./config.js";
import type { Change, FeedEvent, JsonValue } from "./types.js";
import type { NormalizedItem } from "./types.js";

const MAX_MESSAGE_LENGTH = 3800;
const MAX_PHOTO_CAPTION_LENGTH = 1000;

export async function sendTelegramEvents(events: FeedEvent[], config: Config): Promise<void> {
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.log("Telegram secrets missing, skipping notifications.");
    return;
  }

  for (const event of events) {
    try {
      await sendTelegramEvent(event, config);
      console.log(`Telegram notification sent for event ${event.id}`);
    } catch (error) {
      console.error(`Telegram notification failed for event ${event.id}: ${errorMessage(error)}`);
    }
  }
}

export function buildPreviewEvent(item: NormalizedItem): FeedEvent {
  return {
    id: `preview-${item.id}`,
    type: "created",
    itemId: item.id,
    title: item.title,
    changes: [],
    createdAt: new Date().toISOString(),
    item
  };
}

export function formatEventMessage(event: FeedEvent, maxLength = MAX_MESSAGE_LENGTH): string {
  if (event.type === "created") {
    const link = `\n\n${linkLine(event.item.detailUrl)}`;
    const title = titleLine(event.item.title);
    const badges = badgesLine(event.item);
    const stats =
      `📅 <b>Apertura:</b> ${escapeHtml(formatDate(event.item.openingDate))}\n` +
      `👥 <b>Sostenitori:</b> ${escapeHtml(formatNumber(event.item.signaturesCount))}\n` +
      `${quorumLine(event.item)}${progressLine(event.item)}` +
      `📌 <b>Scadenza:</b> ${escapeHtml(formatDate(event.item.deadline))}`;
    const fixedContent = `${title}\n\n\n\n${badges}\n\n${stats}${link}`;
    const availableForDesc = Math.max(50, maxLength - fixedContent.length);
    const desc = descriptionLine(event.item, availableForDesc);
    return `${title}\n\n${desc}\n\n${badges}\n\n${stats}${link}`;
  }

  if (event.type === "updated") {
    const link = `\n\n${linkLine(event.item.detailUrl)}`;
    return truncateHtml(`<b>Iniziativa aggiornata</b>

${titleLine(event.item.title)}

<b>Modifiche:</b>
${formatChanges(event.changes)}`, maxLength, link);
  }

  return truncateHtml(`<b>Iniziativa non più presente nel feed</b>

${titleLine(event.item.title)}
<b>Ultimo stato noto:</b> ${escapeHtml(fallback(event.item.status))}`, maxLength);
}

function formatChanges(changes: Change[]): string {
  if (changes.length === 0) return "- Dettagli tecnici aggiornati";
  return changes
    .map((change) => `- <b>${escapeHtml(fieldLabel(change.field))}:</b> ${escapeHtml(formatValue(change.before))} -> ${escapeHtml(formatValue(change.after))}`)
    .join("\n");
}

async function sendTelegramMessage(text: string, config: Config): Promise<void> {
  const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`);
  }
}

async function sendTelegramEvent(event: FeedEvent, config: Config): Promise<void> {
  const text = formatEventMessage(event);
  if (!event.item.logoUrl) {
    await sendTelegramMessage(text, config);
    return;
  }

  try {
    await sendTelegramPhoto(event.item.logoUrl, formatEventMessage(event, MAX_PHOTO_CAPTION_LENGTH), config);
  } catch (error) {
    console.warn(`Telegram photo failed for event ${event.id}, falling back to text: ${errorMessage(error)}`);
    await sendTelegramMessage(text, config);
  }
}

async function sendTelegramPhoto(photoUrl: string, caption: string, config: Config): Promise<void> {
  const photo = await fetchTelegramPhoto(photoUrl);
  const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendPhoto`;
  const form = new FormData();
  form.set("chat_id", config.telegramChatId ?? "");
  form.set("photo", photo.blob, photo.filename);
  form.set("caption", caption);
  form.set("parse_mode", "HTML");

  const response = await fetch(url, {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`);
  }
}

async function fetchTelegramPhoto(photoUrl: string): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(photoUrl, {
    headers: {
      Accept: "image/*,*/*;q=0.8",
      "User-Agent": "referendum-feed-bot/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Logo fetch HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const arrayBuffer = await response.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: contentType });
  return { blob, filename: `referendum-logo.${extensionFromContentType(contentType)}` };
}

function extensionFromContentType(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    title: "Titolo",
    type: "Tipo",
    status: "Stato",
    committee: "Comitato",
    signaturesCount: "Firme",
    quorum: "Quorum",
    openingDate: "Apertura",
    deadline: "Scadenza",
    detailUrl: "Link",
    logoUrl: "Logo"
  };
  return labels[field] ?? field;
}

function fallback(value: JsonValue | undefined): string {
  const formatted = formatValue(value ?? null);
  return formatted || "n/d";
}

function titleLine(title: string): string {
  return `<b>${escapeHtml(title.toUpperCase())}</b>`;
}

function descriptionLine(item: NormalizedItem, maxLength = 520): string {
  const raw = item.raw;
  const description = isRecord(raw)
    ? formatValue((raw.descrizioneBreve ?? raw.descrizione ?? "") as JsonValue)
    : "";
  return escapeHtml(shorten(description, maxLength));
}

function badgesLine(item: NormalizedItem): string {
  const category = item.category ? `🏷️ <b>${escapeHtml(item.category)}</b>` : "";
  const status = item.status ? `🕒 <b>${escapeHtml(item.status)}</b>` : "";
  const type = item.type && !category ? `🏷️ <b>${escapeHtml(item.type)}</b>` : "";
  return [category || type, status].filter(Boolean).join("\n");
}

function quorumLine(item: NormalizedItem): string {
  if (item.quorum === null) return "";
  return `🎯 <b>Quorum:</b> ${escapeHtml(formatNumber(item.quorum))}\n`;
}

function progressLine(item: NormalizedItem): string {
  if (item.signaturesCount === null || item.quorum === null || item.quorum <= 0) return "";
  const percent = Math.min(100, Math.floor((item.signaturesCount / item.quorum) * 100));
  return `📊 <b>Avanzamento:</b> ${percent}%\n`;
}

function linkLine(url: string | null): string {
  if (!url) return "<b>Link:</b> n/d";
  return `<a href="${escapeHtml(url)}">Apri iniziativa</a>`;
}

function formatNumber(value: number | null): string {
  if (value === null) return "n/d";
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDate(value: string | null): string {
  if (!value) return "n/d";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function formatValue(value: JsonValue): string {
  if (value === null) return "n/d";
  if (typeof value === "string") return value.trim() || "n/d";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function truncateHtml(value: string, maxLength = MAX_MESSAGE_LENGTH, pinnedSuffix = ''): string {
  const total = value + pinnedSuffix;
  if (total.length <= maxLength) return total;
  const available = maxLength - pinnedSuffix.length - 20;
  return `${value.slice(0, available)}\n...[testo abbreviato]${pinnedSuffix}`;
}

function shorten(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3).trim()}...`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
