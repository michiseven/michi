"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EnvironmentBanner } from "@/components/environment-banner";
import { TripView } from "@/components/trip-view";
import { getTrip } from "@/lib/api";
import type { Trip } from "@/lib/types";

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    getTrip(params.id)
      .then((result) => { if (active) setTrip(result); })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "旅程を読み込めませんでした。"); });
    return () => { active = false; };
  }, [params.id]);

  return (
    <main className="page-shell" id="main-content">
      <EnvironmentBanner />
      <Link className="button button-secondary" href="/">プランナーへ戻る</Link>
      {error && (
        <div className="empty-state" role="alert" style={{ marginTop: 24 }}>
          <h2>旅程を読み込めません</h2>
          <p>{error}</p>
        </div>
      )}
      {!trip && !error && (
        <div className="loading-state" role="status" style={{ marginTop: 24 }}>
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-card" />
          <p>旅程を読み込んでいます…</p>
        </div>
      )}
      {trip && <TripView initialTrip={trip} editable />}
    </main>
  );
}
