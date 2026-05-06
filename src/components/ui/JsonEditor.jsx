import { useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import { C } from "../../constants/theme.js";

export const JsonEditor = ({ value, onChange, height = 200 }) => {
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
