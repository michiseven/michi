import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateTrip } from "@/lib/api";
import { captureMichiEvent } from "@/lib/telemetry";
import { testTrip } from "@/test/fixtures";
import HomePage from "./page";

vi.mock("@/lib/api", () => ({
  demoMode: false,
  generateTrip: vi.fn(),
  patchTripStops: vi.fn(),
}));

vi.mock("@/lib/telemetry", () => ({
  captureMichiEvent: vi.fn(),
}));

describe("trip planner flow", () => {
  beforeEach(() => {
    vi.mocked(generateTrip).mockReset();
    vi.mocked(captureMichiEvent).mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("sends explicit constraints and renders an explainable trip", async () => {
    vi.mocked(generateTrip).mockResolvedValue(testTrip);
    const user = userEvent.setup();
    render(<HomePage />);

    await user.type(screen.getByLabelText(/どんな一日にしたいですか/), "静かなカフェとショップを一人で巡りたいです。");
    await user.click(screen.getByRole("button", { name: "旅程を作る" }));

    await waitFor(() => expect(generateTrip).toHaveBeenCalledWith(expect.objectContaining({
      text: "静かなカフェとショップを一人で巡りたいです。",
      startTime: "13:00",
      endTime: "21:00",
      budget: 80000,
      startArea: "聖水",
    })));
    expect(await screen.findByRole("heading", { name: "聖水の静かな午後" })).toBeInTheDocument();
    expect(screen.getAllByText("テストカフェ").length).toBeGreaterThan(0);
    expect(screen.getByText(/特定店舗の店内混雑度ではありません/)).toBeInTheDocument();
    expect(screen.getByText("AI解析: MOCK")).toBeInTheDocument();
    expect(screen.getAllByText("なぜここがおすすめ？ スコア内訳")).toHaveLength(2);
    expect(captureMichiEvent).toHaveBeenCalledWith("trip_requested", {
      context: { hasDate: false, hasTimeWindow: true, hasBudget: true, hasStartArea: true },
    });
    expect(captureMichiEvent).toHaveBeenCalledWith("trip_generated", {
      tripId: "trip-test-1",
      context: { stopCount: 2, usesMockProvider: true },
    });
  });

  it("keeps the input and shows an API failure", async () => {
    vi.mocked(generateTrip).mockRejectedValue(new Error("バックエンドに接続できません。"));
    const user = userEvent.setup();
    render(<HomePage />);
    const input = screen.getByLabelText(/どんな一日にしたいですか/);
    await user.type(input, "静かな場所だけをゆっくり歩きたいです。");
    await user.click(screen.getByRole("button", { name: "旅程を作る" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("バックエンドに接続できません。");
    expect(input).toHaveValue("静かな場所だけをゆっくり歩きたいです。");
  });

  it("associates a time-window error with the time inputs", async () => {
    const user = userEvent.setup();
    render(<HomePage />);
    const request = screen.getByLabelText(/どんな一日にしたいですか/);
    const endTime = screen.getByLabelText("終了時刻");

    await user.type(request, "静かなカフェを一人でゆっくり巡りたいです。");
    await user.clear(endTime);
    await user.type(endTime, "12:00");
    await user.click(screen.getByRole("button", { name: "旅程を作る" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("終了時刻は開始時刻より後にしてください。");
    expect(endTime).toHaveAttribute("aria-invalid", "true");
    expect(endTime).toHaveAttribute("aria-describedby", "time-window-error");
    expect(request).toHaveAttribute("aria-invalid", "false");
    expect(generateTrip).not.toHaveBeenCalled();
  });
});
