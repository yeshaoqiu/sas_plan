"use client";
import { useEffect, useState } from "react";
import { SUBJECT_META } from "../_components/subjectMeta";

const SUBJECTS = [
  { value: "writing", label: "写字" },
  { value: "picture_composition", label: "看图写话" },
  { value: "math", label: "数学" },
  { value: "other", label: "其他" },
];

export default function Manage() {
  const [children, setChildren] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [cName, setCName] = useState("");
  const [cGrade, setCGrade] = useState(1);
  const [tName, setTName] = useState("");
  const [tSubject, setTSubject] = useState("writing");
  const [tMinutes, setTMinutes] = useState(5);
  const [tPoints, setTPoints] = useState(10);

  function reload() {
    fetch("/api/children").then((r) => r.json()).then(setChildren);
    fetch("/api/templates").then((r) => r.json()).then(setTemplates);
  }
  useEffect(reload, []);

  async function addChild() {
    await fetch("/api/children", { method: "POST", body: JSON.stringify({ name: cName, grade: cGrade }) });
    setCName(""); reload();
  }
  async function addTemplate() {
    await fetch("/api/templates", { method: "POST", body: JSON.stringify({ name: tName, subject: tSubject, defaultMinutes: tMinutes, basePoints: tPoints }) });
    setTName(""); reload();
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 font-semibold">孩子</h2>
        <ul className="mb-2">{children.map((c) => <li key={c.id}>{c.avatar} {c.name}（{c.grade} 年级）</li>)}</ul>
        <div className="flex gap-2">
          <input placeholder="姓名" value={cName} onChange={(e) => setCName(e.target.value)} className="input" />
          <input type="number" value={cGrade} onChange={(e) => setCGrade(+e.target.value)} className="input w-16" />
          <button onClick={addChild} className="btn btn-primary px-3 py-1">添加</button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">任务模板</h2>
        <ul className="mb-2">{templates.map((t) => (
          <li key={t.id} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${SUBJECT_META[t.subject as keyof typeof SUBJECT_META]?.dot ?? "bg-slate-300"}`} />
            {t.name}（{t.basePoints}分 / {t.defaultMinutes}分钟）
          </li>
        ))}</ul>
        <div className="flex flex-wrap gap-2">
          <input placeholder="任务名" value={tName} onChange={(e) => setTName(e.target.value)} className="input" />
          <select value={tSubject} onChange={(e) => setTSubject(e.target.value)} className="input">
            {SUBJECTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input type="number" value={tMinutes} onChange={(e) => setTMinutes(+e.target.value)} className="input w-20" placeholder="分钟" />
          <input type="number" value={tPoints} onChange={(e) => setTPoints(+e.target.value)} className="input w-20" placeholder="基础分" />
          <button onClick={addTemplate} className="btn btn-primary px-3 py-1">添加</button>
        </div>
      </section>
    </div>
  );
}
