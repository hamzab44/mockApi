export function mkUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const fromMockoonMethod = m => (m || "get").toUpperCase();
const toMockoonMethod   = m => m.toLowerCase();
const fromEndpoint      = e => (e.startsWith("/") ? e : `/${e}`);
const toEndpoint        = p => p.replace(/^\//, "");

export function fromMockoon(route) {
  const resp = (route.responses || [])[0] || {};
  return {
    uuid: route.uuid || mkUUID(),
    method: fromMockoonMethod(route.method),
    path: fromEndpoint(route.endpoint || ""),
    status: resp.statusCode || 200,
    delay: resp.latency || 0,
    enabled: route.enabled !== false,
    description: route.documentation || "",
    headers: (resp.headers || []).map(h => ({ key: h.key, value: h.value })),
    body: resp.body || "",
    _raw: route,
  };
}

export function toMockoon(r) {
  const base = r._raw || {};
  return {
    ...base,
    uuid: r.uuid, type: base.type || "http",
    documentation: r.description,
    method: toMockoonMethod(r.method),
    endpoint: toEndpoint(r.path),
    enabled: r.enabled !== false,
    responseMode: base.responseMode || null,
    responses: [{
      ...(base.responses?.[0] || {}),
      uuid: base.responses?.[0]?.uuid || mkUUID(),
      label: base.responses?.[0]?.label ?? r.label ?? "",
      statusCode: r.status, latency: r.delay || 0,
      body: r.body,
      headers: r.headers.map(h => ({ key: h.key, value: h.value, enabled: true })),
      bodyType: base.responses?.[0]?.bodyType || "INLINE",
      filePath: base.responses?.[0]?.filePath || "",
      sendFileAsBody: base.responses?.[0]?.sendFileAsBody || false,
      rules: base.responses?.[0]?.rules || [],
      rulesOperator: base.responses?.[0]?.rulesOperator || "OR",
      disableTemplating: base.responses?.[0]?.disableTemplating || false,
      fallbackTo404: base.responses?.[0]?.fallbackTo404 || false,
      default: base.responses?.[0]?.default !== undefined ? base.responses[0].default : true,
      ...(base.responses?.[0]?.crudKey !== undefined && { crudKey: base.responses[0].crudKey }),
      ...(base.responses?.[0]?.callbacks !== undefined && { callbacks: base.responses[0].callbacks }),
    }, ...(base.responses?.slice(1) || [])],
  };
}

export function parseMockoonFile(json) {
  const env = JSON.parse(json);
  return {
    _envRaw: env, _filePath: null,
    name: env.name || "Mon projet",
    port: env.port || 3000,
    routes: (env.routes || []).map(fromMockoon),
  };
}

export function serializeMockoonFile(state) {
  const base = state._envRaw || {};
  return JSON.stringify({
    ...base,
    uuid: base.uuid || mkUUID(),
    lastMigration: base.lastMigration || 32,
    name: state.name, port: state.port,
    routes: state.routes.map(toMockoon),
    rootChildren: base.rootChildren || state.routes.map(r => ({ type: "route", uuid: r.uuid })),
    proxyMode: base.proxyMode || false, proxyHost: base.proxyHost || "",
    proxyRemovePrefix: base.proxyRemovePrefix || false,
    tlsOptions: base.tlsOptions || { enabled: false, type: "CERT", pfxPath: "", certPath: "", keyPath: "", caPath: "", passphrase: "" },
    cors: base.cors !== undefined ? base.cors : true,
    headers: base.headers || [{ key: "Content-Type", value: "application/json", enabled: true }],
    proxyReqHeaders: base.proxyReqHeaders || [], proxyResHeaders: base.proxyResHeaders || [],
    data: base.data || [], folders: base.folders || [],
    ...(base.callbacks !== undefined && { callbacks: base.callbacks }),
  }, null, 2);
}
