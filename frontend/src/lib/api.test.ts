import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, generateTrip } from "./api";

const wireTrip = {
  id: "2ef5a31f-d533-46b1-aa5d-e8a4d76b7759",
  status: "ready",
  date: "2026-08-19",
  startTime: "13:00",
  endTime: "21:00",
  budget: 80000,
  estimatedTotalCost: null,
  appliedWeights: {
    preference: 0.3,
    crowd: 0.3,
    distance: 0.13,
    time: 0.13,
    budget: 0.09,
    diversity: 0.05,
    area: 0,
  },
  preference: {
    area: "성수",
    startTime: "13:00",
    endTime: "21:00",
    budget: 80000,
    companions: "solo",
    pace: "relaxed",
    interests: ["cafe"],
    preferences: ["quiet"],
    avoid: ["crowded"],
  },
  stops: [
    {
      id: "cb9bf43d-b83c-4e26-9ca8-d0ddc3040513",
      order: 1,
      placeId: "f3bc9c30-fbf1-432d-b617-2fffb2a57e97",
      placeName: "[MOCK] 静かなカフェ",
      category: "cafe",
      address: "서울특별시 성동구 서울숲길 1",
      latitude: 37.5467,
      longitude: 127.0436,
      imageUrl: null,
      arrivalAt: "13:00",
      leaveAt: "14:00",
      estimatedStayMinutes: 60,
      estimatedCost: null,
      reason: "希望したカテゴリに合っています。",
      crowd: {
        level: "MOCK_NORMAL",
        scope: "area",
        areaName: "성수",
        observedAt: null,
      },
      scoreBreakdown: {
        total: 0.8,
        preference: 1,
        crowd: 0.7,
        distance: 0.5,
        time: 0.5,
        budget: 0.5,
        diversity: 0.5,
        area: 0.5,
      },
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("backend trip API contract", () => {
  it("accepts the canonical trip envelope without renaming fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      trip: wireTrip,
      providerModes: { llm: "mock", place: "mock", crowd: "mock" },
      warnings: ["MOCK provider data"],
    }), { status: 201, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateTrip({ text: "静かなカフェでゆっくり過ごしたいです。" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/trips/generate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.providerModes.llm).toBe("mock");
    expect(result.appliedWeights?.crowd).toBe(0.3);
    expect(result.stops[0]).toMatchObject({
      latitude: 37.5467,
      longitude: 127.0436,
      arrivalAt: "13:00",
      leaveAt: "14:00",
      crowd: { level: "MOCK_NORMAL", scope: "area" },
    });
  });

  it("keeps the backend error code and status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "NO_FEASIBLE_ROUTE",
      message: "条件に合う旅程を作成できません。",
    }), { status: 422, headers: { "Content-Type": "application/json" } })));

    const error = await generateTrip({ text: "静かな場所に行きたいです。" }).catch((cause) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: "NO_FEASIBLE_ROUTE" });
  });
});
