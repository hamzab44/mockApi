import { useState, useRef, useCallback, useEffect } from "react";
import MonacoEditor from "@monaco-editor/react";

const API = "http://localhost:3001";

// Sync routes to Express server
async function syncRoutes(routes) {
  try {
    await fetch(`${API}/api/mock/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routes: routes.map(toMockoon) }),
    });
  } catch (e) { console.warn('Sync failed', e); }
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#0d0f14", surface: "#151820", surfaceHover: "#1c2030",
  border: "#252a38", accent: "#3d8ef0", accentDim: "#1e3d6e",
  green: "#22c55e", greenDim: "#14532d", red: "#ef4444", redDim: "#450a0a",
  yellow: "#eab308", text: "#e2e8f0", textMuted: "#64748b", textDim: "#94a3b8",
};

const METHOD_COLORS = {
  GET:    { bg: "#0d3d2e", text: "#22c55e", border: "#166534" },
  POST:   { bg: "#1e3a5f", text: "#60a5fa", border: "#1d4ed8" },
  PUT:    { bg: "#3d2a00", text: "#fbbf24", border: "#92400e" },
  PATCH:  { bg: "#2d1b4e", text: "#c084fc", border: "#6b21a8" },
  DELETE: { bg: "#3d0e0e", text: "#f87171", border: "#991b1b" },
};

// ─── Mockoon helpers ──────────────────────────────────────────────────────────
function mkUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
const fromMockoonMethod = m => (m || "get").toUpperCase();
const toMockoonMethod   = m => m.toLowerCase();
const fromEndpoint      = e => (e.startsWith("/") ? e : `/${e}`);
const toEndpoint        = p => p.replace(/^\//, "");

function fromMockoon(route) {
  const resp = (route.responses || [])[0] || {};
  return {
    uuid: route.uuid || mkUUID(),
    method: fromMockoonMethod(route.method),
    path: fromEndpoint(route.endpoint || ""),
    status: resp.statusCode || 200,
    delay: resp.latency || 0,
    enabled: route.enabled !== false,
    description: route.documentation || "",
    headers: (resp.headers || []).map(h => ({ key: h.key, value: h.value })),
    body: resp.body || "",
    _raw: route,
  };
}

function toMockoon(r) {
  const base = r._raw || {};
  return {
    ...base,
    uuid: r.uuid, type: base.type || "http",
    documentation: r.description,
    method: toMockoonMethod(r.method),
    endpoint: toEndpoint(r.path),
    enabled: r.enabled !== false,
    responseMode: base.responseMode || null,
    responses: [{
      ...(base.responses?.[0] || {}),
      uuid: base.responses?.[0]?.uuid || mkUUID(),
      label: r.label || "", statusCode: r.status, latency: r.delay || 0,
      body: r.body,
      headers: r.headers.map(h => ({ key: h.key, value: h.value, enabled: true })),
      bodyType: base.responses?.[0]?.bodyType || "INLINE",
      filePath: base.responses?.[0]?.filePath || "",
      sendFileAsBody: base.responses?.[0]?.sendFileAsBody || false,
      rules: base.responses?.[0]?.rules || [],
      rulesOperator: base.responses?.[0]?.rulesOperator || "OR",
      disableTemplating: base.responses?.[0]?.disableTemplating || false,
      fallbackTo404: base.responses?.[0]?.fallbackTo404 || false,
      default: base.responses?.[0]?.default !== undefined ? base.responses[0].default : true,
      crudKey: base.responses?.[0]?.crudKey || "id",
      callbacks: base.responses?.[0]?.callbacks || [],
    }, ...(base.responses?.slice(1) || [])],
  };
}

function parseMockoonFile(json) {
  const env = JSON.parse(json);
  return {
    _envRaw: env, _filePath: null,
    name: env.name || "Mon projet",
    port: env.port || 3000,
    routes: (env.routes || []).map(fromMockoon),
  };
}

// Construit l'arbre de navigation à 2 niveaux
function buildFolderTree(envRaw) {
  const folderMap = Object.fromEntries((envRaw.folders || []).map(f => [f.uuid, f]));
  const rootChildren = envRaw.rootChildren || [];
  
  return rootChildren
    .filter(c => c.type === "folder")
    .map(c => {
      const folder = folderMap[c.uuid];
      if (!folder) return null;
      const subFolders = (folder.children || [])
        .filter(ch => ch.type === "folder")
        .map(ch => folderMap[ch.uuid])
        .filter(Boolean);
      return { ...folder, subFolders };
    })
    .filter(Boolean);
}

function serializeMockoonFile(state) {
  const base = state._envRaw || {};
  return JSON.stringify({
    ...base,
    uuid: base.uuid || mkUUID(),
    lastMigration: base.lastMigration || 32,
    name: state.name, port: state.port,
    routes: state.routes.map(toMockoon),
    rootChildren: base.rootChildren || state.routes.map(r => ({ type: "route", uuid: r.uuid })),
    proxyMode: base.proxyMode || false, proxyHost: base.proxyHost || "",
    proxyRemovePrefix: base.proxyRemovePrefix || false,
    tlsOptions: base.tlsOptions || { enabled: false, type: "CERT", pfxPath: "", certPath: "", keyPath: "", caPath: "", passphrase: "" },
    cors: base.cors !== undefined ? base.cors : true,
    headers: base.headers || [{ key: "Content-Type", value: "application/json", enabled: true }],
    proxyReqHeaders: base.proxyReqHeaders || [], proxyResHeaders: base.proxyResHeaders || [],
    data: base.data || [], folders: base.folders || [], callbacks: base.callbacks || [],
  }, null, 2);
}

function matchRoute(routes, method, path) {
  for (const r of routes) {
    if (!r.enabled || r.method !== method) continue;
    const pattern = r.path.replace(/:[\w]+/g, "([^/]+)");
    if (new RegExp(`^${pattern}$`).test(path)) return r;
  }
  return null;
}

async function simulateRequest(routes, method, path) {
  const r = matchRoute(routes, method, path);
  if (!r) return { status: 404, body: JSON.stringify({ error: "Route non trouvée" }), headers: [], delay: 0 };
  if (r.delay > 0) await new Promise(res => setTimeout(res, r.delay));
  return { status: r.status, body: r.body, headers: r.headers, delay: r.delay };
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const I = {
  play: "M5 3l14 9-14 9V3z", stop: "M18 6H6v12h12V6z", plus: "M12 5v14M5 12h14",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  upload: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  save: "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8",
  copy: "M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2M8 4a2 2 0 012-2h4a2 2 0 012 2M8 4h8",
  check: "M20 6L9 17l-5-5", x: "M18 6L6 18M6 6l12 12",
  server: "M2 2h20v8H2zM2 14h20v8H2zM6 6h.01M6 18h.01",
  zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  link: "M15 7h3a5 5 0 010 10h-3m-6 0H6A5 5 0 016 7h3M8 12h8",
  folder: "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
  folderOpen: "M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z",
  file: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6",
  chevUp: "M18 15l-6-6-6 6", chevDown: "M6 9l6 6 6-6", chevRight: "M9 18l6-6-6-6",
  home: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10",
  layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  clock: "M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2",
  folderClosed: "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  move: "M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20",
  clone: "M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V8l-4-4H8zM8 4v4h8M8 12h8M8 16h4",
};

// ─── UI primitives ────────────────────────────────────────────────────────────
const MethodBadge = ({ method }) => {
  const mc = METHOD_COLORS[method] || METHOD_COLORS.GET;
  return <span style={{ background: mc.bg, color: mc.text, border: `1px solid ${mc.border}`, borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap" }}>{method}</span>;
};
const StatusBadge = ({ code }) => {
  const color = code < 300 ? C.green : code < 400 ? C.yellow : C.red;
  const bg = code < 300 ? C.greenDim : code < 400 ? "#3d3000" : C.redDim;
  return <span style={{ background: bg, color, borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>{code}</span>;
};
const Btn = ({ onClick, children, variant = "default", small, disabled, style: extra }) => {
  const base = { border: "none", cursor: disabled ? "not-allowed" : "pointer", borderRadius: 6, fontFamily: "monospace", fontWeight: 600, transition: "all .15s", opacity: disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 6 };
  const V = {
    default: { background: C.surface, color: C.textDim, border: `1px solid ${C.border}`, padding: small ? "5px 10px" : "8px 14px", fontSize: small ? 12 : 13 },
    primary: { background: C.accent, color: "#fff", padding: small ? "5px 10px" : "8px 16px", fontSize: small ? 12 : 13 },
    danger:  { background: C.redDim, color: C.red, border: `1px solid #7f1d1d`, padding: small ? "5px 10px" : "8px 14px", fontSize: small ? 12 : 13 },
    success: { background: C.greenDim, color: C.green, border: `1px solid #166534`, padding: small ? "5px 10px" : "8px 14px", fontSize: small ? 12 : 13 },
    ghost:   { background: "transparent", color: C.textMuted, padding: small ? "4px 8px" : "6px 10px", fontSize: 12 },
  };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...V[variant], ...extra }}>{children}</button>;
};
const Inp = ({ value, onChange, placeholder, style: extra, mono }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "7px 10px", fontSize: 13, fontFamily: mono ? "monospace" : "inherit", outline: "none", width: "100%", boxSizing: "border-box", ...extra }} />
);
const Sel = ({ value, onChange, options, style: extra }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "7px 10px", fontSize: 13, outline: "none", ...extra }}>
    {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
  </select>
);
const JsonEditor = ({ value, onChange, height = 200 }) => {
  const [err, setErr] = useState(null);

  const handleChange = (val) => {
    onChange(val || "");
    try { if ((val||"").trim()) JSON.parse(val); setErr(null); }
    catch (ex) { setErr(ex.message); }
  };

  return (
    <div>
      <div style={{ border: `1px solid ${err ? C.red : C.border}`, borderRadius: 6, overflow: "hidden", height }}>
        <MonacoEditor
          height={height}
          language="json"
          theme="vs-dark"
          value={value || ""}
          onChange={handleChange}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: "off",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </div>
      {err && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>⚠ {err}</div>}
    </div>
  );
};

