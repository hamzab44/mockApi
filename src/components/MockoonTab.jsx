import { useState, useRef, useEffect } from "react";
import { C, I } from "../constants/theme.js";
import { parseMockoonFile, serializeMockoonFile } from "../utils/mockoon.js";
import { Icon } from "./ui/Icon.jsx";
import { Btn } from "./ui/Btn.jsx";
import { FileExplorer } from "./FileExplorer.jsx";

const API = "http://localhost:3001";

export const MockoonTab = ({ state, onImport }) => {
  const [showExplorer, setShowExplorer] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [serverOk, setServerOk] = useState(null);
  const fileRef = useRef();

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
      localStorage.setItem("mockapi_last_file", filePath);
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1a1f2e", border: `1px solid ${serverOk ? C.accent : C.border}`, borderRadius: 8, padding: "10px 16px" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: serverOk === null ? C.yellow : serverOk ? C.green : C.red }} />
        <span style={{ color: serverOk ? C.accent : C.textMuted, fontSize: 13, fontWeight: 600 }}>
          {serverOk === null ? "Vérification du serveur de fichiers…" : serverOk ? "Serveur de fichiers connecté (port 3001)" : "Serveur de fichiers non disponible (port 3001)"}
        </span>
        <Icon d={I.layers} size={14} color={serverOk ? C.accent : C.textMuted} />
      </div>

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

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ color: C.textDim, fontSize: 13, fontWeight: 600 }}>Format Mockoon natif</div>
        <div style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.7 }}>
          • <b style={{ color: C.textDim }}>Parcourir WSL</b> — navigue dans tes dossiers Ubuntu et ouvre directement ton <code style={{ color: C.accent }}>.json</code> Mockoon<br/>
          • <b style={{ color: C.textDim }}>Ouvrir depuis Windows</b> — sélecteur de fichier classique (navigateur Windows)<br/>
          • <b style={{ color: C.textDim }}>Sauvegarder</b> — écrit les modifications directement dans le fichier ouvert<br/>
          • Le fichier reste <b style={{ color: C.textDim }}>100% compatible</b> avec Mockoon Desktop &amp; CLI
        </div>
      </div>

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
