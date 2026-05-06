import { C, I } from "../constants/theme.js";
import { Icon } from "./ui/Icon.jsx";
import { Btn } from "./ui/Btn.jsx";
import { MethodBadge } from "./ui/MethodBadge.jsx";
import { StatusBadge } from "./ui/StatusBadge.jsx";

export const Logs = ({ logs, onClear }) => (
  <div>
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
      <Btn small variant="ghost" onClick={onClear}><Icon d={I.trash} size={12} /> Vider</Btn>
    </div>
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "auto", fontFamily: "monospace", fontSize: 12, maxHeight: 500 }}>
      {logs.length === 0
        ? <div style={{ color: C.textMuted, padding: 20, textAlign: "center" }}>Aucun log</div>
        : [...logs].reverse().map((l,i) => (
          <div key={i} style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ color: C.textMuted, fontSize: 11 }}>{l.time}</span>
            <MethodBadge method={l.method} />
            <span style={{ color: C.textDim, flex: 1 }}>{l.path}</span>
            <StatusBadge code={l.status} />
            <span style={{ color: C.textMuted, fontSize: 11 }}>{l.ms}ms</span>
          </div>
        ))}
    </div>
  </div>
);
