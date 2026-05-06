import { useState } from "react";
import { C, I } from "../constants/theme.js";
import { mkUUID } from "../utils/mockoon.js";
import { Icon } from "./ui/Icon.jsx";
import { Btn } from "./ui/Btn.jsx";
import { Inp } from "./ui/Input.jsx";
import { Sel } from "./ui/Select.jsx";
import { MethodBadge } from "./ui/MethodBadge.jsx";
import { JsonEditor } from "./ui/JsonEditor.jsx";

const TARGET_OPTIONS = [
  { value: "params",  label: "URL Param (:id)" },
  { value: "query",   label: "Query string (?key=)" },
  { value: "body",    label: "Body (JSON key)" },
  { value: "header",  label: "Header HTTP" },
];
const OPERATOR_OPTIONS = [
  { value: "equals",    label: "Égal à" },
  { value: "contains",  label: "Contient" },
  { value: "regex",     label: "Regex" },
  { value: "empty",     label: "Est vide" },
  { value: "not_empty", label: "Non vide" },
];

export const RouteEditor = ({ route, onSave, onClose }) => {
  const [r, setR] = useState({ ...route });
  const [responses, setResponses] = useState(() => {
    const raw = route._raw?.responses || [];
    if (raw.length > 0) return raw;
    return [{
      uuid: mkUUID(), label: "", statusCode: 200, latency: 0,
      bodyType: "INLINE", body: route.body || "",
      headers: (route.headers || []).map(h => ({ ...h, enabled: true })),
      rules: [], rulesOperator: "OR", default: true,
      disableTemplating: false, fallbackTo404: false,
      filePath: "", sendFileAsBody: false,
    }];
  });
  const [activeResp, setActiveResp] = useState(0);

  const labelStyle = { color: C.textMuted, fontSize: 12, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 };

  const updRoute = (k, v) => setR(p => ({ ...p, [k]: v }));
  const updResp  = (i, k, v) => setResponses(rs => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const addResponse = () => {
    setResponses(rs => [...rs, {
      uuid: mkUUID(), label: `Réponse ${rs.length + 1}`, statusCode: 200, latency: 0,
      bodyType: "INLINE", body: "", headers: [], rules: [], rulesOperator: "OR", default: false,
      disableTemplating: false, fallbackTo404: false, filePath: "", sendFileAsBody: false,
    }]);
    setActiveResp(responses.length);
  };

  const removeResponse = (i) => {
    setResponses(rs => rs.filter((_, idx) => idx !== i));
    setActiveResp(Math.max(0, activeResp - 1));
  };

  const addRule = (i) => updResp(i, "rules", [...(responses[i].rules || []), {
    target: "params", modifier: "", value: "", operator: "equals", invert: false,
  }]);

  const updRule = (ri, ruleIdx, k, v) => {
    const rules = [...(responses[ri].rules || [])];
    rules[ruleIdx] = { ...rules[ruleIdx], [k]: v };
    updResp(ri, "rules", rules);
  };

  const removeRule = (ri, ruleIdx) =>
    updResp(ri, "rules", responses[ri].rules.filter((_, i) => i !== ruleIdx));

  const handleSave = () => {
    onSave({
      ...r,
      body: responses[0]?.body || "",
      headers: (responses[0]?.headers || []).map(h => ({ key: h.key, value: h.value })),
      status: responses[0]?.statusCode || 200,
      delay: responses[0]?.latency || 0,
      _raw: { ...(r._raw || {}), responses },
    });
  };

  const resp = responses[activeResp] || responses[0];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, backdropFilter:"blur(4px)" }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, width:960, maxHeight:"96vh", display:"flex", flexDirection:"column", boxShadow:"0 32px 100px rgba(0,0,0,.9)" }}>

        <div style={{ padding:"20px 28px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <MethodBadge method={r.method} />
            <span style={{ color:C.text, fontWeight:700, fontSize:16, fontFamily:"monospace" }}>{r.path || "Nouvelle route"}</span>
          </div>
          <Btn onClick={onClose} variant="ghost"><Icon d={I.x} /></Btn>
        </div>

        <div style={{ overflow:"auto", flex:1, padding:28, display:"flex", flexDirection:"column", gap:18 }}>

          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", gap:10 }}>
              <Sel value={r.method} onChange={v => updRoute("method", v)}
                options={["GET","POST","PUT","PATCH","DELETE"]} style={{ width:120, fontSize:14 }} />
              <Inp value={r.path} onChange={v => updRoute("path", v)}
                placeholder="/api/resource/:id" style={{ flex:1, fontSize:14 }} mono />
            </div>
            <Inp value={r.description} onChange={v => updRoute("description", v)}
              placeholder="Documentation (optionnel)…" style={{ fontSize:14 }} />
          </div>

          <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
            <div style={{ flex:1 }}>
              <label style={{ color:C.textMuted, fontSize:12, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>
                Réponse active ({responses.length})
              </label>
              <select value={activeResp} onChange={e => setActiveResp(Number(e.target.value))}
                style={{ width:"100%", background:C.bg, border:`1px solid ${C.accent}`, color:C.text, borderRadius:6, padding:"9px 12px", fontSize:14, fontFamily:"monospace", outline:"none", cursor:"pointer" }}>
                {responses.map((resp, i) => (
                  <option key={resp.uuid} value={i}>
                    {resp.default ? "★ " : ""}{resp.label || `Réponse ${i+1}`} — {resp.statusCode || 200}
                    {(resp.rules||[]).length > 0 ? ` (${resp.rules.length} règle${resp.rules.length>1?"s":""})` : " (défaut)"}
                  </option>
                ))}
              </select>
            </div>
            <Btn small variant="ghost" onClick={addResponse}>
              <Icon d={I.plus} size={13} /> Nouvelle réponse
            </Btn>
            {responses.length > 1 && (
              <Btn small variant="danger" onClick={() => removeResponse(activeResp)}>
                <Icon d={I.trash} size={13} /> Supprimer
              </Btn>
            )}
          </div>

          {resp && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

              <div style={{ display:"flex", gap:12, alignItems:"flex-end" }}>
                <div style={{ flex:3 }}>
                  <label style={labelStyle}>Label de la réponse</label>
                  <Inp value={resp.label||""} onChange={v => updResp(activeResp,"label",v)} placeholder="ex: Projet 18n10_aabd" style={{ fontSize:14 }} />
                </div>
                <div style={{ flex:1 }}>
                  <label style={labelStyle}>Status HTTP</label>
                  <Sel value={resp.statusCode||200} onChange={v => updResp(activeResp,"statusCode",Number(v))}
                    options={[200,201,204,400,401,403,404,409,422,500].map(s=>({value:s,label:s}))}
                    style={{ width:"100%", fontSize:14 }} />
                </div>
                <div style={{ flex:1 }}>
                  <label style={labelStyle}>Latence (ms)</label>
                  <Inp value={resp.latency||0} onChange={v => updResp(activeResp,"latency",Number(v))} mono style={{ fontSize:14 }} />
                </div>
                <div style={{ paddingBottom:4 }}>
                  <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", color:C.textDim, fontSize:13, whiteSpace:"nowrap" }}>
                    <input type="checkbox" checked={!!resp.default} onChange={e =>
                      setResponses(rs => rs.map((r2, i) => ({ ...r2, default: i === activeResp ? e.target.checked : false })))
                    } style={{ accentColor:C.accent, width:14, height:14 }} />
                    Réponse par défaut
                  </label>
                </div>
              </div>

              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ color:C.textMuted, fontSize:12, textTransform:"uppercase", letterSpacing:1 }}>Règles de correspondance</span>
                    {(resp.rules||[]).length > 1 && (
                      <div style={{ display:"flex", gap:4 }}>
                        {["OR","AND"].map(op => (
                          <button key={op} onClick={() => updResp(activeResp,"rulesOperator",op)}
                            style={{ background: resp.rulesOperator===op ? C.accentDim : "transparent",
                              border:`1px solid ${resp.rulesOperator===op ? C.accent : C.border}`,
                              color: resp.rulesOperator===op ? C.accent : C.textMuted,
                              borderRadius:4, padding:"3px 10px", fontSize:12, cursor:"pointer", fontFamily:"monospace", fontWeight:700 }}>
                            {op}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Btn small variant="ghost" onClick={() => addRule(activeResp)}>
                    <Icon d={I.plus} size={13} /> Ajouter une règle
                  </Btn>
                </div>

                {(resp.rules||[]).length === 0 ? (
                  <div style={{ color:C.textMuted, fontSize:13, textAlign:"center", padding:"12px 0", fontStyle:"italic" }}>
                    Aucune règle — cette réponse sera retournée par défaut
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {(resp.rules||[]).map((rule, ri) => (
                      <div key={ri}>
                        {ri > 0 && (
                          <div style={{ display:"flex", justifyContent:"center", margin:"4px 0" }}>
                            <span style={{ background: resp.rulesOperator==="AND" ? C.accentDim : "#2d1b4e",
                              color: resp.rulesOperator==="AND" ? C.accent : "#c084fc",
                              border: `1px solid ${resp.rulesOperator==="AND" ? C.accent : "#6b21a8"}`,
                              borderRadius:4, padding:"2px 10px", fontSize:11, fontWeight:700, fontFamily:"monospace" }}>
                              {resp.rulesOperator || "OR"}
                            </span>
                          </div>
                        )}
                        <div style={{ display:"grid", gridTemplateColumns:"160px 1fr 140px 1fr 80px 32px", gap:8, alignItems:"center", background:C.surfaceHover, borderRadius:6, padding:"10px 12px" }}>
                          <div>
                            <label style={{ ...labelStyle, marginBottom:4 }}>Source</label>
                            <Sel value={rule.target} onChange={v => updRule(activeResp,ri,"target",v)} options={TARGET_OPTIONS} style={{ width:"100%", fontSize:13 }} />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, marginBottom:4 }}>Paramètre</label>
                            <Inp value={rule.modifier||""} onChange={v => updRule(activeResp,ri,"modifier",v)} placeholder="project_token" mono style={{ fontSize:13 }} />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, marginBottom:4 }}>Opérateur</label>
                            <Sel value={rule.operator} onChange={v => updRule(activeResp,ri,"operator",v)} options={OPERATOR_OPTIONS} style={{ width:"100%", fontSize:13 }} />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, marginBottom:4 }}>Valeur</label>
                            {["empty","not_empty"].includes(rule.operator)
                              ? <div style={{ color:C.textMuted, fontSize:12, fontStyle:"italic", paddingTop:8 }}>—</div>
                              : <Inp value={rule.value||""} onChange={v => updRule(activeResp,ri,"value",v)} placeholder="18n10_aabd" mono style={{ fontSize:13 }} />
                            }
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                            <label style={{ ...labelStyle, marginBottom:4 }}>Inverser</label>
                            <input type="checkbox" checked={!!rule.invert}
                              onChange={e => updRule(activeResp,ri,"invert",e.target.checked)}
                              style={{ accentColor:C.accent, width:16, height:16, cursor:"pointer" }} />
                          </div>
                          <div style={{ display:"flex", alignItems:"flex-end", paddingBottom:2 }}>
                            <Btn small variant="danger" onClick={() => removeRule(activeResp,ri)}>
                              <Icon d={I.x} size={12} />
                            </Btn>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                  <label style={labelStyle}>Headers de réponse</label>
                  <Btn small variant="ghost" onClick={() => updResp(activeResp,"headers",[...(resp.headers||[]),{key:"",value:"",enabled:true}])}>
                    <Icon d={I.plus} size={13} /> Ajouter
                  </Btn>
                </div>
                {(resp.headers||[]).map((h, hi) => (
                  <div key={hi} style={{ display:"flex", gap:8, marginBottom:8 }}>
                    <Inp value={h.key} onChange={v => { const hs=[...resp.headers]; hs[hi]={...hs[hi],key:v}; updResp(activeResp,"headers",hs); }} placeholder="Content-Type" mono style={{ fontSize:14 }} />
                    <Inp value={h.value} onChange={v => { const hs=[...resp.headers]; hs[hi]={...hs[hi],value:v}; updResp(activeResp,"headers",hs); }} placeholder="application/json" mono style={{ fontSize:14 }} />
                    <Btn small variant="danger" onClick={() => updResp(activeResp,"headers",resp.headers.filter((_,j)=>j!==hi))}>
                      <Icon d={I.x} size={12} />
                    </Btn>
                  </div>
                ))}
              </div>

              <div>
                <label style={labelStyle}>Corps de la réponse</label>
                <JsonEditor value={resp.body||""} onChange={v => updResp(activeResp,"body",v)} height={280} />
              </div>

            </div>
          )}
        </div>

        <div style={{ padding:"16px 28px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"flex-end", gap:10, flexShrink:0 }}>
          <Btn onClick={onClose} style={{ fontSize:14 }}>Annuler</Btn>
          <Btn variant="primary" onClick={handleSave} style={{ fontSize:14 }}>
            <Icon d={I.check} size={15} /> Sauvegarder
          </Btn>
        </div>
      </div>
    </div>
  );
};
