import type { ProviderModes } from "@/lib/types";

const labels: Record<string, string> = { llm: "AI解析", place: "場所", crowd: "混雑" };

export function ProviderStatus({ modes }: { modes: ProviderModes }) {
  const entries = Object.entries(modes).filter((entry): entry is [string, string] => Boolean(entry[1]));
  if (entries.length === 0) {
    return <div className="status-banner warning"><strong>DATA</strong><span>APIからデータ提供元の状態が返されていません。</span></div>;
  }
  return (
    <div className="mode-row" aria-label="データ提供元の状態">
      {entries.map(([provider, mode]) => (
        <span className={`mode-chip ${mode === "mock" ? "mock" : ""}`} key={provider}>
          {labels[provider] ?? provider}: {mode.toUpperCase()}
        </span>
      ))}
    </div>
  );
}
