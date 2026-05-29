import { mkdir, writeFile } from "node:fs/promises";
import type { FeedEvent } from "./types.js";

const FEED_XML_PATH = "public/feed.xml";
const FEED_JSON_PATH = "public/feed.json";

export async function writeFeeds(events: FeedEvent[], publicBaseUrl: string): Promise<void> {
  const latest = events
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);

  await mkdir("public", { recursive: true });
  await Promise.all([
    writeFile(FEED_XML_PATH, buildRss(latest, publicBaseUrl), "utf8"),
    writeFile(FEED_JSON_PATH, `${JSON.stringify(buildJsonFeed(latest, publicBaseUrl), null, 2)}\n`, "utf8")
  ]);
}

function buildRss(events: FeedEvent[], publicBaseUrl: string): string {
  const feedUrl = absoluteUrl(publicBaseUrl, "/feed.xml");
  const homeUrl = publicBaseUrl || "";
  const items = events.map((event) => `    <item>
      <title>${escapeXml(itemTitle(event))}</title>
      <guid isPermaLink="false">${escapeXml(event.id)}</guid>
      <pubDate>${escapeXml(new Date(event.createdAt).toUTCString())}</pubDate>
      <description>${escapeXml(itemDescription(event))}</description>
      ${event.item.detailUrl ? `<link>${escapeXml(event.item.detailUrl)}</link>` : ""}
    </item>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Referendum Feed</title>
    <link>${escapeXml(homeUrl)}</link>
    <description>Novita dalle iniziative referendum</description>
    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

function buildJsonFeed(events: FeedEvent[], publicBaseUrl: string): Record<string, unknown> {
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: "Referendum Feed",
    home_page_url: publicBaseUrl,
    feed_url: absoluteUrl(publicBaseUrl, "/feed.json"),
    items: events.map((event) => ({
      id: event.id,
      url: event.item.detailUrl || absoluteUrl(publicBaseUrl, `/events/${event.id}`),
      title: itemTitle(event),
      content_text: itemDescription(event),
      date_published: event.createdAt,
      external_url: event.item.detailUrl,
      _referendum: event
    }))
  };
}

function itemTitle(event: FeedEvent): string {
  const prefix = event.type === "created" ? "Nuova" : event.type === "updated" ? "Aggiornata" : "Rimossa";
  return `${prefix}: ${event.title}`;
}

function itemDescription(event: FeedEvent): string {
  if (event.type === "created") {
    return `Nuova iniziativa pubblicata: ${event.title}`;
  }
  if (event.type === "removed") {
    return `Iniziativa non piu presente nel feed: ${event.title}. Ultimo stato noto: ${event.item.status || "n/d"}`;
  }
  const changes = event.changes.length > 0
    ? event.changes.map((change) => `${change.field}: ${formatValue(change.before)} -> ${formatValue(change.after)}`).join("; ")
    : "Dettagli tecnici aggiornati";
  return `Iniziativa aggiornata: ${event.title}. Modifiche: ${changes}`;
}

function formatValue(value: unknown): string {
  if (value === null || typeof value === "undefined" || value === "") return "n/d";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function absoluteUrl(baseUrl: string, path: string): string {
  if (!baseUrl) return "";
  return `${baseUrl}${path}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
