import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { patchTripStops } from "@/lib/api";
import { captureMichiEvent } from "@/lib/telemetry";
import { testTrip } from "@/test/fixtures";
import { TripView } from "./trip-view";

vi.mock("@/lib/api", () => ({
  patchTripStops: vi.fn(),
}));

vi.mock("@/lib/telemetry", () => ({
  captureMichiEvent: vi.fn(),
}));

describe("trip detail editing", () => {
  beforeEach(() => {
    vi.mocked(patchTripStops).mockReset();
    vi.mocked(captureMichiEvent).mockReset();
  });

  it("removes a stop through the backend contract", async () => {
    vi.mocked(patchTripStops).mockResolvedValue({ ...testTrip, stops: [testTrip.stops[1]] });
    const user = userEvent.setup();
    render(<TripView initialTrip={testTrip} editable />);

    await user.click(screen.getByRole("button", { name: "テストカフェを旅程から削除" }));

    expect(patchTripStops).toHaveBeenCalledWith("trip-test-1", { action: "remove", stopId: "stop-1" });
    expect(await screen.findByText("場所を削除しました。")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "テストカフェ" })).not.toBeInTheDocument();
    expect(captureMichiEvent).toHaveBeenCalledWith("place_removed", {
      tripId: "trip-test-1",
      placeId: "place-1",
      context: { previousOrder: 1 },
    });
  });

  it("sends the new stop order", async () => {
    const reordered = { ...testTrip, stops: [testTrip.stops[1], testTrip.stops[0]] };
    vi.mocked(patchTripStops).mockResolvedValue(reordered);
    const user = userEvent.setup();
    render(<TripView initialTrip={testTrip} editable />);

    await user.click(screen.getByRole("button", { name: "テストカフェを一つ後へ" }));

    expect(patchTripStops).toHaveBeenCalledWith("trip-test-1", { action: "reorder", stopIds: ["stop-2", "stop-1"] });
    expect(await screen.findByText("順番を更新しました。")).toBeInTheDocument();
    expect(captureMichiEvent).toHaveBeenCalledWith("place_reordered", {
      tripId: "trip-test-1",
      placeId: "place-1",
      context: { fromOrder: 1, toOrder: 2 },
    });
  });

  it("records score detail views and explicit route progress without content capture", async () => {
    const user = userEvent.setup();
    render(<TripView initialTrip={testTrip} editable />);

    await user.click(screen.getAllByText("なぜここがおすすめ？ スコア内訳")[0]!);
    expect(captureMichiEvent).toHaveBeenCalledWith("place_viewed", {
      tripId: "trip-test-1",
      placeId: "place-1",
    });

    await user.click(screen.getByRole("button", { name: "ルートを開始" }));
    expect(captureMichiEvent).toHaveBeenCalledWith("route_started", {
      tripId: "trip-test-1",
      context: { stopCount: 2 },
    });
    await user.click(screen.getByRole("button", { name: "ルートを完了" }));
    expect(captureMichiEvent).toHaveBeenCalledWith("route_completed", {
      tripId: "trip-test-1",
      context: { stopCount: 2 },
    });
    expect(screen.getByText("ルートを完了しました。")).toBeInTheDocument();
  });
});
