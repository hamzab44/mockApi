import { useState } from "react";
import { C, I } from "../constants/theme.js";
import { mkUUID, serializeMockoonFile } from "../utils/mockoon.js";
import { Icon } from "./ui/Icon.jsx";
import { Btn } from "./ui/Btn.jsx";
import { MethodBadge } from "./ui/MethodBadge.jsx";
import { StatusBadge } from "./ui/StatusBadge.jsx";
import { NewRouteModal } from "./NewRouteModal.jsx";
import { MoveRouteModal } from "./MoveRouteModal.jsx";

const API = "http://localhost:3001";

export const RoutesTab = ({ state, setState, serverRunning, selectedId, setSelectedId, setEditingRoute, testRoute, currentFile }) => {
  const [search, setSearch] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState(() => {
    try {
      const saved = localStorage.getItem("mockapi_collapsed_folders");
      if (saved) return JSON.parse(saved);
    } catch (e) { void e; }
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
      if (s._filePath) {
        fetch(`${API}/api/write?path=${encodeURIComponent(s._filePath)}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: serializeMockoonFile(newState) }),
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
            <span style={{ color:"#c084fc", fontSize:11, background:"#2d1b4e", borderRadius:4, padding:"1px 6px", fontFamily:"monospace" }}>
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
      return sfRoutes.some(matchesSearch) || (sf.children||[]).filter(c=>c.type==="folder").length > 0;
    });
    if (search && !hasVisibleContent) return null;

    const isCollapsed = collapsedFolders[folder.uuid] && !search;
    const indent = depth * 16;
    const folderColor = depth === 0 ? C.yellow : depth === 1 ? C.accent : "#c084fc";

    return (
      <div key={folder.uuid} style={{ marginBottom: depth===0 ? 8 : 4 }}>
        <div onClick={() => toggleFolder(folder.uuid)}
          style={{ display:"flex", alignItems:"center", gap:10, padding:`8px 12px 8px ${12+indent}px`,
            background: depth===0 ? C.surfaceHover : depth===1 ? "#1a1f2e" : "#141820",
            border:`1px solid ${depth===0 ? C.border : C.border+"60"}`,
            borderRadius: isCollapsed ? 8 : "8px 8px 0 0", cursor:"pointer", userSelect:"none" }}>
          <Icon d={isCollapsed ? I.chevRight : I.chevDown} size={13} color={folderColor} />
          <Icon d={I.folderClosed} size={14} color={folderColor} />
          <span style={{ color:C.textDim, fontWeight:600, fontSize:depth===0?13:12, flex:1 }}>{folder.name}</span>
          {subFolders.length > 0 && (
            <span style={{ color:C.textMuted, fontSize:11, background:C.bg, borderRadius:4, padding:"1px 6px", fontFamily:"monospace" }}>
              {subFolders.length} 📁
            </span>
          )}
          <span style={{ color:C.textMuted, fontSize:11, background:C.bg, borderRadius:4, padding:"1px 7px", fontFamily:"monospace" }}>
            {visibleRoutes.length} route{visibleRoutes.length>1?"s":""}
          </span>
        </div>
        {!isCollapsed && (
          <div style={{ border:`1px solid ${C.border}`, borderTop:"none", borderRadius:"0 0 8px 8px",
            padding:`8px 8px 4px ${8+indent}px`,
            background: depth===0 ? "#0f111a" : depth===1 ? "#0c0e14" : "#09090f" }}>
            {folderRoutes.map(r => renderRoute(r))}
            {subFolders.map(sf => renderFolder(sf, depth + 1))}
            {folderRoutes.length === 0 && subFolders.length === 0 && (
              <div style={{ color:C.textMuted, fontSize:12, padding:"10px 8px", fontStyle:"italic" }}>Dossier vide</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const rootRoutes = rootChildren.filter(c => c.type==="route").map(c => routeMap[c.uuid]).filter(Boolean);
  const rootFoldersList = rootChildren.filter(c => c.type==="folder").map(c => folderMap[c.uuid]).filter(Boolean);
  const totalVisible = state.routes.filter(matchesSearch).length;

  return (
    <div>
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

      {currentFile && (
        <div style={{ display:"flex", alignItems:"center", gap:8, background:C.accentDim, border:`1px solid ${C.accent}40`, borderRadius:6, padding:"6px 12px", marginBottom:12 }}>
          <Icon d={I.file} size={13} color={C.accent} />
          <span style={{ fontFamily:"monospace", fontSize:12, color:C.accent }}>{currentFile}</span>
        </div>
      )}

      {rootFoldersList.map(f => renderFolder(f))}
      {rootRoutes.map(r => renderRoute(r))}
      {rootChildren.length === 0 && state.routes.filter(matchesSearch).map(r => renderRoute(r))}

      {totalVisible === 0 && search && (
        <div style={{ textAlign:"center", padding:"40px 20px", color:C.textMuted, border:`1px dashed ${C.border}`, borderRadius:8 }}>
          Aucune route ne correspond à « {search} »
        </div>
      )}

      {showNewRoute && (
        <NewRouteModal state={state} setState={setState}
          onClose={() => setShowNewRoute(false)}
          onEdit={route => { setShowNewRoute(false); setEditingRoute(route); }} />
      )}
      {movingRoute && (
        <MoveRouteModal route={movingRoute} state={state} setState={setState}
          onClose={() => setMovingRoute(null)} />
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
                  envRaw.rootChildren = (envRaw.rootChildren || []).filter(c => !(c.type==="route" && c.uuid===deletingRoute.uuid));
                  envRaw.folders = (envRaw.folders || []).map(f => ({
                    ...f, children: (f.children||[]).filter(c => !(c.type==="route" && c.uuid===deletingRoute.uuid))
                  }));
                  const routes = s.routes.filter(x => x.uuid !== deletingRoute.uuid);
                  const newState = { ...s, _envRaw: envRaw, routes };
                  if (s._filePath) {
                    fetch(`${API}/api/write?path=${encodeURIComponent(s._filePath)}`, {
                      method: "POST", headers: { "Content-Type": "application/json" },
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
