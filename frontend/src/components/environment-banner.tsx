import { demoMode } from "@/lib/api";

export function EnvironmentBanner() {
  if (!demoMode) return null;
  return (
    <div className="status-banner warning" role="status">
      <strong>DEMO</strong>
      <span>デモモードです。表示される場所・混雑度・旅程はサンプルで、実際のAPIデータではありません。</span>
    </div>
  );
}
