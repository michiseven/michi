"use client";

import { useState } from "react";
import { EnvironmentBanner } from "@/components/environment-banner";
import { PlannerForm } from "@/components/planner-form";
import { TripView } from "@/components/trip-view";
import { generateTrip } from "@/lib/api";
import { captureMichiEvent } from "@/lib/telemetry";
import type { GenerateTripInput, Trip } from "@/lib/types";

export default function HomePage() {
  const [trip, setTrip] = useState<Trip>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(input: GenerateTripInput) {
    setLoading(true);
    setError(undefined);
    captureMichiEvent("trip_requested", {
      context: {
        hasDate: Boolean(input.travelDate),
        hasTimeWindow: Boolean(input.startTime && input.endTime),
        hasBudget: input.budget !== undefined,
        hasStartArea: Boolean(input.startArea),
      },
    });
    try {
      const result = await generateTrip(input);
      setTrip(result);
      captureMichiEvent("trip_generated", {
        tripId: result.id,
        context: {
          stopCount: result.stops.length,
          usesMockProvider: Object.values(result.providerModes).some((mode) => mode === "mock"),
        },
      });
      window.setTimeout(() => document.querySelector(".trip-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "旅程を作成できませんでした。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell" id="main-content">
      <div className="page-narrow">
        <div className="page-heading">
          <p className="eyebrow">AI ITINERARY PLANNER</p>
          <h1>あなたらしいソウルの道を。</h1>
          <p className="lede">好みと時間を言葉で伝えると、実在する場所の候補から理由のわかる旅程を組み立てます。</p>
        </div>
        <EnvironmentBanner />
        {error && <div className="status-banner error" role="alert"><strong>作成失敗</strong><span>{error}</span></div>}
        <PlannerForm loading={loading} onSubmit={handleSubmit} />
      </div>
      {loading && (
        <div className="page-narrow trip-result loading-state" role="status" aria-label="旅程を作成中">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-card" />
          <p>場所候補の確認とルート計算をしています…</p>
        </div>
      )}
      {trip && !loading && <TripView key={trip.id} initialTrip={trip} showDetailLink />}
    </main>
  );
}
