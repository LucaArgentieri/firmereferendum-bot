import { getConfig } from "./config.js";
import { diffSnapshots, mergeEvents } from "./diff.js";
import { loadEnvFile } from "./env.js";
import { fetchSource, SourceFetchError } from "./fetch-source.js";
import { hashValue } from "./hash.js";
import { normalizePayload } from "./normalize.js";
import {
  readEvents,
  readLatestHash,
  readLatestSnapshot,
  writeEvents,
  writeLatestHash,
  writeLatestSnapshot
} from "./storage.js";
import { sendTelegramEvents } from "./telegram.js";

async function main(): Promise<void> {
  await loadEnvFile();

  const config = getConfig();
  const [previousSnapshot, previousHash, existingEvents] = await Promise.all([
    readLatestSnapshot(),
    readLatestHash(),
    readEvents()
  ]);

  let payload: unknown;
  try {
    payload = await fetchSource(config.sourceUrl, config.fetchTimeoutMs);
  } catch (error) {
    if (error instanceof SourceFetchError && error.retryable) {
      console.warn(`${error.message}. Keeping existing snapshot.`);
      return;
    }
    throw error;
  }

  const currentSnapshot = normalizePayload(payload);
  if (currentSnapshot.length === 0) {
    console.warn("Source payload did not contain recognizable initiatives. Keeping existing snapshot.");
    return;
  }

  const currentHash = hashValue(currentSnapshot);
  const isFirstRun = previousSnapshot.length === 0 || !previousHash;

  if (config.baselineOnly) {
    console.log(`Baseline-only mode enabled. Saving snapshot with ${currentSnapshot.length} items without events or Telegram notifications.`);
    await Promise.all([
      writeLatestSnapshot(currentSnapshot),
      writeLatestHash(currentHash)
    ]);
    return;
  }

  if (previousHash === currentHash) {
    console.log("Snapshot unchanged. No update needed.");
    return;
  }

  if (isFirstRun) {
    console.log(`First run detected. Saving initial snapshot with ${currentSnapshot.length} items.`);
    const initialEvents = config.sendInitialEvents
      ? filterTelegramEvents(diffSnapshots([], currentSnapshot, existingEvents), config.telegramEventTypes)
      : [];
    const mergedEvents = mergeEvents(existingEvents, initialEvents);

    await Promise.all([
      writeLatestSnapshot(currentSnapshot),
      writeLatestHash(currentHash),
      writeEvents(mergedEvents)
    ]);

    if (initialEvents.length > 0) {
      await sendTelegramEvents(initialEvents, config);
    } else {
      console.log("Initial Telegram notifications disabled.");
    }
    return;
  }

  const newEvents = diffSnapshots(previousSnapshot, currentSnapshot, existingEvents);
  const telegramEvents = filterTelegramEvents(newEvents, config.telegramEventTypes);
  const mergedEvents = mergeEvents(existingEvents, telegramEvents);

  await Promise.all([
    writeLatestSnapshot(currentSnapshot),
    writeLatestHash(currentHash),
    writeEvents(mergedEvents)
  ]);

  console.log(`Snapshot changed. Detected events: ${newEvents.length}. Telegram events: ${telegramEvents.length}.`);
  await sendTelegramEvents(telegramEvents, config);
}

function filterTelegramEvents<T extends { type: string }>(events: T[], allowedTypes: string[]): T[] {
  return events.filter((event) => allowedTypes.includes(event.type));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
