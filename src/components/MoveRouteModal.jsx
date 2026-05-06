import { useState } from "react";
import { C, I } from "../constants/theme.js";
import { serializeMockoonFile } from "../utils/mockoon.js";
import { Icon } from "./ui/Icon.jsx";
import { Btn } from "./ui/Btn.jsx";
import { MethodBadge } from "./ui/MethodBadge.jsx";

const API = "http://localhost:3001";

export const MoveRouteModal = ({ route, state, setState, onClose }) => {
  const folderMap = Object.fromEntries((state._envRaw?.folders || []).map(f => [f.uuid, f]));
  const rootFolderUuids = new Set(
    (state._envRaw?.rootChildren || []).filter(c => c.type==="folder").map(c => c.uuid)
  );
  const rootFolders = (state._envRaw?.folders || []).filter(f => rootFolderUuids.has(f.uuid));

  const [targetId, setTargetId] = useState("root");

  const currentLocation = () => {
    const rc = state._envRaw?.rootChildren || [];
    if (rc.find(c => c.type==="route" && c.uuid===route.uuid)) return "root";
    for (const f of state._envRaw?.folders || []) {
      if ((f.children||[]).find(c => c.type==="route" && c.uuid===route.uuid)) return f.uuid;
    }
    return "root";
  };

  const renderFolderOptions = (folder, depth) => {
    const prefix = "　".repeat(depth);
    const icon = depth === 0 ? "📁" : "📂";
    const subFolders = (folder.children||[])
      .filter(c => c.type==="folder")
      .map(c => folderMap[c.uuid])
      .filter(Boolean);
    return [
      <option key={folder.uuid} value={folder.uuid}>{prefix}{icon} {folder.name}</option>,
      ...subFolders.map(sf => renderFolderOptions(sf, depth + 1))
    ];
  };

  const move = async () => {
    setState(s => {
      const envRaw = { ...(s._envRaw || {}) };
      envRaw.rootChildren = (envRaw.rootChildren || []).filter(c => !(c.type==="route" && c.uuid===route.uuid));
      envRaw.folders = (envRaw.folders || []).map(f => ({
        ...f, children: (f.children || []).filter(c => !(c.type==="route" && c.uuid===route.uuid))
      }));
      if (targetId === "root") {
        envRaw.rootChildren = [...envRaw.rootChildren, { type:"route", uuid:route.uuid }];
      } else {
        envRaw.folders = envRaw.folders.map(f => f.uuid === targetId
          ? { ...f, children: [...(f.children||[]), { type:"route", uuid:route.uuid }] }
          : f
        );
      }
      const newState = { ...s, _envRaw: envRaw };
      if (s._filePath) {
        fetch(`${API}/api/write?path=${encodeURIComponent(s._filePath)}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: serializeMockoonFile(newState) }),
        });
      }
      return newState;
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
            <label style={{ color:C.textMuted, fontSize:12, display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>Nouvel emplacement</label>
            <select value={targetId} onChange={e => setTargetId(e.target.value)}
              style={{ width:"100%", background:C.bg, border:`1px solid ${C.accent}`, color:C.text, borderRadius:6, padding:"9px 12px", fontSize:13, fontFamily:"monospace", outline:"none", cursor:"pointer" }}>
              <option value="root">📄 Racine (sans dossier)</option>
              {rootFolders.map(f => renderFolderOptions(f, 0))}
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
