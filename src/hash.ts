import { createHash } from "node:crypto";
import type { JsonValue } from "./types.js";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function hashValue(value: unknown): string {
  return sha256(stableStringify(value));
}

function sortValue(value: unknown): JsonValue {
  if (value === null) return null;

  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, JsonValue> = {};

    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      if (typeof item !== "undefined" && typeof item !== "function") {
        sorted[key] = sortValue(item);
      }
    }

    return sorted;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return null;
}
