"use client";

import Link from "next/link";
import { useState } from "react";
import { patchTripStops } from "@/lib/api";
import { captureMichiEvent } from "@/lib/telemetry";
import type { Trip } from "@/lib/types";
import { NaverMap } from "./naver-map";
import { PlaceCard } from "./place-card";
import { ProviderStatus } from "./provider-status";
import { RefreshIcon } from "./icons";

interface TripViewProps {
  initialTrip: Trip;
  editable?: boolean;
  showDetailLink?: boolean;
}

const currency = new Intl.NumberFormat("ja-JP");

export function TripView({ initialTrip, editable = false, showDetailLink = false }: TripViewProps) {
  const [trip, setTrip] = useState(initialTrip);
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [routeStatus, setRouteStatus] = useState<"idle" | "started" | "completed">("idle");

  async function mutate(label: string, operation: Parameters<typeof patchTripStops>[1], onSuccess?: () => void) {
    setBusy(true);
    setActionError(undefined);
    setActionMessage(`${label}しています…`);
    try {
      const updated = await patchTripStops(trip.id, operation);
      setTrip(updated);
      setActionMessage(`${label}しました。`);
      onSuccess?.();
    } catch (error) {
      setActionMessage(undefined);
      setActionError(error instanceof Error ? error.message : "旅程を更新できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= trip.stops.length) return;
    const reordered = [...trip.stops];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const movedStop = trip.stops[index];
    void mutate("順番を更新", { action: "reorder", stopIds: reordered.map((stop) => stop.id) }, () => {
      if (!movedStop) return;
      captureMichiEvent("place_reordered", {
        tripId: trip.id,
        placeId: movedStop.placeId,
        context: { fromOrder: index + 1, toOrder: target + 1 },
      });
    });
  }

  function startRoute() {
    setRouteStatus("started");
    captureMichiEvent("route_started", { tripId: trip.id, context: { stopCount: trip.stops.length } });
  }

  function completeRoute() {
    setRouteStatus("completed");
    captureMichiEvent("route_completed", { tripId: trip.id, context: { stopCount: trip.stops.length } });
  }

  return (
    <section className="trip-result" aria-labelledby="trip-result-title">
      <div className="trip-header">
        <div>
          <p className="eyebrow">YOUR SEOUL ROUTE</p>
          <h2 id="trip-result-title">{trip.title || "ソウルで過ごす一日"}</h2>
          <p className="trip-meta">
            {trip.date || "日付未指定"} ・ {trip.startTime || "--:--"}–{trip.endTime || "--:--"} ・ {trip.stops.length}か所
            {trip.estimatedTotalCost != null ? ` ・ 約${currency.format(trip.estimatedTotalCost)}ウォン` : ""}
          </p>
        </div>
        {showDetailLink && <Link className="button button-secondary" href={`/trips/${encodeURIComponent(trip.id)}`}>詳細・編集へ</Link>}
      </div>

      <ProviderStatus modes={trip.providerModes} />
      {trip.warnings.map((warning, index) => <div className="status-banner warning" role="status" key={`${warning}-${index}`}><strong>注意</strong><span>{warning}</span></div>)}

      {editable && trip.stops.length > 0 && (
        <div className="trip-toolbar">
          <button className="button button-primary" type="button" onClick={() => void mutate("旅程を再計算", { action: "recalculate" })} disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <RefreshIcon />}旅程を再計算
          </button>
          {routeStatus === "idle" && <button className="button button-secondary" type="button" onClick={startRoute}>ルートを開始</button>}
          {routeStatus === "started" && <button className="button button-secondary" type="button" onClick={completeRoute}>ルートを完了</button>}
          {routeStatus === "completed" && <span className="route-complete" role="status">ルートを完了しました。</span>}
          <Link className="button button-secondary" href="/">新しい旅程を作る</Link>
        </div>
      )}
      <div className="inline-action-status" aria-live="polite">{actionMessage}</div>
      {actionError && <div className="status-banner error" role="alert"><strong>更新失敗</strong><span>{actionError}</span></div>}

      {trip.stops.length === 0 ? (
        <div className="empty-state">
          <h2>立ち寄り先がありません</h2>
          <p>条件を変えて再計算するか、新しい旅程を作ってください。</p>
          <Link className="button button-primary" style={{ marginTop: 18 }} href="/">プランナーへ戻る</Link>
        </div>
      ) : (
        <div className="trip-layout">
          <div className="map-panel">
            <NaverMap stops={trip.stops} />
            <p className="map-note">ピン番号は旅程の順番です。座標はWGS84です。</p>
          </div>
          <div className="timeline-panel">
            <ol className="timeline" aria-label="旅程タイムライン">
              {trip.stops.map((stop, index) => (
                <li className="timeline-item" key={stop.id}>
                  <time className="timeline-time">{stop.arrivalAt}</time>
                  <span className="timeline-rail" aria-hidden="true"><span className="timeline-dot" /></span>
                  <PlaceCard
                    stop={stop}
                    index={index}
                    count={trip.stops.length}
                    editable={editable}
                    busy={busy}
                    onMove={move}
                    onRemove={(stopId) => {
                      const removedStop = trip.stops.find((candidate) => candidate.id === stopId);
                      void mutate("場所を削除", { action: "remove", stopId }, () => {
                        if (!removedStop) return;
                        captureMichiEvent("place_removed", {
                          tripId: trip.id,
                          placeId: removedStop.placeId,
                          context: { previousOrder: removedStop.order },
                        });
                      });
                    }}
                    onViewed={(placeId) => captureMichiEvent("place_viewed", { tripId: trip.id, placeId })}
                  />
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
