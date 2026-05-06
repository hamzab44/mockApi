import { C } from "../../constants/theme.js";

export const Sel = ({ value, onChange, options, style: extra }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "7px 10px", fontSize: 13, outline: "none", ...extra }}>
    {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
  </select>
);
