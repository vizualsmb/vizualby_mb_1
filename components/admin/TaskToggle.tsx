"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { toggleProjectTask } from "@/lib/admin/production-actions";
import s from "./admin.module.css";

export function TaskToggle({ id, projectId, title, completed, stage }: { id: string; projectId: string; title: string; completed: boolean; stage: string }) {
  const [, action, pending] = useActionState(toggleProjectTask, {});
  return <form action={action} className={s.projectTaskRow}><input type="hidden" name="id" value={id} /><input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="completed" value={String(!completed)} /><button type="submit" disabled={pending} aria-label={`${completed ? "Mark incomplete" : "Complete"}: ${title}`} className={`${s.projectTaskCheck} ${completed ? s.projectTaskComplete : ""}`}>{completed && <Check size={14} />}</button><span><b>{title}</b><small>{stage}</small></span></form>;
}
