import { METHOD_COLORS } from "../../constants/theme.js";

export const MethodBadge = ({ method }) => {
  const mc = METHOD_COLORS[method] || METHOD_COLORS.GET;
  return <span style={{ background: mc.bg, color: mc.text, border: `1px solid ${mc.border}`, borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap" }}>{method}</span>;
};
