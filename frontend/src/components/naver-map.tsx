"use client";

import { useEffect, useRef, useState } from "react";
import type { TripStop } from "@/lib/types";
import { MapPinIcon } from "./icons";

declare global {
  interface Window {
    navermap_authFailure?: () => void;
    naver?: {
      maps: {
        Map: new (element: HTMLElement, options: Record<string, unknown>) => { fitBounds: (bounds: unknown) => void };
        LatLng: new (latitude: number, longitude: number) => unknown;
        LatLngBounds: new () => { extend: (point: unknown) => void };
        Point: new (x: number, y: number) => unknown;
        Marker: new (options: Record<string, unknown>) => unknown;
      };
    };
  }
}

type MapStop = Pick<TripStop, "id" | "placeName" | "latitude" | "longitude">;

interface NaverMapProps { stops: MapStop[]; }

const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

function CoordinateFallback({ stops, message }: NaverMapProps & { message: string }) {
  return (
    <div className="map-fallback" role="region" aria-label="場所の座標一覧">
      <div>
        <h3><MapPinIcon style={{ display: "inline", marginRight: 7, verticalAlign: -3 }} />地図を表示できません</h3>
        <p className="map-note">{message}</p>
      </div>
      <ol className="coordinate-list">
        {stops.map((stop, index) => (
          <li className="coordinate-item" key={stop.id}>
            <span className="marker-index">{index + 1}</span>
            <span><strong>{stop.placeName}</strong><br /><small>{stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}</small></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function NaverMap({ stops }: NaverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">(clientId ? "loading" : "error");

  useEffect(() => {
    if (!clientId || !containerRef.current || stops.length === 0) return;
    let disposed = false;

    function renderMap() {
      if (disposed || !window.naver || !containerRef.current) return;
      try {
        const maps = window.naver.maps;
        const first = new maps.LatLng(stops[0].latitude, stops[0].longitude);
        const map = new maps.Map(containerRef.current, { center: first, zoom: 13 });
        const bounds = new maps.LatLngBounds();
        stops.forEach((stop, index) => {
          const position = new maps.LatLng(stop.latitude, stop.longitude);
          bounds.extend(position);
          new maps.Marker({
            position,
            map,
            title: `${index + 1}. ${stop.placeName}`,
            icon: {
              content: `<span style="display:grid;place-items:center;width:30px;height:30px;border:2px solid white;border-radius:50%;background:#0f6253;color:white;font:700 13px sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25)">${index + 1}</span>`,
              anchor: new maps.Point(15, 15),
            },
          });
        });
        if (stops.length > 1) map.fitBounds(bounds);
        setState("ready");
      } catch {
        setState("error");
      }
    }

    if (window.naver?.maps) {
      renderMap();
      return () => { disposed = true; };
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-michi-naver-map="true"]');
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&language=ja`;
      script.async = true;
      script.dataset.michiNaverMap = "true";
      document.head.appendChild(script);
    }
    script.addEventListener("load", renderMap);
    script.addEventListener("error", () => setState("error"));
    window.navermap_authFailure = () => setState("error");
    return () => {
      disposed = true;
      script.removeEventListener("load", renderMap);
      if (window.navermap_authFailure) window.navermap_authFailure = undefined;
    };
  }, [stops]);

  if (!clientId) return <div className="map-frame"><CoordinateFallback stops={stops} message="NAVER MapsのクライアントIDが未設定です。座標だけを表示しています。" /></div>;

  return (
    <div className="map-frame">
      <div ref={containerRef} className="map-canvas" aria-label="旅程のNAVER地図" aria-hidden={state !== "ready"} />
      {state === "loading" && <div className="map-overlay loading-state" role="status">地図を読み込んでいます…</div>}
      {state === "error" && <div className="map-overlay"><CoordinateFallback stops={stops} message="NAVER Mapsを読み込めませんでした。座標だけを表示しています。" /></div>}
    </div>
  );
}
