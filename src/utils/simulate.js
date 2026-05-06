function matchRoute(routes, method, path) {
  for (const r of routes) {
    if (!r.enabled || r.method !== method) continue;
    const pattern = r.path.replace(/:[\w]+/g, "([^/]+)");
    if (new RegExp(`^${pattern}$`).test(path)) return r;
  }
  return null;
}

export async function simulateRequest(routes, method, path) {
  const r = matchRoute(routes, method, path);
  if (!r) return { status: 404, body: JSON.stringify({ error: "Route non trouvée" }), headers: [], delay: 0 };
  if (r.delay > 0) await new Promise(res => setTimeout(res, r.delay));
  return { status: r.status, body: r.body, headers: r.headers, delay: r.delay };
}
