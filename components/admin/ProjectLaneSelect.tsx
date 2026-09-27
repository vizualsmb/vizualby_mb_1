"use client";

import { useActionState } from "react";
import { setProjectLane } from "@/lib/admin/production-actions";
import type { ProjectLane } from "@/lib/admin/production";
import s from "./admin.module.css";

export function ProjectLaneSelect({ projectId, lane }: { projectId: string; lane: ProjectLane }) {
  const [, action, pending] = useActionState(setProjectLane, {});
  return <form action={action} className={s.projectLaneForm}>
    <input type="hidden" name="project_id" value={projectId} />
    <label className={s.srOnly} htmlFor={`lane-${projectId}`}>Project lane</label>
    <select id={`lane-${projectId}`} name="lane" defaultValue={lane} disabled={pending} className={s.projectLaneSelect}>
      <option value="active">On timeline</option><option value="review">Edits / review</option><option value="delivered">Delivered</option>
    </select>
    <button className={s.projectLaneSave} type="submit" disabled={pending}>Move</button>
  </form>;
}
