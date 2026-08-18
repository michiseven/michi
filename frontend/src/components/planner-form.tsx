"use client";

import { useState, type FormEvent } from "react";
import type { GenerateTripInput } from "@/lib/types";
import { ArrowRightIcon } from "./icons";

interface PlannerFormProps {
  loading: boolean;
  onSubmit: (input: GenerateTripInput) => Promise<void>;
}

interface FormValues {
  text: string;
  travelDate: string;
  startTime: string;
  endTime: string;
  budget: string;
  startArea: string;
}

interface FormError {
  field: "text" | "time" | "budget";
  message: string;
}

const initialValues: FormValues = {
  text: "",
  travelDate: "",
  startTime: "13:00",
  endTime: "21:00",
  budget: "80000",
  startArea: "聖水",
};

export function PlannerForm({ loading, onSubmit }: PlannerFormProps) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<FormError>();

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setError(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = values.text.trim();
    if (text.length < 10) {
      setError({ field: "text", message: "希望を10文字以上で入力してください。" });
      return;
    }
    if (values.startTime && values.endTime && values.startTime >= values.endTime) {
      setError({ field: "time", message: "終了時刻は開始時刻より後にしてください。" });
      return;
    }
    const budget = values.budget ? Number(values.budget) : undefined;
    if (budget !== undefined && (!Number.isInteger(budget) || budget < 0)) {
      setError({ field: "budget", message: "予算は0以上のウォン単位で入力してください。" });
      return;
    }
    await onSubmit({
      text,
      travelDate: values.travelDate || undefined,
      startTime: values.startTime || undefined,
      endTime: values.endTime || undefined,
      budget,
      startArea: values.startArea.trim() || undefined,
    });
  }

  return (
    <form className="planner-form" onSubmit={submit} noValidate aria-busy={loading}>
      <div className="field">
        <label htmlFor="trip-request">どんな一日にしたいですか？ <span className="required" aria-hidden="true">*</span></label>
        <textarea
          className="textarea"
          id="trip-request"
          value={values.text}
          onChange={(event) => update("text", event.target.value)}
          aria-describedby={`trip-request-hint${error?.field === "text" ? " trip-request-error" : ""}`}
          aria-invalid={error?.field === "text"}
          placeholder="例：明日、聖水で一人で過ごしたい。静かなカフェとセレクトショップが好きで、夜は焼肉を食べたい。"
          required
          disabled={loading}
        />
        <p className="hint" id="trip-request-hint">好きなこと、避けたいこと、食事、ペースまで自由に書けます。</p>
        {error?.field === "text" && <p className="field-error" id="trip-request-error" role="alert">{error.message}</p>}
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="travel-date">日付</label>
          <input className="input" id="travel-date" type="date" value={values.travelDate} onChange={(event) => update("travelDate", event.target.value)} disabled={loading} />
        </div>
        <div className="field">
          <label htmlFor="start-area">出発エリア</label>
          <input className="input" id="start-area" value={values.startArea} onChange={(event) => update("startArea", event.target.value)} placeholder="例：聖水" disabled={loading} />
        </div>
        <div className="field">
          <label htmlFor="start-time">開始時刻</label>
          <input className="input" id="start-time" type="time" value={values.startTime} onChange={(event) => update("startTime", event.target.value)} aria-describedby={error?.field === "time" ? "time-window-error" : undefined} aria-invalid={error?.field === "time"} disabled={loading} />
        </div>
        <div className="field">
          <label htmlFor="end-time">終了時刻</label>
          <input className="input" id="end-time" type="time" value={values.endTime} onChange={(event) => update("endTime", event.target.value)} aria-describedby={error?.field === "time" ? "time-window-error" : undefined} aria-invalid={error?.field === "time"} disabled={loading} />
        </div>
      </div>
      {error?.field === "time" && <p className="field-error" id="time-window-error" role="alert">{error.message}</p>}

      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="budget">予算（KRW）</label>
        <input className="input" id="budget" type="number" inputMode="numeric" min="0" step="1000" value={values.budget} onChange={(event) => update("budget", event.target.value)} aria-describedby={`budget-hint${error?.field === "budget" ? " budget-error" : ""}`} aria-invalid={error?.field === "budget"} disabled={loading} />
        <p className="hint" id="budget-hint">1,000ウォン単位の目安。外部データに価格がない場所は推測しません。</p>
        {error?.field === "budget" && <p className="field-error" id="budget-error" role="alert">{error.message}</p>}
      </div>

      <div className="form-actions">
        <button className="button button-primary" type="submit" disabled={loading || !values.text.trim()}>
          {loading ? <><span className="spinner" aria-hidden="true" />旅程を作成中</> : <>旅程を作る<ArrowRightIcon /></>}
        </button>
      </div>
    </form>
  );
}
