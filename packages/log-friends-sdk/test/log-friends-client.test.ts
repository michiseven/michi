import { describe, expect, it, vi } from "vitest";
import { LogFriendsClient, type BatchTransport, type LogFriendsEvent } from "../src/index.js";

describe("LogFriendsClient", () => {
  it("queues only allowlisted typed events after anonymous identification", () => {
    const client = new LogFriendsClient({ now: (): Date => new Date("2026-08-18T00:00:00.000Z") });
    expect(client.track("trip_requested")).toBe(false);

    client.identify({ sessionId: "anon-session-1" });
    expect(client.track("trip_generated", { tripId: "trip-1", context: { stopCount: 3 } })).toBe(true);
    expect(client.pendingEvents()).toEqual([
      {
        eventName: "trip_generated",
        sessionId: "anon-session-1",
        tripId: "trip-1",
        timestamp: "2026-08-18T00:00:00.000Z",
        context: { stopCount: 3 },
      },
    ]);
  });

  it("does not use the network when endpoint is absent", async () => {
    const fetchImplementation = vi.fn();
    const client = new LogFriendsClient({ fetch: fetchImplementation });
    client.identify({ sessionId: "anon-session-2" });
    client.track("route_started", { tripId: "trip-2" });

    await expect(client.flush()).resolves.toEqual({ status: "disabled", sent: 0, pending: 1 });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("keeps a failed batch queued and retries it on the next flush", async () => {
    const sent: LogFriendsEvent[][] = [];
    let attempts = 0;
    const transport: BatchTransport = {
      send(events): Promise<void> {
        attempts += 1;
        if (attempts === 1) return Promise.reject(new Error("temporary failure"));
        sent.push([...events]);
        return Promise.resolve();
      },
    };
    const client = new LogFriendsClient({ transport, batchSize: 2 });
    client.identify({ sessionId: "anon-session-3" });
    client.track("place_viewed", { tripId: "trip-3", placeId: "place-1" });
    client.track("place_removed", { tripId: "trip-3", placeId: "place-1" });

    await expect(client.flush()).resolves.toEqual({ status: "failed", sent: 0, pending: 2 });
    await expect(client.flush()).resolves.toEqual({ status: "sent", sent: 2, pending: 0 });
    expect(sent[0]?.map((event) => event.eventName)).toEqual(["place_viewed", "place_removed"]);
  });

  it("rejects sensitive or nested context instead of collecting it", () => {
    const client = new LogFriendsClient();
    client.identify({ sessionId: "anon-session-4" });

    expect(() => client.track("trip_requested", { context: { requestText: "private trip request" } })).toThrow(
      "Unsafe event context key",
    );
    expect(() =>
      client.track("trip_requested", {
        context: { safe: { nested: true } as unknown as string },
      }),
    ).toThrow("short primitive values");
  });
});
