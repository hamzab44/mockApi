const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// CORS headers sur toutes les réponses
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS');
  res.set('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Gère HEAD comme GET mais sans corps
app.use((req, res, next) => {
  if (req.method === 'HEAD') {
    req.method = 'GET';
    const originalSend = res.send;
    res.send = function(body) {
      res.send = originalSend;
      return res.sendStatus(res.statusCode || 200);
    };
  }
  next();
});

// ─── File API ─────────────────────────────────────────────────────────────────
app.get('/api/files', (req, res) => {
  const dirPath = req.query.path || '/home';
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      .map(e => ({
        name: e.name, isDir: e.isDirectory(),
        path: path.join(dirPath, e.name),
        ext: e.isDirectory() ? null : path.extname(e.name).toLowerCase(),
      }))
      .filter(e => !e.name.startsWith('.'))
      .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    res.json({ path: dirPath, entries });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/read', (req, res) => {
  try {
    const content = fs.readFileSync(req.query.path, 'utf8');
    res.json({ path: req.query.path, content });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/write', (req, res) => {
  try {
    fs.writeFileSync(req.query.path, req.body.content, 'utf8');
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ─── Mock routes storage ──────────────────────────────────────────────────────
let mockRoutes = [];

app.post('/api/mock/load', (req, res) => {
  mockRoutes = req.body.routes || [];
  console.log(`✓ ${mockRoutes.length} routes Mockoon chargées`);
  res.json({ success: true, count: mockRoutes.length });
});

// ─── Rules engine ─────────────────────────────────────────────────────────────
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    // Supporte les index de tableau : refundList.0.date
    const index = parseInt(key);
    if (!isNaN(index) && Array.isArray(current)) return current[index];
    return current[key];
  }, obj);
}

function evaluateRule(rule, req, urlParams) {
  const { target, modifier, value, operator, invert } = rule;
  let actual = null;

  if (target === 'params')  actual = urlParams[modifier] || req.query[modifier];
  if (target === 'query')   actual = req.query[modifier];
  if (target === 'body')    actual = getNestedValue(req.body, modifier);
  if (target === 'header')  actual = req.headers[modifier?.toLowerCase()];

  if (actual === null || actual === undefined) return invert ? true : false;

  const cleanValue = (v) => {
    if (typeof v !== 'string') return String(v);
    // Retire les guillemets JSON superflus : "\"valeur\"" => "valeur"
    if (v.startsWith('"') && v.endsWith('"')) {
      try { return JSON.parse(v); } catch {}
    }
    return v;
  };

  // Convertit en string pour la comparaison
  const actualStr = String(actual);
  const valueStr = cleanValue(value);

  let match = false;
  if (operator === 'equals')    match = actualStr === valueStr;
  if (operator === 'contains')  match = actualStr.includes(valueStr);
  if (operator === 'regex')     { try { match = new RegExp(valueStr).test(actualStr); } catch { match = false; } }
  if (operator === 'empty')     match = !actual || actualStr === '';
  if (operator === 'not_empty') match = !!actual && actualStr !== '';

  return invert ? !match : match;
}

function findMatchingResponse(route, req, urlParams) {
  const responses = route.responses || [];

  console.log('--- Matching route:', route.endpoint);
  console.log('Body reçu:', JSON.stringify(req.body));

  for (const resp of responses) {
    if (resp.default) continue;
    const rules = resp.rules || [];
    if (rules.length === 0) continue;

    const op = resp.rulesOperator || 'OR';
    const results = rules.map(r => {
      const result = evaluateRule(r, req, urlParams);
      console.log(`  Règle [${r.target}][${r.modifier}] ${r.operator} "${r.value}" => actual="${getNestedValue(req.body, r.modifier)}" => ${result}`);
      return result;
    });
    const match = op === 'AND' ? results.every(Boolean) : results.some(Boolean);
    console.log(`  Réponse "${resp.label}" (${op}): ${match}`);
    if (match) return resp;
  }

  const def = responses.find(r => r.default);
  if (def) return def;
  return responses[0] || null;
}

// ─── Mock middleware ──────────────────────────────────────────────────────────
app.use((req, res) => {
  const method = req.method === 'HEAD' ? 'get' : req.method.toLowerCase();
  const reqPath = req.path.replace(/^\//, '');

  // Trouve la route qui matche le path et la méthode
  let matchedRoute = null;
  let urlParams = {};

  for (const route of mockRoutes) {
    if (!route.enabled) continue;
    if ((route.method || '').toLowerCase() !== method) continue;

    const endpoint = (route.endpoint || '').replace(/^\//, '');
    const pattern = endpoint.replace(/:[\w]+/g, '([^/]+)');
    const paramNames = [...endpoint.matchAll(/:(\w+)/g)].map(m => m[1]);
    const regex = new RegExp(`^${pattern}$`);
    const match = reqPath.match(regex);

    if (match) {
      matchedRoute = route;
      paramNames.forEach((name, i) => { urlParams[name] = match[i + 1]; });
      break;
    }
  }

  if (!matchedRoute) {
    return res.status(404).json({ error: `Route non trouvée : ${req.method} /${reqPath}` });
  }

  const resp = findMatchingResponse(matchedRoute, req, urlParams);
  if (!resp) return res.status(404).json({ error: 'Aucune réponse disponible' });

  const delay = resp.latency || 0;
  setTimeout(() => {
    (resp.headers || []).forEach(h => { if (h.enabled !== false) res.set(h.key, h.value); });
    res.status(resp.statusCode || 200).send(resp.body || '');
  }, delay);
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ MockAPI server running on http://localhost:${PORT}`);
});
