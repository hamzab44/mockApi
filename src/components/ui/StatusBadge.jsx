import { C } from "../../constants/theme.js";

export const StatusBadge = ({ code }) => {
  const color = code < 300 ? C.green : code < 400 ? C.yellow : C.red;
  const bg = code < 300 ? C.greenDim : code < 400 ? "#3d3000" : C.redDim;
  return <span style={{ background: bg, color, borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>{code}</span>;
};
