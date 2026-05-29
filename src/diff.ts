import { hashValue, sha256, stableStringify } from "./hash.js";
import type { Change, FeedEvent, NormalizedItem } from "./types.js";

const COMPARED_FIELDS: Array<keyof NormalizedItem> = [
  "title",
  "category",
  "type",
  "status",
  "committee",
  "signaturesCount",
  "quorum",
  "openingDate",
  "deadline",
  "detailUrl",
  "logoUrl"
];

export function diffSnapshots(
  previous: NormalizedItem[],
  current: NormalizedItem[],
  existingEvents: FeedEvent[],
  createdAt = new Date().toISOString()
): FeedEvent[] {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const currentById = new Map(current.map((item) => [item.id, item]));
  const existingIds = new Set(existingEvents.map((event) => event.id));
  const events: FeedEvent[] = [];

  for (const item of current) {
    const oldItem = previousById.get(item.id);
    if (!oldItem) {
      pushUnique(events, existingIds, buildEvent("created", item, [], createdAt));
      continue;
    }

    if (oldItem.hash !== item.hash) {
      const changes = getChanges(oldItem, item);
      pushUnique(events, existingIds, buildEvent("updated", item, changes, createdAt));
    }
  }

  for (const item of previous) {
    if (!currentById.has(item.id)) {
      pushUnique(events, existingIds, buildEvent("removed", item, [], createdAt));
    }
  }

  return events;
}

export function mergeEvents(existing: FeedEvent[], incoming: FeedEvent[], limit = 500): FeedEvent[] {
  const seen = new Set<string>();
  return [...incoming, ...existing]
    .filter((event) => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

function buildEvent(type: FeedEvent["type"], item: NormalizedItem, changes: Change[], createdAt: string): FeedEvent {
  const changesHash = hashValue(changes);
  return {
    id: sha256(`${type}:${item.id}:${item.hash}:${changesHash}`),
    type,
    itemId: item.id,
    title: item.title,
    changes,
    createdAt,
    item
  };
}

function getChanges(previous: NormalizedItem, current: NormalizedItem): Change[] {
  const changes: Change[] = [];
  for (const field of COMPARED_FIELDS) {
    const before = previous[field];
    const after = current[field];
    if (stableStringify(before) !== stableStringify(after)) {
      changes.push({ field, before, after });
    }
  }
  return changes;
}

function pushUnique(events: FeedEvent[], existingIds: Set<string>, event: FeedEvent): void {
  if (existingIds.has(event.id)) return;
  existingIds.add(event.id);
  events.push(event);
}
