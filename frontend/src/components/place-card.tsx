import type { ScoreBreakdown, TripStop } from "@/lib/types";
import { ArrowDownIcon, ArrowUpIcon, TrashIcon } from "./icons";

interface PlaceCardProps {
  stop: TripStop;
  index: number;
  count: number;
  editable: boolean;
  busy: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (stopId: string) => void;
  onViewed: (placeId: string) => void;
}

const scoreLabels: Record<keyof ScoreBreakdown, string> = {
  total: "総合",
  preference: "好み",
  crowd: "混雑相性",
  distance: "距離",
  time: "時間",
  budget: "予算",
  diversity: "多様性",
  area: "エリア",
};

const currency = new Intl.NumberFormat("ja-JP");

function scorePercent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

export function PlaceCard({ stop, index, count, editable, busy, onMove, onRemove, onViewed }: PlaceCardProps) {
  const scoreEntries = Object.entries(stop.scoreBreakdown) as [keyof ScoreBreakdown, number][];
  const crowdScope = stop.crowd?.scope === "area" ? "エリア単位" : stop.crowd?.scope;

  return (
    <article className="place-card" aria-labelledby={`stop-title-${stop.id}`}>
      {stop.imageUrl && (
        <div className="place-image-wrap">
          {/* Provider image hosts are not known until runtime, so Next Image cannot safely allowlist them. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="place-image" src={stop.imageUrl} alt={`${stop.placeName}の写真`} width="800" height="350" loading="lazy" decoding="async" />
        </div>
      )}
      <div className="place-body">
        <p className="place-kicker">{stop.category || "カテゴリ未提供"}</p>
        <div className="place-title-line">
          <h3 id={`stop-title-${stop.id}`}>{stop.placeName}</h3>
          <span className="place-order">STOP {index + 1}</span>
        </div>
        {stop.address && <p className="place-address">{stop.address}</p>}
        <p className="reason"><strong>おすすめの理由</strong><br />{stop.reason}</p>

        <dl className="fact-list">
          <div className="fact"><dt>滞在</dt><dd>{stop.estimatedStayMinutes}分</dd></div>
          <div className="fact"><dt>予想費用</dt><dd>{stop.estimatedCost == null ? "データなし" : `${currency.format(stop.estimatedCost)}ウォン`}</dd></div>
          <div className="fact"><dt>出発</dt><dd>{stop.leaveAt}</dd></div>
          <div className="fact"><dt>総合スコア</dt><dd>{scorePercent(stop.scoreBreakdown.total)}</dd></div>
        </dl>

        <p className="crowd-note">
          <strong>混雑：</strong>{stop.crowd?.level ?? "データなし"}
          {crowdScope ? `（${crowdScope}${stop.crowd?.areaName ? `・${stop.crowd.areaName}` : ""}）` : ""}
          {stop.crowd?.scope === "area" && <><br />特定店舗の店内混雑度ではありません。</>}
        </p>

        <details className="score-details" onToggle={(event) => { if (event.currentTarget.open) onViewed(stop.placeId); }}>
          <summary>なぜここがおすすめ？ スコア内訳</summary>
          <div className="score-grid">
            {scoreEntries.map(([key, value]) => (
              <div className="score-row" key={key}><span>{scoreLabels[key] ?? key}</span><span>{scorePercent(value)}</span></div>
            ))}
          </div>
        </details>

        {editable && (
          <div className="stop-actions" aria-label={`${stop.placeName}の編集`}>
            <button className="button button-secondary button-small" type="button" onClick={() => onMove(index, -1)} disabled={busy || index === 0} aria-label={`${stop.placeName}を一つ前へ`}><ArrowUpIcon />前へ</button>
            <button className="button button-secondary button-small" type="button" onClick={() => onMove(index, 1)} disabled={busy || index === count - 1} aria-label={`${stop.placeName}を一つ後へ`}><ArrowDownIcon />後へ</button>
            <button className="button button-danger button-small" type="button" onClick={() => onRemove(stop.id)} disabled={busy} aria-label={`${stop.placeName}を旅程から削除`}><TrashIcon />削除</button>
          </div>
        )}
      </div>
    </article>
  );
}
