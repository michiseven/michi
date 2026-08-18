import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogFriendsClient } from "@michi/log-friends-sdk";

vi.mock("@michi/log-friends-sdk", () => ({
  LogFriendsClient: vi.fn(),
}));

describe("Michi telemetry adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(LogFriendsClient).mockReset();
    window.sessionStorage.clear();
  });

  it("uses one anonymous session and keeps request text out of the event", async () => {
    const identify = vi.fn();
    const track = vi.fn().mockReturnValue(true);
    const flush = vi.fn().mockResolvedValue({ status: "disabled", sent: 0, pending: 1 });
    vi.mocked(LogFriendsClient).mockImplementation(function MockClient() {
      return { identify, track, flush } as unknown as LogFriendsClient;
    });
    const { captureMichiEvent } = await import("./telemetry");

    captureMichiEvent("trip_requested", {
      context: { hasDate: true, hasBudget: true },
    });
    await Promise.resolve();

    expect(identify).toHaveBeenCalledOnce();
    expect(identify).toHaveBeenCalledWith({ sessionId: expect.stringMatching(/^anon-/u) });
    expect(track).toHaveBeenCalledWith("trip_requested", {
      context: { hasDate: true, hasBudget: true },
    });
    expect(JSON.stringify(track.mock.calls)).not.toContain("requestText");
    expect(flush).toHaveBeenCalledOnce();
  });

  it("swallows SDK initialization failures so the UI can continue", async () => {
    vi.mocked(LogFriendsClient).mockImplementation(() => {
      throw new Error("invalid endpoint");
    });
    const { captureMichiEvent } = await import("./telemetry");

    expect(() => captureMichiEvent("route_started", { tripId: "trip-1" })).not.toThrow();
  });
});
