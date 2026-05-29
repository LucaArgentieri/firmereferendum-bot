import { getConfig } from "./config.js";
import { loadEnvFile } from "./env.js";
import { fetchSource } from "./fetch-source.js";
import { normalizePayload } from "./normalize.js";
import { buildPreviewEvent, formatEventMessage, sendTelegramEvents } from "./telegram.js";

await loadEnvFile();

const config = getConfig();
const payload = await fetchSource(config.sourceUrl, config.fetchTimeoutMs);
const items = normalizePayload(payload);

if (items.length === 0) {
  throw new Error("Nessuna iniziativa riconoscibile nel payload sorgente.");
}

const previewItemId = process.env.TELEGRAM_PREVIEW_ITEM_ID?.trim();
const item = (previewItemId ? items.find((candidate) => candidate.id === previewItemId) : undefined)
  ?? items.find((candidate) => candidate.status.toLowerCase().includes("raccolta"))
  ?? items.find((candidate) => candidate.signaturesCount !== null)
  ?? items[0];

if (!item) {
  throw new Error("Nessuna iniziativa disponibile per la preview.");
}

const event = buildPreviewEvent(item);
const message = formatEventMessage(event);

console.log("--- TELEGRAM HTML PREVIEW ---");
console.log(message);
console.log("--- END PREVIEW ---");

const sendRequested = process.env.TELEGRAM_SEND_TEST?.toLowerCase() === "true" && process.argv.includes("--send");

if (sendRequested) {
  await sendTelegramEvents([event], config);
} else {
  console.log("Invio disabilitato. Per inviare davvero: TELEGRAM_SEND_TEST=true bun run telegram:preview --send");
}
