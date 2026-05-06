import { useState, useEffect } from "react";
import { C, I } from "../constants/theme.js";
import { Icon } from "./ui/Icon.jsx";
import { Btn } from "./ui/Btn.jsx";
import { Inp } from "./ui/Input.jsx";

const API = "http://localhost:3001";

export const FileExplorer = ({ onSelect, onClose }) => {
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

  useEffect(() => { browse("/home"); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  const up = () => {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    browse("/" + parts.join("/") || "/");
  };

  const crumbs = currentPath.split("/").filter(Boolean);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)" }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, width: 640, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,.9)" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon d={I.folder} size={16} color={C.accent} />
            <span style={{ color: C.text, fontWeight: 700, fontSize: 14, fontFamily: "monospace" }}>Explorateur de fichiers WSL</span>
          </div>
          <Btn onClick={onClose} variant="ghost"><Icon d={I.x} /></Btn>
        </div>

        <div style={{ padding: "10px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, alignItems: "center" }}>
          <Btn small variant="ghost" onClick={() => browse("/home")}><Icon d={I.home} size={14} /></Btn>
          <Btn small variant="ghost" onClick={up} disabled={currentPath === "/"}><Icon d={I.chevUp} size={14} /></Btn>
          <div style={{ flex: 1, display: "flex", gap: 4, alignItems: "center", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px" }}>
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

        <div style={{ padding: "8px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
          <Inp value={manualPath} onChange={setManualPath} placeholder="/chemin/vers/dossier" mono style={{ fontSize: 12 }} />
          <Btn small onClick={() => browse(manualPath)}>Go</Btn>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "8px 0" }}>
          {loading && <div style={{ padding: 20, textAlign: "center", color: C.textMuted, fontSize: 13 }}>Chargement…</div>}
          {error && <div style={{ padding: 16, color: C.red, fontSize: 13, background: C.redDim, margin: "8px 20px", borderRadius: 6 }}>⚠ {error}</div>}
          {!loading && entries.map((e, i) => (
            <div key={i}
              onClick={() => e.isDir ? browse(e.path) : (e.ext === ".json" && onSelect(e.path))}
              style={{ padding: "8px 20px", display: "flex", alignItems: "center", gap: 10, cursor: e.isDir || e.ext === ".json" ? "pointer" : "default", background: "transparent", transition: "background .1s", opacity: !e.isDir && e.ext !== ".json" ? 0.4 : 1 }}
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
