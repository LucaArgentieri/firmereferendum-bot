export type EventType = "created" | "updated" | "removed";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface NormalizedItem {
  id: string;
  title: string;
  category: string;
  type: string;
  status: string;
  committee: string;
  signaturesCount: number | null;
  quorum: number | null;
  openingDate: string | null;
  deadline: string | null;
  detailUrl: string | null;
  logoUrl: string | null;
  raw: JsonValue;
  hash: string;
}

export interface Change {
  field: string;
  before: JsonValue;
  after: JsonValue;
}

export interface FeedEvent {
  id: string;
  type: EventType;
  itemId: string;
  title: string;
  changes: Change[];
  createdAt: string;
  item: NormalizedItem;
}
