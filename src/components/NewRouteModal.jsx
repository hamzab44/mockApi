import { useState } from "react";
import { C, I } from "../constants/theme.js";
import { mkUUID } from "../utils/mockoon.js";
import { Icon } from "./ui/Icon.jsx";
import { Btn } from "./ui/Btn.jsx";
import { Inp } from "./ui/Input.jsx";

export const NewRouteModal = ({ state, setState, onClose, onEdit }) => {
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

  const [target, setTarget] = useState("root");
  const [folderId, setFolderId] = useState(rootFolders[0]?.uuid || "");
  const [parentFolderId, setParentFolderId] = useState(rootFolders[0]?.uuid || "");
  const [newFolderName, setNewFolderName] = useState("");

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
    { value:"root",     label:"Racine",               desc:"Sans dossier, à la racine" },
    { value:"existing", label:"Dossier existant",     desc:"Choisir un dossier ou sous-dossier" },
    { value:"new-root", label:"Nouveau dossier",      desc:"Créer un dossier racine" },
    { value:"new-sub",  label:"Nouveau sous-dossier", desc:"Créer un sous-dossier dans un dossier existant" },
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
          {target === "existing" && (
            <div>
              <label style={{ color:C.textMuted, fontSize:12, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Choisir l'emplacement</label>
              <select value={folderId} onChange={e => setFolderId(e.target.value)}
                style={{ width:"100%", background:C.bg, border:`1px solid ${C.accent}`, color:C.text, borderRadius:6, padding:"9px 12px", fontSize:13, fontFamily:"monospace", outline:"none", cursor:"pointer" }}>
                {rootFolders.map(f => renderFolderOptions(f, 0))}
              </select>
            </div>
          )}
          {target === "new-root" && (
            <div>
              <label style={{ color:C.textMuted, fontSize:12, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Nom du nouveau dossier</label>
              <Inp value={newFolderName} onChange={setNewFolderName} placeholder="ex: Users, Auth, Projects…" style={{ fontSize:14 }} />
            </div>
          )}
          {target === "new-sub" && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div>
                <label style={{ color:C.textMuted, fontSize:12, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Dossier parent</label>
                <select value={parentFolderId} onChange={e => setParentFolderId(e.target.value)}
                  style={{ width:"100%", background:C.bg, border:`1px solid ${C.accent}`, color:C.text, borderRadius:6, padding:"9px 12px", fontSize:13, fontFamily:"monospace", outline:"none", cursor:"pointer" }}>
                  {rootFolders.map(f => renderFolderOptions(f, 0))}
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
