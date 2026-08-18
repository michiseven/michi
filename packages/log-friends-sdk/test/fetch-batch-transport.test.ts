import { describe, expect, it, vi } from "vitest";
import { FetchBatchTransport, type LogFriendsEvent } from "../src/index.js";

const event: LogFriendsEvent = {
  eventName: "trip_requested",
  sessionId: "anon-session",
  timestamp: "2026-08-18T00:00:00.000Z",
  context: {},
};

describe("FetchBatchTransport", () => {
  it("posts an explicit JSON batch without browser credentials", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
    const transport = new FetchBatchTransport("https://events.example.test/ingest", fetchImplementation);

    await transport.send([event]);

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://events.example.test/ingest",
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        body: JSON.stringify({ events: [event] }),
      }),
    );
  });
});
