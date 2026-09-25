"use client";

import { useEffect, useRef, useState } from "react";
import s from "./admin.module.css";
import c from "./chart.module.css";

export type ChartPoint = { label: string; longLabel: string; revenue: number; expenses: number; profit: number };

const usd = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
// Deterministic (no ICU compact notation), so server and browser render identical text.
function axisUsd(cents: number) {
  const d = cents / 100;
  if (d >= 1000) return `$${+(d / 1000).toFixed(1)}K`;
  return `$${Math.round(d)}`;
}
// Four gridline steps on round numbers: $1K, $2K… or $250, $500…
function niceStep(v: number) {
  const raw = Math.max(v, 10000) / 4;
  const exp = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * exp).find((n) => n >= raw)!;
}
// Bars sit on the baseline with only the data end rounded.
function bar(x: number, y: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function RevenueChart({ points }: { points: ChartPoint[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const height = 240, m = { top: 12, right: 6, bottom: 28, left: 50 };
  const plotW = width - m.left - m.right, plotH = height - m.top - m.bottom;
  const step = niceStep(Math.max(...points.flatMap((p) => [p.revenue, p.expenses])));
  const max = step * 4;
  const y = (v: number) => m.top + plotH - (v / max) * plotH;
  const groupW = plotW / Math.max(points.length, 1);
  const barW = Math.max(2, Math.min(22, (groupW * 0.72 - 2) / 2));
  const every = Math.max(1, Math.ceil((points.length * 46) / plotW));
  const ticks = [0, 1, 2, 3, 4].map((t) => t * step);
  const shown = active !== null ? points[active] : null;
  // Tooltip sits beside the hovered group, flipping left near the right edge.
  const tipW = 176;
  const tipLeft = active === null ? 0 : (() => { const right = m.left + (active + 1) * groupW + 6; return right + tipW <= width ? right : Math.max(0, m.left + active * groupW - tipW - 6); })();
  const empty = points.every((p) => p.revenue === 0 && p.expenses === 0);

  const move = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    setActive((i) => Math.min(points.length - 1, Math.max(0, (i ?? (e.key === "ArrowRight" ? -1 : points.length)) + (e.key === "ArrowRight" ? 1 : -1))));
  };

  return <div>
    <div className={c.legend} aria-hidden>
      <span><i style={{ background: "var(--revenue)" }} />Revenue collected</span>
      <span><i style={{ background: "var(--expense)" }} />Expenses</span>
    </div>
    <div ref={wrap} className={c.plot}>
      <svg width={width} height={height} role="img" tabIndex={0} onKeyDown={move} onBlur={() => setActive(null)} onPointerLeave={() => setActive(null)}
        aria-label={`Revenue and expenses, ${points.length} periods. Use arrow keys to read each period. A table view follows.`}>
        {ticks.map((t) => <g key={t}>
          <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} className={t === 0 ? c.baseline : c.grid} />
          <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className={c.axis}>{axisUsd(t)}</text>
        </g>)}
        {points.map((p, i) => {
          const x0 = m.left + i * groupW + (groupW - (barW * 2 + 2)) / 2;
          return <g key={i} className={active !== null && active !== i ? c.dim : undefined}>
            <path d={bar(x0, y(p.revenue), barW, y(0) - y(p.revenue))} fill="var(--revenue)" />
            <path d={bar(x0 + barW + 2, y(p.expenses), barW, y(0) - y(p.expenses))} fill="var(--expense)" />
            {i % every === 0 && <text x={m.left + i * groupW + groupW / 2} y={height - 8} textAnchor="middle" className={c.axis}>{p.label}</text>}
            <rect x={m.left + i * groupW} y={m.top} width={groupW} height={plotH} fill="transparent" onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />
          </g>;
        })}
      </svg>
      {empty && <p className={c.emptyOverlay}>No payments or expenses in this range yet.</p>}
      {shown && <div className={c.tooltip} style={{ left: tipLeft, width: tipW }} role="status">
        <p className={c.tipTitle}>{shown.longLabel}</p>
        <p><i style={{ background: "var(--revenue)" }} /><b>{usd(shown.revenue)}</b> revenue</p>
        <p><i style={{ background: "var(--expense)" }} /><b>{usd(shown.expenses)}</b> expenses</p>
        <p className={c.tipProfit}><b className={shown.profit < 0 ? c.negative : undefined}>{usd(shown.profit)}</b> profit</p>
      </div>}
    </div>
    <details className={c.tableView}>
      <summary className={s.cardLink}>Show as table</summary>
      <table className={s.table}>
        <thead><tr><th>Period</th><th className={s.num}>Revenue</th><th className={s.num}>Expenses</th><th className={s.num}>Profit</th></tr></thead>
        <tbody>{points.map((p, i) => <tr key={i}><td>{p.longLabel}</td><td className={s.num}>{usd(p.revenue)}</td><td className={s.num}>{usd(p.expenses)}</td><td className={s.num}>{usd(p.profit)}</td></tr>)}</tbody>
      </table>
    </details>
  </div>;
}
