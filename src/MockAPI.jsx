import { useState, useRef, useEffect } from "react";
import { VERSION } from "./version.js";
import { C, I } from "./constants/theme.js";
import { parseMockoonFile, serializeMockoonFile } from "./utils/mockoon.js";
import { simulateRequest } from "./utils/simulate.js";
import { Icon } from "./components/ui/Icon.jsx";
import { Btn } from "./components/ui/Btn.jsx";
import { RoutesTab } from "./components/RoutesTab.jsx";
import { RouteEditor } from "./components/RouteEditor.jsx";
import { TestPanel } from "./components/TestPanel.jsx";
import { MockoonTab } from "./components/MockoonTab.jsx";
import { Logs } from "./components/Logs.jsx";

const API = "http://localhost:3001";

async function syncRoutes(routes) {
  try {
    await fetch(`${API}/api/mock/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routes: routes.map(r => r._raw || r) }),
    });
  } catch (e) { console.warn("Sync failed", e); }
}

const DEFAULT_STATE = parseMockoonFile(JSON.stringify({
  uuid: "default", lastMigration: 32, name: "Mon Projet API", port: 3000,
  routes: [
    { uuid: "r1", type:"http", documentation:"Liste tous les utilisateurs", method:"get", endpoint:"api/users", enabled:true, responseMode:null,
      responses:[{uuid:"rp1",label:"",statusCode:200,latency:0,bodyType:"INLINE",body:JSON.stringify([{id:1,name:"Alice"},{id:2,name:"Bob"}],null,2),headers:[{key:"Content-Type",value:"application/json",enabled:true}],rules:[],rulesOperator:"OR",disableTemplating:false,fallbackTo404:false,default:true}]},
    { uuid: "r2", type:"http", documentation:"Récupère un utilisateur", method:"get", endpoint:"api/users/:id", enabled:true, responseMode:null,
      responses:[{uuid:"rp2",label:"",statusCode:200,latency:0,bodyType:"INLINE",body:JSON.stringify({id:1,name:"Alice"},null,2),headers:[{key:"Content-Type",value:"application/json",enabled:true}],rules:[],rulesOperator:"OR",disableTemplating:false,fallbackTo404:false,default:true}]},
  ],
  rootChildren:[], proxyMode:false, proxyHost:"", proxyRemovePrefix:false,
  tlsOptions:{enabled:false,type:"CERT",pfxPath:"",certPath:"",keyPath:"",caPath:"",passphrase:""},
  cors:true, headers:[{key:"Content-Type",value:"application/json",enabled:true}],
  proxyReqHeaders:[], proxyResHeaders:[], data:[], folders:[],
}));

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
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (serverRunning) {
      uptimeRef.current = setInterval(() => setUptime(u => u + 1), 1000);
    } else {
      clearInterval(uptimeRef.current);
      uptimeRef.current = null;
    }
    return () => clearInterval(uptimeRef.current);
  }, [serverRunning]);

  useEffect(() => {
    if (serverRunning) syncRoutes(state.routes);
  }, [state.routes, serverRunning]);

  const testRoute = async (route) => {
    if (!serverRunning) return;
    const start = Date.now();
    const res = await simulateRequest(state.routes, route.method, route.path);
    setLogs(l => [...l.slice(-199), {
      time: new Date().toLocaleTimeString("fr-FR"),
      method: route.method, path: route.path,
      status: res.status, ms: Date.now() - start,
    }]);
  };

  const saveRoute = (r) => {
    setState(s => {
      const idx = s.routes.findIndex(x => x.uuid === r.uuid);
      const routes = idx >= 0 ? s.routes.map(x => x.uuid===r.uuid?r:x) : [...s.routes, r];
      const newState = { ...s, routes };
      if (s._filePath) {
        fetch(`${API}/api/write?path=${encodeURIComponent(s._filePath)}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: serializeMockoonFile(newState) }),
        });
      }
      return newState;
    });
    setEditingRoute(null);
  };

  const fmtUptime = s => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  const enabledCount = state.routes.filter(r => r.enabled).length;

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
          <span style={{ color:C.textMuted, fontSize:11, fontFamily:"monospace" }}>v{VERSION}</span>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:12 }}>
          {serverRunning && (
            <span style={{ color:C.textMuted, fontSize:12, fontFamily:"monospace" }}>
              {fmtUptime(uptime)} · <span style={{ color:C.green }}>{enabledCount}</span>/{state.routes.length}
            </span>
          )}
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
          <RoutesTab state={state} setState={setState} serverRunning={serverRunning}
            selectedId={selectedId} setSelectedId={setSelectedId}
            setEditingRoute={setEditingRoute} testRoute={testRoute}
            currentFile={state._filePath} />
        )}
        {activeTab==="test" && <TestPanel routes={state.routes} serverRunning={serverRunning} />}
        {activeTab==="json" && <MockoonTab state={state} onImport={imported=>setState(imported)} />}
        {activeTab==="logs" && <Logs logs={logs} onClear={()=>setLogs([])} />}
      </div>

      {editingRoute && <RouteEditor route={editingRoute} onSave={saveRoute} onClose={()=>setEditingRoute(null)} />}
    </div>
  );
}
