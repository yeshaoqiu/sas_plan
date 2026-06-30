import type { Subject } from "@/lib/types";

export const SUBJECT_META: Record<
  Subject,
  { label: string; dot: string; chip: string }
> = {
  writing: { label: "写字", dot: "bg-amber-400", chip: "bg-amber-100 text-amber-700" },
  picture_composition: { label: "看图写话", dot: "bg-violet-400", chip: "bg-violet-100 text-violet-700" },
  math: { label: "数学", dot: "bg-emerald-400", chip: "bg-emerald-100 text-emerald-700" },
  other: { label: "其他", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700" },
};