// ─── File Explorer ────────────────────────────────────────────────────────────
const FileExplorer = ({ onSelect, onClose }) => {
  const [currentPath, setCurrentPath] = useState("/home");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [manualPath, setManualPath] = useState("/home");

  const browse = async (p) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/files?path=${encodeURIComponent(p)}`);
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      setCurrentPath(data.path);
      setManualPath(data.path);
      setEntries(data.entries);
    } catch {
      setError("Impossible de contacter le serveur de fichiers (port 3001)");
    }
    setLoading(false);
  };

  useEffect(() => { browse("/home"); }, []);

  const up = () => {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    browse("/" + parts.join("/") || "/");
  };

  // Breadcrumb parts
  const crumbs = currentPath.split("/").filter(Boolean);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)" }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, width: 640, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,.9)" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon d={I.folder} size={16} color={C.accent} />
            <span style={{ color: C.text, fontWeight: 700, fontSize: 14, fontFamily: "monospace" }}>Explorateur de fichiers WSL</span>
          </div>
          <Btn onClick={onClose} variant="ghost"><Icon d={I.x} /></Btn>
        </div>

        {/* Path bar */}
        <div style={{ padding: "10px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, alignItems: "center" }}>
          <Btn small variant="ghost" onClick={() => browse("/home")}><Icon d={I.home} size={14} /></Btn>
          <Btn small variant="ghost" onClick={up} disabled={currentPath === "/"}><Icon d={I.chevUp} size={14} /></Btn>
          <div style={{ flex: 1, display: "flex", gap: 4, alignItems: "center", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px" }}>
            {/* Breadcrumb */}
            <span style={{ color: C.textMuted, fontSize: 12, fontFamily: "monospace" }}>/</span>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => browse("/" + crumbs.slice(0, i+1).join("/"))}
                  style={{ background: "none", border: "none", color: i === crumbs.length-1 ? C.text : C.accent, cursor: "pointer", fontFamily: "monospace", fontSize: 12, padding: 0 }}>{c}</button>
                {i < crumbs.length-1 && <span style={{ color: C.textMuted, fontSize: 12 }}>/</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Manual path input */}
        <div style={{ padding: "8px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
          <Inp value={manualPath} onChange={setManualPath} placeholder="/chemin/vers/dossier" mono
            style={{ fontSize: 12 }} />
          <Btn small onClick={() => browse(manualPath)}>Go</Btn>
        </div>

        {/* File list */}
        <div style={{ flex: 1, overflow: "auto", padding: "8px 0" }}>
          {loading && <div style={{ padding: 20, textAlign: "center", color: C.textMuted, fontSize: 13 }}>Chargement…</div>}
          {error && <div style={{ padding: 16, color: C.red, fontSize: 13, background: C.redDim, margin: "8px 20px", borderRadius: 6 }}>⚠ {error}</div>}
          {!loading && entries.map((e, i) => (
            <div key={i}
              onClick={() => e.isDir ? browse(e.path) : (e.ext === ".json" && onSelect(e.path))}
              style={{
                padding: "8px 20px", display: "flex", alignItems: "center", gap: 10, cursor: e.isDir || e.ext === ".json" ? "pointer" : "default",
                background: "transparent", transition: "background .1s",
                opacity: !e.isDir && e.ext !== ".json" ? 0.4 : 1,
              }}
              onMouseEnter={ev => { if (e.isDir || e.ext === ".json") ev.currentTarget.style.background = C.surfaceHover; }}
              onMouseLeave={ev => { ev.currentTarget.style.background = "transparent"; }}
            >
              <Icon d={e.isDir ? I.folder : I.file} size={16} color={e.isDir ? C.yellow : e.ext === ".json" ? C.green : C.textMuted} />
              <span style={{ fontFamily: "monospace", fontSize: 13, color: e.isDir ? C.textDim : e.ext === ".json" ? C.text : C.textMuted, flex: 1 }}>{e.name}</span>
              {e.ext === ".json" && <span style={{ fontSize: 11, color: C.green, background: C.greenDim, borderRadius: 4, padding: "1px 6px" }}>JSON</span>}
              {e.isDir && <Icon d={I.chevRight} size={14} color={C.textMuted} />}
            </div>
          ))}
          {!loading && !error && entries.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: C.textMuted, fontSize: 13 }}>Dossier vide</div>
          )}
        </div>

        <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, color: C.textMuted, fontSize: 11 }}>
          Seuls les fichiers <span style={{ color: C.green }}>.json</span> sont sélectionnables
        </div>
      </div>
    </div>
  );
};

// ─── Route Editor ─────────────────────────────────────────────────────────────
const RouteEditor = ({ route, onSave, onClose }) => {
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
      filePath: "", sendFileAsBody: false, crudKey: "id", callbacks: [],
    }];
  });
  const [activeResp, setActiveResp] = useState(0);

  const updRoute = (k, v) => setR(p => ({ ...p, [k]: v }));
  const updResp  = (i, k, v) => setResponses(rs => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const addResponse = () => {
    setResponses(rs => [...rs, {
      uuid: mkUUID(), label: `Réponse ${rs.length + 1}`, statusCode: 200, latency: 0,
      bodyType: "INLINE", body: "", headers: [], rules: [], rulesOperator: "OR", default: false,
      disableTemplating: false, fallbackTo404: false, filePath: "", sendFileAsBody: false, crudKey: "id", callbacks: [],
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

  const labelStyle = { color: C.textMuted, fontSize: 12, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, backdropFilter:"blur(4px)" }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, width:960, maxHeight:"96vh", display:"flex", flexDirection:"column", boxShadow:"0 32px 100px rgba(0,0,0,.9)" }}>

        {/* Header */}
        <div style={{ padding:"20px 28px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <MethodBadge method={r.method} />
            <span style={{ color:C.text, fontWeight:700, fontSize:16, fontFamily:"monospace" }}>{r.path || "Nouvelle route"}</span>
          </div>
          <Btn onClick={onClose} variant="ghost"><Icon d={I.x} /></Btn>
        </div>

        {/* Scrollable body */}
        <div style={{ overflow:"auto", flex:1, padding:28, display:"flex", flexDirection:"column", gap:18 }}>

          {/* Méthode + Path + Doc */}
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

          {/* Onglets réponses */}
          {/* Sélecteur de réponse — dropdown */}
          <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
            <div style={{ flex:1 }}>
              <label style={{ color:C.textMuted, fontSize:12, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>
                Réponse active ({responses.length})
              </label>
              <select value={activeResp} onChange={e => setActiveResp(Number(e.target.value))}
                style={{ width:"100%", background:C.bg, border:`1px solid ${C.accent}`, color:C.text,
                  borderRadius:6, padding:"9px 12px", fontSize:14, fontFamily:"monospace", outline:"none", cursor:"pointer" }}>
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

              {/* Label + Status + Latence + Default */}
              <div style={{ display:"flex", gap:12, alignItems:"flex-end" }}>
                <div style={{ flex:3 }}>
                  <label style={labelStyle}>Label de la réponse</label>
                  <Inp value={resp.label||""} onChange={v => updResp(activeResp,"label",v)}
                    placeholder="ex: Projet 18n10_aabd" style={{ fontSize:14 }} />
                </div>
                <div style={{ flex:1 }}>
                  <label style={labelStyle}>Status HTTP</label>
                  <Sel value={resp.statusCode||200} onChange={v => updResp(activeResp,"statusCode",Number(v))}
                    options={[200,201,204,400,401,403,404,409,422,500].map(s=>({value:s,label:s}))}
                    style={{ width:"100%", fontSize:14 }} />
                </div>
                <div style={{ flex:1 }}>
                  <label style={labelStyle}>Latence (ms)</label>
                  <Inp value={resp.latency||0} onChange={v => updResp(activeResp,"latency",Number(v))}
                    mono style={{ fontSize:14 }} />
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

              {/* Règles */}
              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ color:C.textMuted, fontSize:12, textTransform:"uppercase", letterSpacing:1 }}>
                      Règles de correspondance
                    </span>
                    {(resp.rules||[]).length > 1 && (
                      <div style={{ display:"flex", gap:4 }}>
                        {["OR","AND"].map(op => (
                          <button key={op} onClick={() => updResp(activeResp,"rulesOperator",op)}
                            style={{ background: resp.rulesOperator===op ? C.accentDim : "transparent",
                              border:`1px solid ${resp.rulesOperator===op ? C.accent : C.border}`,
                              color: resp.rulesOperator===op ? C.accent : C.textMuted,
                              borderRadius:4, padding:"3px 10px", fontSize:12, cursor:"pointer",
                              fontFamily:"monospace", fontWeight:700 }}>
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
                              color: resp.rulesOperator==="AND" ? C.accent : C.purple,
                              border: `1px solid ${resp.rulesOperator==="AND" ? C.accent : C.purple}`,
                              borderRadius:4, padding:"2px 10px", fontSize:11, fontWeight:700, fontFamily:"monospace" }}>
                              {resp.rulesOperator || "OR"}
                            </span>
                          </div>
                        )}
                        <div style={{ display:"grid", gridTemplateColumns:"160px 1fr 140px 1fr 80px 32px", gap:8, alignItems:"center",
                          background:C.surfaceHover, borderRadius:6, padding:"10px 12px" }}>
                          <div>
                            <label style={{ ...labelStyle, marginBottom:4 }}>Source</label>
                            <Sel value={rule.target} onChange={v => updRule(activeResp,ri,"target",v)}
                              options={TARGET_OPTIONS} style={{ width:"100%", fontSize:13 }} />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, marginBottom:4 }}>Paramètre</label>
                            <Inp value={rule.modifier||""} onChange={v => updRule(activeResp,ri,"modifier",v)}
                              placeholder="project_token" mono style={{ fontSize:13 }} />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, marginBottom:4 }}>Opérateur</label>
                            <Sel value={rule.operator} onChange={v => updRule(activeResp,ri,"operator",v)}
                              options={OPERATOR_OPTIONS} style={{ width:"100%", fontSize:13 }} />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, marginBottom:4 }}>Valeur</label>
                            {["empty","not_empty"].includes(rule.operator)
                              ? <div style={{ color:C.textMuted, fontSize:12, fontStyle:"italic", paddingTop:8 }}>—</div>
                              : <Inp value={rule.value||""} onChange={v => updRule(activeResp,ri,"value",v)}
                                  placeholder="18n10_aabd" mono style={{ fontSize:13 }} />
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

              {/* Headers */}
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                  <label style={labelStyle}>Headers de réponse</label>
                  <Btn small variant="ghost" onClick={() => updResp(activeResp,"headers",[...(resp.headers||[]),{key:"",value:"",enabled:true}])}>
                    <Icon d={I.plus} size={13} /> Ajouter
                  </Btn>
                </div>
                {(resp.headers||[]).map((h, hi) => (
                  <div key={hi} style={{ display:"flex", gap:8, marginBottom:8 }}>
                    <Inp value={h.key} onChange={v => { const hs=[...resp.headers]; hs[hi]={...hs[hi],key:v}; updResp(activeResp,"headers",hs); }}
                      placeholder="Content-Type" mono style={{ fontSize:14 }} />
                    <Inp value={h.value} onChange={v => { const hs=[...resp.headers]; hs[hi]={...hs[hi],value:v}; updResp(activeResp,"headers",hs); }}
                      placeholder="application/json" mono style={{ fontSize:14 }} />
                    <Btn small variant="danger" onClick={() => updResp(activeResp,"headers",resp.headers.filter((_,j)=>j!==hi))}>
                      <Icon d={I.x} size={12} />
                    </Btn>
                  </div>
                ))}
              </div>

              {/* Body */}
              <div>
                <label style={labelStyle}>Corps de la réponse</label>
                <JsonEditor value={resp.body||""} onChange={v => updResp(activeResp,"body",v)} height={280} />
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
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

// ─── Test Panel ───────────────────────────────────────────────────────────────
const TestPanel = ({ routes, serverRunning }) => {
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
          {loading ? <span style={{ display:"inline-block",width:14,height:14,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite" }} /> : <Icon d={I.send} size={14} />}
          Envoyer
        </Btn>
      </div>
      {!serverRunning && <div style={{ background: C.redDim, border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13 }}>⚠ Démarrez le serveur pour tester</div>}
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
              {resp.headers.map((h,i) => <div key={i} style={{ fontSize:12, color:C.textMuted, fontFamily:"monospace" }}><span style={{ color:C.accent }}>{h.key}</span>: {h.value}</div>)}
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

// ─── Mockoon File Tab ─────────────────────────────────────────────────────────
const MockoonTab = ({ state, onImport }) => {
  const [showExplorer, setShowExplorer] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [serverOk, setServerOk] = useState(null);
  const fileRef = useRef();

  // Check if file server is reachable
  useEffect(() => {
    fetch(`${API}/api/files?path=/home`)
      .then(() => setServerOk(true))
      .catch(() => setServerOk(false));
  }, []);

  const loadFromPath = async (filePath) => {
    try {
      const res = await fetch(`${API}/api/read?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (data.error) { alert("Erreur : " + data.error); return; }
      const parsed = parseMockoonFile(data.content);
      parsed._filePath = filePath;
      onImport(parsed);
      setCurrentFile(filePath);
      setShowExplorer(false);
      localStorage.setItem("mockapi_last_file", filePath); // ← ajoute cette ligne
      parsed._filePath = filePath;
      onImport(parsed);
      setCurrentFile(filePath);
      setShowExplorer(false);
    } catch (e) { alert("Erreur de lecture : " + e.message); }
  };

  const saveToFile = async () => {
    if (!currentFile) return;
    setSaving(true);
    try {
      const content = serializeMockoonFile(state);
      const res = await fetch(`${API}/api/write?path=${encodeURIComponent(currentFile)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.error) { setSaveMsg({ ok: false, msg: data.error }); }
      else { setSaveMsg({ ok: true, msg: "Fichier sauvegardé !" }); setTimeout(() => setSaveMsg(null), 2000); }
    } catch (e) { setSaveMsg({ ok: false, msg: e.message }); }
    setSaving(false);
  };

  // Fallback: classic file input
  const loadFromInput = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseMockoonFile(ev.target.result);
        onImport(parsed); setCurrentFile(f.name);
      } catch (ex) { alert("Fichier invalide : " + ex.message); }
    };
    reader.readAsText(f); e.target.value = "";
  };

  const download = () => {
    const blob = new Blob([serializeMockoonFile(state)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${state.name.replace(/\s+/g,"_")}.json`;
    a.click();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Server status */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1a1f2e", border: `1px solid ${serverOk ? C.accent : C.border}`, borderRadius: 8, padding: "10px 16px" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: serverOk === null ? C.yellow : serverOk ? C.green : C.red }} />
        <span style={{ color: serverOk ? C.accent : C.textMuted, fontSize: 13, fontWeight: 600 }}>
          {serverOk === null ? "Vérification du serveur de fichiers…" : serverOk ? "Serveur de fichiers connecté (port 3001)" : "Serveur de fichiers non disponible (port 3001)"}
        </span>
        <Icon d={I.layers} size={14} color={serverOk ? C.accent : C.textMuted} />
      </div>

      {/* Current file */}
      {currentFile && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.greenDim, border: "1px solid #166534", borderRadius: 8, padding: "10px 16px" }}>
          <Icon d={I.file} size={14} color={C.green} />
          <span style={{ fontFamily: "monospace", fontSize: 13, color: C.green, flex: 1 }}>{currentFile}</span>
          {saveMsg && <span style={{ fontSize: 12, color: saveMsg.ok ? C.green : C.red }}>{saveMsg.msg}</span>}
          <Btn small variant="success" onClick={saveToFile} disabled={saving}>
            <Icon d={I.save} size={12} />{saving ? "Sauvegarde…" : "Sauvegarder"}
          </Btn>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {serverOk && (
          <Btn onClick={() => setShowExplorer(true)}>
            <Icon d={I.folderOpen} size={14} /> Parcourir WSL
          </Btn>
        )}
        <input ref={fileRef} type="file" accept=".json" onChange={loadFromInput} style={{ display: "none" }} />
        <Btn onClick={() => fileRef.current.click()}>
          <Icon d={I.upload} size={14} /> Ouvrir depuis Windows
        </Btn>
        <Btn onClick={download}>
          <Icon d={I.download} size={14} /> Télécharger .json
        </Btn>
        {!currentFile && (
          <div style={{ marginLeft: "auto", color: C.textMuted, fontSize: 12, display: "flex", alignItems: "center" }}>
            Aucun fichier ouvert
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ color: C.textDim, fontSize: 13, fontWeight: 600 }}>Format Mockoon natif</div>
        <div style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.7 }}>
          • <b style={{ color: C.textDim }}>Parcourir WSL</b> — navigue dans tes dossiers Ubuntu et ouvre directement ton <code style={{ color: C.accent }}>.json</code> Mockoon<br/>
          • <b style={{ color: C.textDim }}>Ouvrir depuis Windows</b> — sélecteur de fichier classique (navigateur Windows)<br/>
          • <b style={{ color: C.textDim }}>Sauvegarder</b> — écrit les modifications directement dans le fichier ouvert<br/>
          • Le fichier reste <b style={{ color: C.textDim }}>100% compatible</b> avec Mockoon Desktop &amp; CLI
        </div>
      </div>

      {/* Aperçu JSON */}
      <div>
        <div style={{ color: C.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Aperçu JSON (lecture seule)</div>
        <pre style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, fontSize: 12, fontFamily: "monospace", color: C.textDim, overflowX: "auto", maxHeight: 300, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
          {serializeMockoonFile(state).slice(0, 1500)}{serializeMockoonFile(state).length > 1500 ? "\n…" : ""}
        </pre>
      </div>

      {showExplorer && <FileExplorer onSelect={loadFromPath} onClose={() => setShowExplorer(false)} />}
    </div>
  );
};
// ─── Routes Tab ───────────────────────────────────────────────────────────────
const RoutesTab = ({ state, setState, serverRunning, selectedId, setSelectedId, setEditingRoute, testRoute, currentFile }) => {
  const [search, setSearch] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState(() => {
    try {
      const saved = localStorage.getItem("mockapi_collapsed_folders");
      if (saved) return JSON.parse(saved);
    } catch {}
    // Par défaut tous les dossiers sont fermés
    const allFolders = state._envRaw?.folders || [];
    return Object.fromEntries(allFolders.map(f => [f.uuid, true]));
  });
  const [showNewRoute, setShowNewRoute] = useState(false);
  const [movingRoute, setMovingRoute] = useState(null);
  const [deletingRoute, setDeletingRoute] = useState(null);

const cloneRoute = (route) => {
  const cloned = {
    ...route,
    uuid: mkUUID(),
    path: route.path + "_copy",
    description: route.description ? route.description + " (copie)" : "Copie",
    _raw: route._raw ? {
      ...route._raw,
      uuid: mkUUID(),
      responses: (route._raw.responses || []).map(r => ({ ...r, uuid: mkUUID() }))
    } : null,
  };

  setState(s => {
    const envRaw = { ...(s._envRaw || {}) };

    if ((envRaw.rootChildren || []).find(c => c.type==="route" && c.uuid===route.uuid)) {
      envRaw.rootChildren = [...envRaw.rootChildren, { type:"route", uuid:cloned.uuid }];
    } else {
      envRaw.folders = (envRaw.folders || []).map(f => {
        const idx = (f.children||[]).findIndex(c => c.type==="route" && c.uuid===route.uuid);
        if (idx >= 0) {
          const children = [...f.children];
          children.splice(idx + 1, 0, { type:"route", uuid:cloned.uuid });
          return { ...f, children };
        }
        return f;
      });
    }

    const newState = { ...s, _envRaw: envRaw, routes: [...s.routes, cloned] };

    // Sauvegarde automatique
    if (s._filePath) {
      const content = serializeMockoonFile(newState);
      fetch(`${API}/api/write?path=${encodeURIComponent(s._filePath)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    }

    return newState;
  });
};

  const toggleFolder = (uuid) => {
    setCollapsedFolders(p => {
      const updated = { ...p, [uuid]: !p[uuid] };
      localStorage.setItem("mockapi_collapsed_folders", JSON.stringify(updated));
      return updated;
    });
  };

  const routeMap = Object.fromEntries(state.routes.map(r => [r.uuid, r]));
  const folderMap = Object.fromEntries((state._envRaw?.folders || []).map(f => [f.uuid, f]));

  const matchesSearch = (route) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return route.path.toLowerCase().includes(q) ||
           route.method.toLowerCase().includes(q) ||
           (route.description||"").toLowerCase().includes(q);
  };

  // Construit l'arborescence depuis rootChildren
  const rootChildren = state._envRaw?.rootChildren || state.routes.map(r => ({ type:"route", uuid:r.uuid }));
  const renderRoute = (route) => {
    if (!route || !matchesSearch(route)) return null;
    return (
      <div key={route.uuid} onClick={() => setSelectedId(selectedId===route.uuid?null:route.uuid)}
        style={{ background:selectedId===route.uuid?C.surfaceHover:C.surface, border:`1px solid ${selectedId===route.uuid?C.accent:C.border}`, borderRadius:8, cursor:"pointer", transition:"all .15s", opacity:route.enabled?1:0.5, marginBottom:4 }}>
        <div style={{ padding:"11px 16px", display:"flex", alignItems:"center", gap:12 }}>
          <input type="checkbox" checked={route.enabled}
            onChange={e => { e.stopPropagation(); setState(s=>({...s,routes:s.routes.map(x=>x.uuid===route.uuid?{...x,enabled:!x.enabled}:x)})); }}
            style={{ accentColor:C.accent, width:14, height:14 }} onClick={e=>e.stopPropagation()} />
          <MethodBadge method={route.method} />
          <span style={{ fontFamily:"monospace", fontSize:14, color:C.text, flex:1 }}>{route.path}</span>
          {route.description && <span style={{ color:C.textMuted, fontSize:12, maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{route.description}</span>}
          <StatusBadge code={route.status} />
          {route.delay>0 && <span style={{ color:C.textMuted, fontSize:11, fontFamily:"monospace" }}>{route.delay}ms</span>}
          {(route._raw?.responses||[]).length > 1 && (
            <span style={{ color:C.purple, fontSize:11, background:"#2d1b4e", borderRadius:4, padding:"1px 6px", fontFamily:"monospace" }}>
              {route._raw.responses.length} rép.
            </span>
          )}
          <div style={{ display:"flex", gap:4 }} onClick={e=>e.stopPropagation()}>
            {serverRunning && <Btn small variant="ghost" onClick={()=>testRoute(route)}><Icon d={I.zap} size={12} /></Btn>}
            <Btn small variant="ghost" onClick={()=>setEditingRoute(route)}><Icon d={I.edit} size={12} /></Btn>
            <Btn small variant="ghost" onClick={()=>setMovingRoute(route)}><Icon d={I.move} size={12} /></Btn>
            <Btn small variant="ghost" onClick={(e)=>{e.stopPropagation();cloneRoute(route);}}><Icon d={I.clone} size={12} /></Btn>
            <Btn small variant="ghost" onClick={(e)=>{e.stopPropagation();setDeletingRoute(route);}}><Icon d={I.trash} size={12} /></Btn>
          </div>
        </div>
        {selectedId===route.uuid && (
          <div style={{ borderTop:`1px solid ${C.border}`, padding:"10px 16px 14px", display:"flex", gap:16 }}>
            <div style={{ flex:1 }}>
              <div style={{ color:C.textMuted, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Headers</div>
              {route.headers?.length ? route.headers.map((h,i)=>(
                <div key={i} style={{ fontSize:12, fontFamily:"monospace", color:C.textDim }}><span style={{ color:C.accent }}>{h.key}</span>: {h.value}</div>
              )) : <span style={{ color:C.textMuted, fontSize:12 }}>—</span>}
            </div>
            <div style={{ flex:2 }}>
              <div style={{ color:C.textMuted, fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Corps</div>
              <pre style={{ margin:0, fontSize:12, color:C.textDim, fontFamily:"monospace", whiteSpace:"pre-wrap", maxHeight:100, overflow:"auto", wordBreak:"break-all", overflowWrap:"break-word" }}>{route.body||"(vide)"}</pre>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFolder = (folder, depth = 0) => {
    if (!folder) return null;
    const children = folder.children || [];
    const folderRoutes = children.filter(c => c.type==="route").map(c => routeMap[c.uuid]).filter(Boolean);
    const subFolderUuids = children.filter(c => c.type==="folder").map(c => c.uuid);
    const subFolders = subFolderUuids.map(uuid => folderMap[uuid]).filter(Boolean);

    const visibleRoutes = folderRoutes.filter(matchesSearch);
    const hasVisibleContent = visibleRoutes.length > 0 || subFolders.some(sf => {
      const sfRoutes = (sf.children||[]).filter(c=>c.type==="route").map(c=>routeMap[c.uuid]).filter(Boolean);
      return sfRoutes.some(matchesSearch);
    });
    if (search && !hasVisibleContent) return null;

    const isCollapsed = collapsedFolders[folder.uuid] && !search;
    const indent = depth * 20;

    return (
      <div key={folder.uuid} style={{ marginBottom: depth===0 ? 8 : 4 }}>
        {/* Folder header */}
        <div onClick={() => toggleFolder(folder.uuid)}
          style={{ display:"flex", alignItems:"center", gap:10, padding:`8px 12px 8px ${12+indent}px`,
            background: depth===0 ? C.surfaceHover : "#1a1f2e",
            border:`1px solid ${depth===0 ? C.border : C.border+"80"}`,
            borderRadius: isCollapsed ? 8 : "8px 8px 0 0",
            cursor:"pointer", userSelect:"none" }}>
          <Icon d={isCollapsed ? I.chevRight : I.chevDown} size={13} color={depth===0 ? C.yellow : C.accent} />
          <Icon d={I.folderClosed} size={14} color={depth===0 ? C.yellow : C.accent} />
          <span style={{ color:C.textDim, fontWeight:600, fontSize:depth===0?13:12, flex:1 }}>{folder.name}</span>
          {depth===0 && subFolders.length > 0 && (
            <span style={{ color:C.textMuted, fontSize:11, background:C.bg, borderRadius:4, padding:"1px 6px", fontFamily:"monospace" }}>
              {subFolders.length} sous-dossier{subFolders.length>1?"s":""}
            </span>
          )}
          <span style={{ color:C.textMuted, fontSize:11, background:C.bg, borderRadius:4, padding:"1px 7px", fontFamily:"monospace" }}>
            {visibleRoutes.length} route{visibleRoutes.length>1?"s":""}
          </span>
        </div>

        {/* Folder content */}
        {!isCollapsed && (
          <div style={{ border:`1px solid ${C.border}`, borderTop:"none", borderRadius:"0 0 8px 8px",
            padding:`8px 8px 4px ${8+indent}px`, background: depth===0 ? "#0f111a" : "#0a0c11" }}>
            {/* Direct routes */}
            {folderRoutes.map(r => renderRoute(r))}
            {/* Sub-folders */}
            {subFolders.map(sf => renderFolder(sf, depth + 1))}
            {folderRoutes.length === 0 && subFolders.length === 0 && (
              <div style={{ color:C.textMuted, fontSize:12, padding:"10px 8px", fontStyle:"italic" }}>Dossier vide</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Routes sans dossier
  const rootRoutes = rootChildren.filter(c => c.type==="route").map(c => routeMap[c.uuid]).filter(Boolean);
  const rootFolders = rootChildren.filter(c => c.type==="folder").map(c => folderMap[c.uuid]).filter(Boolean);
  const totalVisible = state.routes.filter(matchesSearch).length;

  return (
    <div>
      {/* Fichier ouvert + barre de recherche */}
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:16 }}>
        <div style={{ flex:1, position:"relative" }}>
          <Icon d={I.search} size={14} color={C.textMuted} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher une route…"
            style={{ width:"100%", background:C.surface, border:`1px solid ${C.border}`, color:C.text, borderRadius:6,
              padding:"8px 10px 8px 34px", fontSize:13, fontFamily:"monospace", outline:"none", boxSizing:"border-box" }} />
        </div>
        <span style={{ color:C.textMuted, fontSize:12, whiteSpace:"nowrap" }}>{totalVisible} route{totalVisible>1?"s":""}</span>
        <Btn variant="primary" onClick={() => setShowNewRoute(true)}>
          <Icon d={I.plus} size={14} /> Nouvelle route
        </Btn>
      </div>

      {/* Nom du fichier ouvert */}
      {currentFile && (
        <div style={{ display:"flex", alignItems:"center", gap:8, background:C.accentDim, border:`1px solid ${C.accent}40`, borderRadius:6, padding:"6px 12px", marginBottom:12 }}>
          <Icon d={I.file} size={13} color={C.accent} />
          <span style={{ fontFamily:"monospace", fontSize:12, color:C.accent }}>{currentFile}</span>
        </div>
      )}

      {/* Dossiers + routes */}
      {rootFolders.map(f => renderFolder(f))}
      {rootRoutes.map(r => renderRoute(r))}

      {/* Routes sans structure (fallback) */}
      {rootChildren.length === 0 && state.routes.filter(matchesSearch).map(r => renderRoute(r))}

      {totalVisible === 0 && search && (
        <div style={{ textAlign:"center", padding:"40px 20px", color:C.textMuted, border:`1px dashed ${C.border}`, borderRadius:8 }}>
          Aucune route ne correspond à « {search} »
        </div>
      )}

      {showNewRoute && (
        <NewRouteModal
          state={state}
          setState={setState}
          onClose={() => setShowNewRoute(false)}
          onEdit={route => { setShowNewRoute(false); setEditingRoute(route); }}
        />
      )}
      {movingRoute && (
        <MoveRouteModal
          route={movingRoute}
          state={state}
          setState={setState}
          onClose={() => setMovingRoute(null)}
        />
      )}
      {deletingRoute && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, backdropFilter:"blur(4px)" }}>
          <div style={{ background:C.surface, border:`1px solid ${C.red}`, borderRadius:12, width:420, padding:28, boxShadow:"0 24px 80px rgba(0,0,0,.8)" }}>
            <div style={{ color:C.text, fontWeight:700, fontSize:15, marginBottom:12 }}>Supprimer la route ?</div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16, background:C.bg, borderRadius:8, padding:"10px 14px" }}>
              <MethodBadge method={deletingRoute.method} />
              <span style={{ fontFamily:"monospace", fontSize:13, color:C.textDim }}>{deletingRoute.path}</span>
            </div>
            <div style={{ color:C.textMuted, fontSize:13, marginBottom:20 }}>
              Cette action est irréversible. La route sera supprimée du fichier Mockoon.
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <Btn onClick={() => setDeletingRoute(null)}>Annuler</Btn>
              <Btn variant="danger" onClick={() => {
                setState(s => {
                  const envRaw = { ...(s._envRaw || {}) };
                  // Retire la route de rootChildren et de tous les dossiers
                  envRaw.rootChildren = (envRaw.rootChildren || []).filter(c => !(c.type==="route" && c.uuid===deletingRoute.uuid));
                  envRaw.folders = (envRaw.folders || []).map(f => ({
                    ...f,
                    children: (f.children||[]).filter(c => !(c.type==="route" && c.uuid===deletingRoute.uuid))
                  }));
                  const routes = s.routes.filter(x => x.uuid !== deletingRoute.uuid);
                  const newState = { ...s, _envRaw: envRaw, routes };
                  // Sauvegarde automatique
                  if (s._filePath) {
                    fetch(`${API}/api/write?path=${encodeURIComponent(s._filePath)}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ content: serializeMockoonFile(newState) }),
                    });
                  }
                  return newState;
                });
                setDeletingRoute(null);
              }}>
                <Icon d={I.trash} size={14} /> Supprimer
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MoveRouteModal = ({ route, state, setState, onClose }) => {
  const folderMap = Object.fromEntries((state._envRaw?.folders || []).map(f => [f.uuid, f]));
  const rootFolderUuids = new Set(
    (state._envRaw?.rootChildren || []).filter(c => c.type==="folder").map(c => c.uuid)
  );
  const rootFolders = (state._envRaw?.folders || [])
    .filter(f => rootFolderUuids.has(f.uuid))
    .map(f => ({
      ...f,
      subFolders: (f.children||[]).filter(c=>c.type==="folder").map(c=>folderMap[c.uuid]).filter(Boolean)
    }));

  const [targetId, setTargetId] = useState("root");

  // Trouve où est actuellement la route
  const currentLocation = () => {
    const rc = state._envRaw?.rootChildren || [];
    if (rc.find(c => c.type==="route" && c.uuid===route.uuid)) return "root";
    for (const f of state._envRaw?.folders || []) {
      if ((f.children||[]).find(c => c.type==="route" && c.uuid===route.uuid)) return f.uuid;
    }
    return "root";
  };

  const move = async () => {
    setState(s => {
      const envRaw = { ...(s._envRaw || {}) };

      envRaw.rootChildren = (envRaw.rootChildren || []).filter(c => !(c.type==="route" && c.uuid===route.uuid));
      envRaw.folders = (envRaw.folders || []).map(f => ({
        ...f,
        children: (f.children || []).filter(c => !(c.type==="route" && c.uuid===route.uuid))
      }));

      if (targetId === "root") {
        envRaw.rootChildren = [...envRaw.rootChildren, { type:"route", uuid:route.uuid }];
      } else {
        envRaw.folders = envRaw.folders.map(f => f.uuid === targetId
          ? { ...f, children: [...(f.children||[]), { type:"route", uuid:route.uuid }] }
          : f
        );
      }

      const filePath = s._filePath;
      if (filePath) {
        const content = serializeMockoonFile({ ...s, _envRaw: envRaw });
        fetch(`${API}/api/write?path=${encodeURIComponent(filePath)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
      }

      return { ...s, _envRaw: envRaw };
    });
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, backdropFilter:"blur(4px)" }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, width:480, boxShadow:"0 24px 80px rgba(0,0,0,.8)" }}>
        <div style={{ padding:"18px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <span style={{ color:C.text, fontWeight:700, fontSize:15, fontFamily:"monospace" }}>Déplacer la route</span>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <MethodBadge method={route.method} />
              <span style={{ fontFamily:"monospace", fontSize:12, color:C.textMuted }}>{route.path}</span>
            </div>
          </div>
          <Btn onClick={onClose} variant="ghost"><Icon d={I.x} /></Btn>
        </div>

        <div style={{ padding:24, display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ color:C.textMuted, fontSize:12, textTransform:"uppercase", letterSpacing:1 }}>
            Emplacement actuel : <span style={{ color:C.accent }}>
              {currentLocation() === "root" ? "Racine" : folderMap[currentLocation()]?.name || "Inconnu"}
            </span>
          </div>

          <div>
            <label style={{ color:C.textMuted, fontSize:12, display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>
              Nouvel emplacement
            </label>
            <select value={targetId} onChange={e => setTargetId(e.target.value)}
              style={{ width:"100%", background:C.bg, border:`1px solid ${C.accent}`, color:C.text,
                borderRadius:6, padding:"9px 12px", fontSize:13, fontFamily:"monospace", outline:"none", cursor:"pointer" }}>
              <option value="root">📄 Racine (sans dossier)</option>
                {rootFolders.map(f => (
                  f.subFolders.length > 0 ? (
                    <optgroup key={f.uuid} label={`📁 ${f.name}`}>
                      <option value={f.uuid}>📁 {f.name} (dossier racine)</option>
                      {f.subFolders.map(sf => (
                        <option key={sf.uuid} value={sf.uuid}>　📂 {sf.name}</option>
                      ))}
                    </optgroup>
                  ) : (
                    <option key={f.uuid} value={f.uuid}>📁 {f.name}</option>
                  )
                ))}
            </select>
          </div>
        </div>

        <div style={{ padding:"14px 24px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"flex-end", gap:10 }}>
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" onClick={move} disabled={targetId === currentLocation()}>
            <Icon d={I.move} size={14} /> Déplacer
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ─── New Route Modal ──────────────────────────────────────────────────────────
const NewRouteModal = ({ state, setState, onClose, onEdit }) => {
  const folderMap = Object.fromEntries((state._envRaw?.folders || []).map(f => [f.uuid, f]));
  
  // Arbre à 2 niveaux
  const rootFolderUuids = new Set(
    (state._envRaw?.rootChildren || []).filter(c => c.type==="folder").map(c => c.uuid)
  );
  const rootFolders = (state._envRaw?.folders || [])
    .filter(f => rootFolderUuids.has(f.uuid))
    .map(f => ({
      ...f,
      subFolders: (f.children||[]).filter(c=>c.type==="folder").map(c=>folderMap[c.uuid]).filter(Boolean)
    }));

  const [target, setTarget] = useState("root");      // root | existing | new-root | new-sub
  const [folderId, setFolderId] = useState(rootFolders[0]?.uuid || "");
  const [parentFolderId, setParentFolderId] = useState(rootFolders[0]?.uuid || "");
  const [newFolderName, setNewFolderName] = useState("");

  const create = () => {
    const newRoute = {
      uuid: mkUUID(), method:"GET", path:"/api/nouvelle-route", status:200, delay:0,
      enabled:true, description:"", headers:[{key:"Content-Type",value:"application/json"}],
      body: JSON.stringify({message:"OK"},null,2), _raw:null,
    };

    setState(s => {
      const envRaw = { ...(s._envRaw || {}) };
      let updatedFolders = [...(envRaw.folders || [])];
      let updatedRootChildren = [...(envRaw.rootChildren || [])];

      if (target === "root") {
        updatedRootChildren = [...updatedRootChildren, { type:"route", uuid:newRoute.uuid }];

      } else if (target === "existing" && folderId) {
        updatedFolders = updatedFolders.map(f => f.uuid === folderId
          ? { ...f, children: [...(f.children||[]), { type:"route", uuid:newRoute.uuid }] }
          : f
        );

      } else if (target === "new-root" && newFolderName.trim()) {
        const newFolder = { uuid:mkUUID(), name:newFolderName.trim(), collapsed:false, children:[{ type:"route", uuid:newRoute.uuid }] };
        updatedFolders = [...updatedFolders, newFolder];
        updatedRootChildren = [...updatedRootChildren, { type:"folder", uuid:newFolder.uuid }];

      } else if (target === "new-sub" && newFolderName.trim() && parentFolderId) {
        const newSubFolder = { uuid:mkUUID(), name:newFolderName.trim(), collapsed:false, children:[{ type:"route", uuid:newRoute.uuid }] };
        updatedFolders = [...updatedFolders, newSubFolder];
        // Ajoute le sous-dossier dans le parent
        updatedFolders = updatedFolders.map(f => f.uuid === parentFolderId
          ? { ...f, children: [...(f.children||[]), { type:"folder", uuid:newSubFolder.uuid }] }
          : f
        );
      }

      envRaw.folders = updatedFolders;
      envRaw.rootChildren = updatedRootChildren;
      return { ...s, _envRaw:envRaw, routes:[...s.routes, newRoute] };
    });

    onClose();
    onEdit(newRoute);
  };

  const OPTIONS = [
    { value:"root",     label:"Racine",              desc:"Sans dossier, à la racine" },
    { value:"existing", label:"Dossier existant",    desc:"Choisir un dossier ou sous-dossier" },
    { value:"new-root", label:"Nouveau dossier",     desc:"Créer un dossier racine" },
    { value:"new-sub",  label:"Nouveau sous-dossier",desc:"Créer un sous-dossier dans un dossier existant" },
  ];

  const isValid = () => {
    if (target === "existing") return !!folderId;
    if (target === "new-root") return !!newFolderName.trim();
    if (target === "new-sub") return !!newFolderName.trim() && !!parentFolderId;
    return true;
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:150, backdropFilter:"blur(4px)" }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, width:500, boxShadow:"0 24px 80px rgba(0,0,0,.8)" }}>
        <div style={{ padding:"18px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ color:C.text, fontWeight:700, fontSize:15, fontFamily:"monospace" }}>Nouvelle route</span>
          <Btn onClick={onClose} variant="ghost"><Icon d={I.x} /></Btn>
        </div>

        <div style={{ padding:24, display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ color:C.textMuted, fontSize:12, textTransform:"uppercase", letterSpacing:1 }}>Emplacement</div>

          {OPTIONS.map(opt => (
            <div key={opt.value} onClick={() => setTarget(opt.value)}
              style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
                background: target===opt.value ? C.accentDim : C.bg,
                border:`1px solid ${target===opt.value ? C.accent : C.border}`,
                borderRadius:8, cursor:"pointer", transition:"all .15s" }}>
              <div style={{ width:15, height:15, borderRadius:"50%", border:`2px solid ${target===opt.value?C.accent:C.textMuted}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {target===opt.value && <div style={{ width:7, height:7, borderRadius:"50%", background:C.accent }} />}
              </div>
              <div>
                <div style={{ color:C.text, fontSize:13, fontWeight:600 }}>{opt.label}</div>
                <div style={{ color:C.textMuted, fontSize:12 }}>{opt.desc}</div>
              </div>
            </div>
          ))}

          {/* Dossier existant — select groupé */}
          {target === "existing" && (
            <div>
              <label style={{ color:C.textMuted, fontSize:12, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Choisir l'emplacement</label>
              <select value={folderId} onChange={e => setFolderId(e.target.value)}
                style={{ width:"100%", background:C.bg, border:`1px solid ${C.accent}`, color:C.text,
                  borderRadius:6, padding:"9px 12px", fontSize:13, fontFamily:"monospace", outline:"none", cursor:"pointer" }}>
                {rootFolders.map(f => (
                  <optgroup key={f.uuid} label={`📁 ${f.name}`}>
                    <option value={f.uuid}>📁 {f.name} (dossier racine)</option>
                    {f.subFolders.map(sf => (
                      <option key={sf.uuid} value={sf.uuid}>　　📂 {sf.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {/* Nouveau dossier racine */}
          {target === "new-root" && (
            <div>
              <label style={{ color:C.textMuted, fontSize:12, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Nom du nouveau dossier</label>
              <Inp value={newFolderName} onChange={setNewFolderName} placeholder="ex: Users, Auth, Projects…" style={{ fontSize:14 }} />
            </div>
          )}

          {/* Nouveau sous-dossier */}
          {target === "new-sub" && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div>
                <label style={{ color:C.textMuted, fontSize:12, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Dossier parent</label>
                <select value={parentFolderId} onChange={e => setParentFolderId(e.target.value)}
                  style={{ width:"100%", background:C.bg, border:`1px solid ${C.accent}`, color:C.text,
                    borderRadius:6, padding:"9px 12px", fontSize:13, fontFamily:"monospace", outline:"none", cursor:"pointer" }}>
                  {rootFolders.map(f => (
                    <option key={f.uuid} value={f.uuid}>📁 {f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ color:C.textMuted, fontSize:12, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Nom du sous-dossier</label>
                <Inp value={newFolderName} onChange={setNewFolderName} placeholder="ex: generic-import-contact…" style={{ fontSize:14 }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ padding:"14px 24px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"flex-end", gap:10 }}>
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" onClick={create} disabled={!isValid()}>
            <Icon d={I.plus} size={14} /> Créer et éditer
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ─── Logs ─────────────────────────────────────────────────────────────────────
const Logs = ({ logs, onClear }) => (
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

// ─── Default state ────────────────────────────────────────────────────────────
const DEFAULT_STATE = parseMockoonFile(JSON.stringify({
  uuid: "default", lastMigration: 32, name: "Mon Projet API", port: 3000,
  routes: [
    { uuid: "r1", type:"http", documentation:"Liste tous les utilisateurs", method:"get", endpoint:"api/users", enabled:true, responseMode:null,
      responses:[{uuid:"rp1",label:"",statusCode:200,latency:0,bodyType:"INLINE",body:JSON.stringify([{id:1,name:"Alice"},{id:2,name:"Bob"}],null,2),headers:[{key:"Content-Type",value:"application/json",enabled:true}],rules:[],rulesOperator:"OR",disableTemplating:false,fallbackTo404:false,default:true,crudKey:"id",callbacks:[]}]},
    { uuid: "r2", type:"http", documentation:"Récupère un utilisateur", method:"get", endpoint:"api/users/:id", enabled:true, responseMode:null,
      responses:[{uuid:"rp2",label:"",statusCode:200,latency:0,bodyType:"INLINE",body:JSON.stringify({id:1,name:"Alice"},null,2),headers:[{key:"Content-Type",value:"application/json",enabled:true}],rules:[],rulesOperator:"OR",disableTemplating:false,fallbackTo404:false,default:true,crudKey:"id",callbacks:[]}]},
  ],
  rootChildren:[], proxyMode:false, proxyHost:"", proxyRemovePrefix:false,
  tlsOptions:{enabled:false,type:"CERT",pfxPath:"",certPath:"",keyPath:"",caPath:"",passphrase:""},
  cors:true, headers:[{key:"Content-Type",value:"application/json",enabled:true}],
  proxyReqHeaders:[], proxyResHeaders:[], data:[], folders:[], callbacks:[],
}));

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MockAPI() {
  const [state, setState] = useState(DEFAULT_STATE);
  const [serverRunning, setServerRunning] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [activeTab, setActiveTab] = useState("routes");
  const [logs, setLogs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [uptime, setUptime] = useState(0);
  const uptimeRef = useRef(null);

  useEffect(() => {
    const lastFile = localStorage.getItem("mockapi_last_file");
    if (!lastFile) return;
    fetch(`${API}/api/read?path=${encodeURIComponent(lastFile)}`)
      .then(r => r.json())
      .then(data => {
        if (data.content) {
          const parsed = parseMockoonFile(data.content);
          parsed._filePath = lastFile;
          setState(parsed);
        }
      })
      .catch(() => {}); // silencieux si le fichier n'existe plus
  }, []);

  useEffect(() => {
    if (serverRunning) { uptimeRef.current = setInterval(() => setUptime(u=>u+1), 1000); }
    else { clearInterval(uptimeRef.current); setUptime(0); }
    return () => clearInterval(uptimeRef.current);
  }, [serverRunning]);
  
  useEffect(() => {
   if (serverRunning) syncRoutes(state.routes);
  }, [state.routes, serverRunning]);

  const testRoute = async (route) => {
    if (!serverRunning) return;
    const start = Date.now();
    const res = await simulateRequest(state.routes, route.method, route.path);
    setLogs(l => [...l.slice(-199), { time: new Date().toLocaleTimeString("fr-FR"), method: route.method, path: route.path, status: res.status, ms: Date.now()-start }]);
  };

  const newRoute = () => setEditingRoute({ uuid:mkUUID(), method:"GET", path:"/api/nouvelle-route", status:200, delay:0, enabled:true, description:"", headers:[{key:"Content-Type",value:"application/json"}], body:JSON.stringify({message:"OK"},null,2), _raw:null });

  const saveRoute = (r) => {
    setState(s => {
      const idx = s.routes.findIndex(x => x.uuid === r.uuid);
      const routes = idx >= 0 ? s.routes.map(x => x.uuid===r.uuid?r:x) : [...s.routes, r];
      const newState = { ...s, routes };

      // Sauvegarde automatique
      if (s._filePath) {
        const content = serializeMockoonFile(newState);
        fetch(`${API}/api/write?path=${encodeURIComponent(s._filePath)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
      }

      return newState;
    });
    setEditingRoute(null);
  };

  const fmtUptime = s => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  const enabledCount = state.routes.filter(r=>r.enabled).length;

  const TABS = [
    { id:"routes", label:"Routes" },
    { id:"test",   label:"Tester" },
    { id:"json",   label:"Fichier Mockoon" },
    { id:"logs",   label:`Logs${logs.length>0?` (${logs.length})`:""}` },
  ];

  return (
    <div style={{ background:C.bg, minHeight:"100vh", fontFamily:"'Inter',system-ui,sans-serif", color:C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 24px", display:"flex", alignItems:"center", gap:16, height:60 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, background:C.accentDim, border:`1px solid ${C.accent}`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Icon d={I.server} size={16} color={C.accent} />
          </div>
          <span style={{ fontFamily:"monospace", fontWeight:700, fontSize:15, color:C.text }}>MockAPI</span>
          <span style={{ color:C.accent, fontSize:11, background:"#1a1f2e", border:`1px solid ${C.accent}40`, borderRadius:4, padding:"2px 7px" }}>Mockoon</span>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:12 }}>
          {serverRunning && <span style={{ color:C.textMuted, fontSize:12, fontFamily:"monospace" }}>{fmtUptime(uptime)} · <span style={{ color:C.green }}>{enabledCount}</span>/{state.routes.length}</span>}
          <div style={{ display:"flex", alignItems:"center", gap:8, background:serverRunning?C.greenDim:C.redDim, border:`1px solid ${serverRunning?"#166534":"#7f1d1d"}`, borderRadius:6, padding:"4px 10px" }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:serverRunning?C.green:C.red, animation:serverRunning?"pulse 1.5s ease-in-out infinite":"none" }} />
            <span style={{ color:serverRunning?C.green:C.red, fontSize:12, fontWeight:600 }}>{serverRunning?"En ligne":"Hors ligne"}</span>
          </div>
          <Btn variant={serverRunning?"danger":"success"} onClick={()=>setServerRunning(s=>!s)}>
            <Icon d={serverRunning?I.stop:I.play} size={14} />{serverRunning?"Arrêter":"Démarrer"}
          </Btn>
        </div>
      </div>

      {serverRunning && (
        <div style={{ background:C.greenDim, borderBottom:"1px solid #166534", padding:"6px 24px", display:"flex", alignItems:"center", gap:8 }}>
          <Icon d={I.link} size={13} color={C.green} />
          <span style={{ fontFamily:"monospace", fontSize:12, color:C.green }}>http://localhost:{state.port}</span>
          <span style={{ color:"#166534", fontSize:12 }}>— {enabledCount} route{enabledCount>1?"s":""} active{enabledCount>1?"s":""}</span>
        </div>
      )}

      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 24px", display:"flex", gap:4 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            style={{ background:"none", border:"none", cursor:"pointer", padding:"13px 16px", fontSize:13, fontWeight:600, color:activeTab===t.id?C.accent:C.textMuted, borderBottom:`2px solid ${activeTab===t.id?C.accent:"transparent"}`, fontFamily:"inherit", transition:"all .15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding:24, maxWidth:1100, margin:"0 auto" }}>
        {activeTab==="routes" && (
          <RoutesTab
            state={state}
            setState={setState}
            serverRunning={serverRunning}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            setEditingRoute={setEditingRoute}
            testRoute={testRoute}
            currentFile={state._filePath}
          />
        )}
        {activeTab==="test"   && <TestPanel routes={state.routes} serverRunning={serverRunning} />}
        {activeTab==="json"   && <MockoonTab state={state} onImport={imported=>setState(imported)} />}
        {activeTab==="logs"   && <Logs logs={logs} onClear={()=>setLogs([])} />}
      </div>

      {editingRoute && <RouteEditor route={editingRoute} onSave={saveRoute} onClose={()=>setEditingRoute(null)} />}
    </div>
  );
}
