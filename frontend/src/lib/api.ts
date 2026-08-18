import { demoTrip } from "./demo-data";
import type { GenerateTripInput, StopPatch, Trip } from "./types";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/$/, "");
export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
let demoState: Trip = structuredClone(demoTrip);

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function normalizeTrip(payload: unknown): Trip {
  const envelope = payload as {
    data?: unknown;
    trip?: unknown;
    providerModes?: Trip["providerModes"];
    warnings?: string[];
    meta?: { providerModes?: Trip["providerModes"]; warnings?: string[] };
  };
  const raw = (envelope?.data ?? envelope?.trip ?? payload) as Partial<Trip>;
  if (!raw || typeof raw !== "object" || !raw.id || !Array.isArray(raw.stops)) {
    throw new ApiError("APIの応答形式が正しくありません。", undefined, "INVALID_RESPONSE");
  }
  return {
    ...raw,
    id: String(raw.id),
    date: raw.date ?? "",
    startTime: raw.startTime ?? raw.preference?.startTime ?? "",
    endTime: raw.endTime ?? raw.preference?.endTime ?? "",
    stops: [...raw.stops].sort((a, b) => a.order - b.order),
    providerModes: raw.providerModes ?? envelope.providerModes ?? envelope.meta?.providerModes ?? {},
    warnings: raw.warnings ?? envelope.warnings ?? envelope.meta?.warnings ?? [],
  } as Trip;
}

async function request(path: string, init?: RequestInit): Promise<Trip> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("サーバーに接続できません。バックエンドの起動とAPI URLを確認してください。", undefined, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => undefined) as { message?: string; code?: string } | undefined;
  if (!response.ok) {
    throw new ApiError(payload?.message ?? "リクエストを完了できませんでした。", response.status, payload?.code);
  }
  return normalizeTrip(payload);
}

export async function generateTrip(input: GenerateTripInput): Promise<Trip> {
  if (demoMode) {
    demoState = structuredClone(demoTrip);
    if (input.travelDate) demoState.date = input.travelDate;
    return structuredClone(demoState);
  }
  return request("/trips/generate", { method: "POST", body: JSON.stringify(input) });
}

export async function getTrip(id: string): Promise<Trip> {
  if (demoMode) {
    if (id !== demoTrip.id) throw new ApiError("デモ旅程が見つかりません。", 404, "NOT_FOUND");
    return structuredClone(demoState);
  }
  return request(`/trips/${encodeURIComponent(id)}`);
}

export async function patchTripStops(id: string, patch: StopPatch): Promise<Trip> {
  if (demoMode) {
    const trip = structuredClone(demoState);
    if (patch.action === "remove") trip.stops = trip.stops.filter((stop) => stop.id !== patch.stopId);
    if (patch.action === "reorder") {
      trip.stops.sort((a, b) => patch.stopIds.indexOf(a.id) - patch.stopIds.indexOf(b.id));
    }
    trip.stops = trip.stops.map((stop, index) => ({ ...stop, order: index + 1 }));
    demoState = trip;
    return structuredClone(demoState);
  }
  return request(`/trips/${encodeURIComponent(id)}/stops`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
