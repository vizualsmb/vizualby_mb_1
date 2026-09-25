import s from "./admin.module.css";
import { Chips, hrefWith } from "./ui";
import { RANGE_PRESETS, type DateRange } from "@/lib/admin/finance";

// Date range for everything below it. Plain links and a GET form: no client JavaScript.
export function RangeFilter({ base, range, params }: { base: string; range: DateRange; params: Record<string, string | undefined> }) {
  return <div className={s.toolbar}>
    <Chips label="Date range" items={[...RANGE_PRESETS, ["custom", "Custom"]]} current={range.key}
      hrefFor={(k) => hrefWith(base, params, k === "custom" ? { range: "custom", from: range.from, to: range.to } : { range: k, from: undefined, to: undefined })} />
    {range.key === "custom" && <form action={base} className={s.search} style={{ maxWidth: 460 }}>
      {Object.entries(params).filter(([k, v]) => v && !["range", "from", "to"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="range" value="custom" />
      <input className={s.input} type="date" name="from" defaultValue={range.from} aria-label="From" required />
      <input className={s.input} type="date" name="to" defaultValue={range.to} aria-label="To" required />
      <button className={`${s.button} ${s.buttonGhost}`}>Apply</button>
    </form>}
  </div>;
}
