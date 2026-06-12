import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { FeedEvent, NormalizedItem } from "./types.js";

const LATEST_PATH = "data/latest.json";
const LATEST_HASH_PATH = "data/latest.hash";
const EVENTS_PATH = "data/events.json";

export async function readLatestSnapshot(): Promise<NormalizedItem[]> {
  return readJsonFile<NormalizedItem[]>(LATEST_PATH, []);
}

export async function writeLatestSnapshot(items: NormalizedItem[]): Promise<void> {
  await writeJsonFile(LATEST_PATH, items);
}

export async function readLatestHash(): Promise<string> {
  try {
    return (await readFile(LATEST_HASH_PATH, "utf8")).trim();
  } catch {
    return "";
  }
}

export async function writeLatestHash(hash: string): Promise<void> {
  await writeTextFile(LATEST_HASH_PATH, `${hash}\n`);
}

export async function readEvents(): Promise<FeedEvent[]> {
  return readJsonFile<FeedEvent[]>(EVENTS_PATH, []);
}

export async function writeEvents(events: FeedEvent[]): Promise<void> {
  await writeJsonFile(EVENTS_PATH, events);
}

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch {
    return fallback;
  }
  if (!content.trim()) return fallback;
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`Failed to parse ${path}, returning empty fallback: ${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeTextFile(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, value, "utf8");
  await rename(tempPath, path);
}
