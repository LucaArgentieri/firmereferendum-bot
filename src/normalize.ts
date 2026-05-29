import { hashValue } from "./hash.js";
import type { JsonValue, NormalizedItem } from "./types.js";

const VOLATILE_KEYS = new Set([
  "requestId",
  "traceId",
  "timestamp",
  "serverTime",
  "generatedAt",
  "fetchedAt"
]);

const OFFICIAL_DETAIL_BASE_URL = "https://firmereferendum.giustizia.it/referendum/open/dettaglio-open";
const OFFICIAL_LOGO_BASE_URL = "https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public/logo";

export function normalizePayload(payload: unknown): NormalizedItem[] {
  const records = extractRecords(payload);

  const items = records.map((record, index) => normalizeRecord(record, index));
  items.sort((a, b) => (a.id || a.title).localeCompare(b.id || b.title, "it"));

  return items;
}

function extractRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];

  for (const key of ["content", "items", "data", "results", "iniziative", "list", "records"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }

  return looksLikeInitiative(payload) ? [payload] : [];
}

function normalizeRecord(record: Record<string, unknown>, index: number): NormalizedItem {
  const raw = sanitizeRaw(record);
  const sourceId = toStringValue(pick(record, ["id", "idIniziativa", "iniziativaId", "codice", "slug", "uuid"]));
  const id = sourceId || hashValue(raw).slice(0, 16);
  const title = toStringValue(pick(record, ["title", "titolo", "oggetto", "denominazione", "nome", "descrizione"]))
    || `Iniziativa ${id || index + 1}`;
  const category = toStringValue(pick(record, ["category", "categoria", "idDecCatIniziativa"])) || "";
  const type = toStringValue(pick(record, ["type", "tipo", "tipologia", "tipoIniziativa", "idDecTipoIniziativa", "categoria"])) || "";
  const status = toStringValue(pick(record, ["status", "stato", "statoIniziativa", "idDecStatoIniziativa", "fase", "situazione"])) || "";
  const committee = toStringValue(pick(record, ["committee", "comitato", "idComitato", "promotore", "promotori", "soggettoPromotore", "denominazioneComitato"])) || "";
  const signaturesCount = toNumberValue(pick(record, ["signaturesCount", "firme", "numeroFirme", "numFirme", "firmeRaccolte", "sottoscrizioni", "sostenitori"]));
  const quorum = toNumberValue(pick(record, ["quorum", "numeroQuorum", "soglia", "sogliaFirme"]));
  const openingDate = toStringValue(pick(record, ["openingDate", "dataApertura", "dataInizioRaccolta", "dataInizio"])) || null;
  const deadline = toStringValue(pick(record, ["deadline", "scadenza", "dataScadenza", "termine", "dataFineRaccolta"])) || null;
  const detailUrl = buildOfficialDetailUrl(sourceId)
    || normalizeUrl(toStringValue(pick(record, ["detailUrl", "url", "link", "dettaglioUrl", "urlDettaglio", "sito"])))
    || null;
  const logoUrl = buildOfficialLogoUrl(sourceId) || null;

  const itemWithoutHash = {
    id,
    title,
    category,
    type,
    status,
    committee,
    signaturesCount,
    quorum,
    openingDate,
    deadline,
    detailUrl,
    logoUrl,
    raw
  } satisfies Omit<NormalizedItem, "hash">;

  return {
    ...itemWithoutHash,
    hash: hashValue(itemWithoutHash)
  };
}

function sanitizeRaw(value: unknown): JsonValue {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((item) => sanitizeRaw(item));
  if (isRecord(value)) {
    const sanitized: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
      if (!VOLATILE_KEYS.has(key) && typeof item !== "undefined" && typeof item !== "function") {
        sanitized[key] = sanitizeRaw(item);
      }
    }
    return sanitized;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return null;
}

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== null && typeof record[key] !== "undefined") return record[key];
  }
  return undefined;
}

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(toStringValue).filter(Boolean).join(", ");
  if (isRecord(value)) {
    return toStringValue(pick(value, ["label", "name", "nome", "descrizione", "denominazione", "value"]));
  }
  return "";
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeUrl(value: string): string {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (/^www\./i.test(value)) return `https://${value}`;
  return value;
}

function buildOfficialDetailUrl(id: string): string {
  if (!id) return "";
  return `${OFFICIAL_DETAIL_BASE_URL}/${encodeURIComponent(id)}`;
}

function buildOfficialLogoUrl(id: string): string {
  if (!id) return "";
  return `${OFFICIAL_LOGO_BASE_URL}/${encodeURIComponent(id)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function looksLikeInitiative(record: Record<string, unknown>): boolean {
  return [
    "id",
    "idIniziativa",
    "iniziativaId",
    "titolo",
    "title",
    "dataFineRaccolta",
    "idDecTipoIniziativa",
    "idDecStatoIniziativa"
  ].some((key) => typeof record[key] !== "undefined");
}
