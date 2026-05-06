import { useState } from "react";
import { C, I } from "../constants/theme.js";
import { simulateRequest } from "../utils/simulate.js";
import { Icon } from "./ui/Icon.jsx";
import { Btn } from "./ui/Btn.jsx";
import { Inp } from "./ui/Input.jsx";
import { Sel } from "./ui/Select.jsx";
import { StatusBadge } from "./ui/StatusBadge.jsx";

export const TestPanel = ({ routes, serverRunning }) => {
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/api/users");
  const [resp, setResp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const send = async () => {
    if (!serverRunning) return;
    setLoading(true); setResp(null);
    const start = Date.now();
    const r = await simulateRequest(routes, method, path);
    setResp({ ...r, elapsed: Date.now() - start });
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Sel value={method} onChange={setMethod} options={["GET","POST","PUT","PATCH","DELETE"]} style={{ width: 110 }} />
        <Inp value={path} onChange={setPath} placeholder="/api/resource" mono style={{ flex: 1 }} />
        <Btn variant="primary" onClick={send} disabled={!serverRunning || loading}>
          {loading
            ? <span style={{ display:"inline-block",width:14,height:14,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite" }} />
            : <Icon d={I.send} size={14} />}
          Envoyer
        </Btn>
      </div>
      {!serverRunning && (
        <div style={{ background: C.redDim, border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13 }}>
          ⚠ Démarrez le serveur pour tester
        </div>
      )}
      {resp && (
        <div style={{ background: C.bg, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
          <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12 }}>
            <StatusBadge code={resp.status} />
            <span style={{ color:C.textMuted, fontSize:12 }}>{resp.elapsed}ms</span>
            {resp.delay > 0 && <span style={{ color:C.textMuted, fontSize:12 }}>latence +{resp.delay}ms</span>}
            <div style={{ marginLeft:"auto" }}>
              <Btn small variant="ghost" onClick={() => { navigator.clipboard?.writeText(resp.body||""); setCopied(true); setTimeout(()=>setCopied(false),1500); }}>
                <Icon d={copied?I.check:I.copy} size={12} />{copied?"Copié !":"Copier"}
              </Btn>
            </div>
          </div>
          {resp.headers?.length > 0 && (
            <div style={{ padding:"8px 14px", borderBottom:`1px solid ${C.border}` }}>
              {resp.headers.map((h,i) => (
                <div key={i} style={{ fontSize:12, color:C.textMuted, fontFamily:"monospace" }}>
                  <span style={{ color:C.accent }}>{h.key}</span>: {h.value}
                </div>
              ))}
            </div>
          )}
          <pre style={{ margin:0, padding:14, fontSize:12, color:C.text, fontFamily:"monospace", overflowX:"auto", whiteSpace:"pre-wrap", lineHeight:1.6 }}>
            {resp.body ? (() => { try { return JSON.stringify(JSON.parse(resp.body),null,2); } catch { return resp.body; } })() : "(corps vide)"}
          </pre>
        </div>
      )}
    </div>
  );
};
