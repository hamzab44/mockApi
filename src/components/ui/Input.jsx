import { C } from "../../constants/theme.js";

export const Inp = ({ value, onChange, placeholder, style: extra, mono }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "7px 10px", fontSize: 13, fontFamily: mono ? "monospace" : "inherit", outline: "none", width: "100%", boxSizing: "border-box", ...extra }} />
);
