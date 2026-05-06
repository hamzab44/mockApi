import { C } from "../../constants/theme.js";

export const Btn = ({ onClick, children, variant = "default", small, disabled, style: extra }) => {
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
