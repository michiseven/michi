import {
  LogFriendsClient,
  type EventFields,
  type LogFriendsClientOptions,
  type MichiEventName,
} from "@michi/log-friends-sdk";

const sessionStorageKey = "michi.anonymousSessionId";
let client: LogFriendsClient | undefined;
let inMemorySessionId: string | undefined;
let flushScheduled = false;

function createAnonymousSessionId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `anon-${globalThis.crypto.randomUUID()}`;
  }
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const values = new Uint32Array(4);
    globalThis.crypto.getRandomValues(values);
    return `anon-${Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("")}`;
  }
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getAnonymousSessionId(): string {
  if (inMemorySessionId) return inMemorySessionId;
  if (typeof window !== "undefined") {
    try {
      const existing = window.sessionStorage.getItem(sessionStorageKey);
      if (existing) {
        inMemorySessionId = existing;
        return existing;
      }
      const created = createAnonymousSessionId();
      window.sessionStorage.setItem(sessionStorageKey, created);
      inMemorySessionId = created;
      return created;
    } catch {
      // Storage can be disabled. The anonymous ID remains memory-only in that case.
    }
  }
  inMemorySessionId = createAnonymousSessionId();
  return inMemorySessionId;
}

function getClient(): LogFriendsClient {
  if (client) return client;
  const endpoint = process.env.NEXT_PUBLIC_LOG_FRIENDS_ENDPOINT?.trim();
  const options: LogFriendsClientOptions = { maxQueueSize: 200, batchSize: 20 };
  if (endpoint) options.endpoint = endpoint;
  client = new LogFriendsClient(options);
  client.identify({ sessionId: getAnonymousSessionId() });
  return client;
}

function scheduleFlush(activeClient: LogFriendsClient): void {
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(() => {
    flushScheduled = false;
    void activeClient.flush().catch(() => undefined);
  });
}

/**
 * Records only explicitly supplied, typed product events. Telemetry failures are isolated from the UI.
 */
export function captureMichiEvent(eventName: MichiEventName, fields: EventFields = {}): void {
  try {
    const activeClient = getClient();
    if (activeClient.track(eventName, fields)) scheduleFlush(activeClient);
  } catch {
    // Analytics must never interrupt planning or route editing.
  }
}
