import s from "@/components/admin/admin.module.css";

export default function Loading() {
  return <div aria-busy="true" aria-label="Loading">
    <div className={s.skeleton} style={{ height: 52, width: "min(360px, 70%)", marginBottom: 26 }} />
    <div className={s.kpis}>{Array.from({ length: 6 }, (_, i) => <div key={i} className={s.skeleton} style={{ height: 104 }} />)}</div>
    <div className={s.skeleton} style={{ height: 320, marginTop: 16 }} />
  </div>;
}
