import { getConfig } from "./config.js";
import { diffSnapshots, mergeEvents } from "./diff.js";
import { loadEnvFile } from "./env.js";
import { fetchSource, SourceFetchError } from "./fetch-source.js";
import { hashValue } from "./hash.js";
import { normalizePayload } from "./normalize.js";
import { writeFeeds } from "./rss.js";
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
      await writeFeeds(existingEvents, config.publicBaseUrl);
      return;
    }
    throw error;
  }

  const currentSnapshot = normalizePayload(payload);
  if (currentSnapshot.length === 0) {
    console.warn("Source payload did not contain recognizable initiatives. Keeping existing snapshot.");
    await writeFeeds(existingEvents, config.publicBaseUrl);
    return;
  }

  const currentHash = hashValue(currentSnapshot);
  const isFirstRun = previousSnapshot.length === 0 || !previousHash;

  if (previousHash === currentHash) {
    console.log("Snapshot unchanged. No update needed.");
    await writeFeeds(existingEvents, config.publicBaseUrl);
    return;
  }

  if (isFirstRun) {
    console.log(`First run detected. Saving initial snapshot with ${currentSnapshot.length} items.`);
    const initialEvents = config.sendInitialEvents
      ? diffSnapshots([], currentSnapshot, existingEvents)
      : [];
    const mergedEvents = mergeEvents(existingEvents, initialEvents);

    await Promise.all([
      writeLatestSnapshot(currentSnapshot),
      writeLatestHash(currentHash),
      writeEvents(mergedEvents),
      writeFeeds(mergedEvents, config.publicBaseUrl)
    ]);

    if (initialEvents.length > 0) {
      await sendTelegramEvents(initialEvents, config);
    } else {
      console.log("Initial Telegram notifications disabled.");
    }
    return;
  }

  const newEvents = diffSnapshots(previousSnapshot, currentSnapshot, existingEvents);
  const mergedEvents = mergeEvents(existingEvents, newEvents);

  await Promise.all([
    writeLatestSnapshot(currentSnapshot),
    writeLatestHash(currentHash),
    writeEvents(mergedEvents),
    writeFeeds(mergedEvents, config.publicBaseUrl)
  ]);

  console.log(`Snapshot changed. New events: ${newEvents.length}.`);
  await sendTelegramEvents(newEvents, config);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
