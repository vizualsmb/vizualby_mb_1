import s from "./admin.module.css";
import { Empty } from "./ui";

// Horizontal magnitude bars: one hue, sorted, value printed beside each label.
export function Breakdown({ rows, format, empty = "No data yet" }: { rows: { label: string; value: number; note?: string }[]; format: (n: number) => string; empty?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (!rows.length || max <= 0) return <Empty title={empty} />;
  return <div className={s.bars}>{rows.map((r) => <div key={r.label} className={s.barRow}>
    <div className={s.barLabel}><span>{r.label}{r.note && <span className={s.metaText}> · {r.note}</span>}</span><span>{format(r.value)}</span></div>
    <div className={s.barTrack} aria-hidden><div className={s.barFill} style={{ width: `${Math.max(1, (r.value / max) * 100)}%` }} /></div>
  </div>)}</div>;
}
