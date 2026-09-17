'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'products.json');
const ANALYTICS_FILE = path.join(ROOT, 'analytics.json');
const ADMIN_DIR = path.join(ROOT, 'admin');
const IMAGES_DIR = path.join(ROOT, 'images');
const PORT = Number(process.env.PORT) || 3000;

/* Config — from environment or .env file */
const ENV_FILE = path.join(ROOT, '.env');
function loadEnv() {
  const env = {};
  try {
    const raw = fs.readFileSync(ENV_FILE, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && m[2]) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
    });
  } catch (e) { /* no .env */ }
  return env;
}
const ENV = loadEnv();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ENV.GEMINI_API_KEY || '';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || ENV.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ENV.ADMIN_PASSWORD || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET || ENV.ADMIN_SECRET || crypto.randomBytes(32).toString('hex');

/* ---------- Simple session auth ---------- */
const COOKIE_NAME = 'bs_admin';
const SESSION_TTL = 60 * 60 * 24 * 30; /* 30 days */

function parseCookies(req) {
  const out = {};
  const h = req.headers.cookie;
  if (h) h.split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > -1) out[c.slice(0, i).trim()] = c.slice(i + 1).trim();
  });
  return out;
}

function makeSessionToken(username) {
  const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + SESSION_TTL * 1000 })).toString('base64');
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('base64');
  return payload + '.' + sig;
}

function verifySession(req) {
  try {
    const tok = parseCookies(req)[COOKIE_NAME];
    if (!tok) return null;
    const dot = tok.indexOf('.');
    if (dot === -1) return null;
    const payload = tok.slice(0, dot);
    const sig = tok.slice(dot + 1);
    const expect = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('base64');
    if (sig !== expect) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    if (!data.u || data.exp < Date.now()) return null;
    return data.u;
  } catch (e) { return null; }
}

function isAuthed(req) {
  return verifySession(req) !== null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
};

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.products)) throw new Error('no products array');
    return data;
  } catch (err) {
    console.error('Failed to load products.json:', err.message);
    const fallback = { storeName: 'BAJWA SERJICAL', currency: '\u20a8', categories: [], products: [] };
    saveData(fallback);
    return fallback;
  }
}

let db = loadData();

function loadAnalytics() {
  try {
    const raw = fs.readFileSync(ANALYTICS_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data.productViews) data.productViews = {};
    if (!data.pageViews) data.pageViews = { total: 0, pages: {} };
    return data;
  } catch (err) {
    return { visitors: { total: 0, today: 0, todayDate: '', daily: {} }, sales: [], nextSaleId: 1, productViews: {}, pageViews: { total: 0, pages: {} } };
  }
}

let analytics = loadAnalytics();

function saveAnalytics() {
  const tmp = ANALYTICS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(analytics, null, 2), 'utf8');
  fs.renameSync(tmp, ANALYTICS_FILE);
}

function saveData() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function json(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 12e6) { reject(new Error('payload too large')); req.destroy(); }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function sanitizeProduct(input, id) {
  const num = (v, d = null) => (v === '' || v === null || v === undefined || Number.isNaN(+v)) ? d : +v;
  const clean = {
    id: id !== undefined ? +id : undefined,
    name: String(input.name || '').trim(),
    category: String(input.category || 'General').trim(),
    price: num(input.price, 0),
    priceMax: num(input.priceMax, null),
    regularPrice: num(input.regularPrice, null),
    rating: Math.min(5, Math.max(0, num(input.rating, null) || 0)),
    badge: input.badge ? String(input.badge).trim() : null,
    image: String(input.image || '').trim() || 'images/prod-cgm.png',
    desc: String(input.desc || '').trim(),
    tags: Array.isArray(input.tags) ? input.tags.filter(Boolean) : [],
  };
  if (id !== undefined) clean.id = +id;
  return clean;
}

function listImages() {
  try {
    return fs.readdirSync(IMAGES_DIR)
      .filter((f) => /\.(jpe?g|png|webp|gif|avif)$/i.test(f))
      .sort()
      .map((f) => 'images/' + f);
  } catch {
    return [];
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  /* ---------- Admin auth ---------- */
  if (p === '/api/admin/login' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const u = String(body.username || '').trim();
      const pw = String(body.password || '');
      if (!u || !pw) return json(res, 400, { error: 'Username and password required' });
      if (u !== ADMIN_USERNAME || pw !== ADMIN_PASSWORD) {
        return json(res, 401, { error: 'Invalid username or password' });
      }
      const token = makeSessionToken(u);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL}; SameSite=Lax`,
      });
      return res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (p === '/api/admin/logout' && req.method === 'POST') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
    });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (p === '/api/admin/logout' && req.method === 'GET') {
    res.writeHead(302, {
      'Location': '/admin',
      'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`,
    });
    return res.end();
  }

  if (p === '/api/admin/status' && req.method === 'GET') {
    return json(res, 200, { loggedIn: isAuthed(req) });
  }

  /* ---------- API ---------- */
  if (p === '/api/products' && req.method === 'GET') {
    return json(res, 200, db);
  }

  if (p === '/api/products' && req.method === 'POST') {
    if (!isAuthed(req)) return json(res, 401, { error: 'Admin login required' });
    try {
      const body = await readBody(req);
      const nextId = db.products.reduce((m, x) => Math.max(m, x.id), 0) + 1;
      const product = sanitizeProduct(body, nextId);
      if (!product.name) return json(res, 400, { error: 'Name is required' });
      db.products.push(product);
      saveData();
      console.log('Added product #' + product.id + ' — ' + product.name);
      return json(res, 201, product);
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  const m = p.match(/^\/api\/products\/(\d+)$/) || p.match(/^\/api\/product\/(\d+)$/);
  if (m) {
    const id = +m[1];
    const idx = db.products.findIndex((x) => x.id === id);
    if (idx === -1) return json(res, 404, { error: 'Product not found' });

    if (req.method === 'PUT') {
      if (!isAuthed(req)) return json(res, 401, { error: 'Admin login required' });
      try {
        const body = await readBody(req);
        const product = sanitizeProduct({ ...db.products[idx], ...body }, id);
        if (!product.name) return json(res, 400, { error: 'Name is required' });
        db.products[idx] = product;
        saveData();
        console.log('Updated product #' + id);
        return json(res, 200, product);
      } catch (err) {
        return json(res, 400, { error: err.message });
      }
    }

    if (req.method === 'DELETE') {
      if (!isAuthed(req)) return json(res, 401, { error: 'Admin login required' });
      db.products.splice(idx, 1);
      saveData();
      console.log('Deleted product #' + id);
      return json(res, 200, { ok: true, id });
    }

    if (req.method === 'GET') {
      return json(res, 200, db.products[idx]);
    }
  }

  if (p === '/api/images' && req.method === 'GET') {
    if (!isAuthed(req)) return json(res, 401, { error: 'Admin login required' });
    return json(res, 200, listImages());
  }

  if (p === '/api/health' && req.method === 'GET') {
    return json(res, 200, { ok: true, products: db.products.length });
  }

  /* ---------- Upload image ---------- */
  if (p === '/api/upload' && req.method === 'POST') {
    if (!isAuthed(req)) return json(res, 401, { error: 'Admin login required' });
    try {
      const body = await readBody(req);
      const filename = String(body.filename || '').replace(/[^a-z0-9._-]/gi, '_').replace(/^_+|_+$/g, '').trim();
      const base64 = String(body.data || '').replace(/^data:[^;]+;base64,/, '');
      if (!filename || !base64) return json(res, 400, { error: 'filename and data required' });
      if (filename.length > 120) return json(res, 400, { error: 'filename too long' });
      const buf = Buffer.from(base64, 'base64');
      if (buf.length > 8e6) return json(res, 400, { error: 'file too large (max 8MB)' });
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const dest = path.join(IMAGES_DIR, safeName);
      fs.writeFileSync(dest, buf);
      console.log('Uploaded image: ' + safeName + ' (' + buf.length + ' bytes)');
      return json(res, 200, { ok: true, filename: safeName, path: 'images/' + safeName });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  /* ---------- Analytics ---------- */
  if (p === '/api/analytics' && req.method === 'GET') {
    if (!isAuthed(req)) return json(res, 401, { error: 'Admin login required' });
    return json(res, 200, analytics);
  }

  if (p === '/api/analytics' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (body.type === 'visitor') {
        const today = new Date().toISOString().slice(0, 10);
        if (analytics.visitors.todayDate !== today) {
          analytics.visitors.today = 0;
          analytics.visitors.todayDate = today;
        }
        analytics.visitors.total = (analytics.visitors.total || 0) + 1;
        analytics.visitors.today = (analytics.visitors.today || 0) + 1;
        analytics.visitors.daily[today] = (analytics.visitors.daily[today] || 0) + 1;
        saveAnalytics();
        return json(res, 200, { ok: true, visitors: analytics.visitors });
      }
      if (body.type === 'productView') {
        const productId = String(body.productId || '');
        const productName = String(body.productName || '').trim();
        const today = new Date().toISOString().slice(0, 10);
        if (!analytics.productViews[productId]) {
          analytics.productViews[productId] = { name: productName, total: 0, daily: {} };
        }
        analytics.productViews[productId].total = (analytics.productViews[productId].total || 0) + 1;
        analytics.productViews[productId].daily[today] = (analytics.productViews[productId].daily[today] || 0) + 1;
        if (productName) analytics.productViews[productId].name = productName;
        saveAnalytics();
        return json(res, 200, { ok: true });
      }
      if (body.type === 'pageView') {
        const page = String(body.page || '/').trim();
        analytics.pageViews.total = (analytics.pageViews.total || 0) + 1;
        analytics.pageViews.pages[page] = (analytics.pageViews.pages[page] || 0) + 1;
        saveAnalytics();
        return json(res, 200, { ok: true });
      }
      if (body.type === 'sale') {
        if (!isAuthed(req)) return json(res, 401, { error: 'Admin login required' });
        const sale = {
          id: analytics.nextSaleId || 1,
          productId: +body.productId || 0,
          productName: String(body.productName || '').trim(),
          quantity: +body.quantity || 1,
          price: +body.price || 0,
          customer: String(body.customer || '').trim(),
          phone: String(body.phone || '').trim(),
          notes: String(body.notes || '').trim(),
          date: body.date || new Date().toISOString(),
        };
        if (!sale.productName) return json(res, 400, { error: 'Product name required' });
        analytics.sales.push(sale);
        analytics.nextSaleId = sale.id + 1;
        saveAnalytics();
        console.log('Sale recorded: #' + sale.id + ' — ' + sale.productName);
        return json(res, 201, sale);
      }
      return json(res, 400, { error: 'type must be "visitor" or "sale"' });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  const saleMatch = p.match(/^\/api\/sales\/(\d+)$/);
  if (saleMatch && req.method === 'DELETE') {
    if (!isAuthed(req)) return json(res, 401, { error: 'Admin login required' });
    const saleId = +saleMatch[1];
    const idx = analytics.sales.findIndex((s) => s.id === saleId);
    if (idx === -1) return json(res, 404, { error: 'Sale not found' });
    analytics.sales.splice(idx, 1);
    saveAnalytics();
    console.log('Deleted sale #' + saleId);
    return json(res, 200, { ok: true, id: saleId });
  }

  if (p === '/api/sales' && req.method === 'GET') {
    if (!isAuthed(req)) return json(res, 401, { error: 'Admin login required' });
    return json(res, 200, analytics.sales);
  }

  /* ---------- Gemini AI — Generate product description ---------- */
  if (p === '/api/gemini/describe' && req.method === 'POST') {
    if (!isAuthed(req)) return json(res, 401, { error: 'Admin login required' });
    try {
      const body = await readBody(req);
      const productName = String(body.productName || '').trim();
      const category = String(body.category || '').trim();
      const currentDesc = String(body.currentDesc || '').trim();
      const apiKey = String(body.apiKey || GEMINI_API_KEY || '').trim();
      if (!apiKey) return json(res, 400, { error: 'Gemini API key required. Set it in the admin panel, .env file, or as GEMINI_API_KEY env variable.' });
      if (!productName) return json(res, 400, { error: 'Product name is required' });

      const prompt = `You are a product description writer for "Bajwa Surgical" - a medical equipment store in Sahiwal, Pakistan. Write a professional, SEO-friendly product description (2-3 sentences) for this product. Be specific about features, benefits, and use cases. Do not use markdown or bullet points. Keep it concise and suitable for an e-commerce product page.\n\nProduct: ${productName}${category ? '\nCategory: ' + category : ''}${currentDesc ? '\nCurrent description (improve this): ' + currentDesc : ''}`;

      let description = '';
      let lastErr = '';
      for (let attempt = 0; attempt < 3 && !description; attempt++) {
        try {
          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } },
            }),
          });
          if (!geminiRes.ok) {
            const errData = await geminiRes.json().catch(() => ({}));
            lastErr = errData.error?.message || 'HTTP ' + geminiRes.status;
            continue;
          }
          const geminiData = await geminiRes.json();
          description = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        } catch (err) {
          lastErr = err.message;
        }
      }
      description = description.replace(/\*\*|\*|`/g, '').replace(/\s+/g, ' ').trim();
      if (!description) return json(res, 500, { error: lastErr || 'No description generated' });
      return json(res, 200, { ok: true, description });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  /* ---------- Store (front end) ---------- */
  if (p === '/' || p === '/index.html') {
    return serveFile(res, path.join(ROOT, 'index.html'));
  }

  /* ---------- Admin pages (login-gated) ---------- */
  if (p === '/admin' || p === '/admin/' || p === '/admin/index.html') {
    return serveFile(res, path.join(ADMIN_DIR, isAuthed(req) ? 'index.html' : 'login.html'));
  }
  if (p.startsWith('/admin/')) {
    const rel = p.replace(/^\/admin\//, '');
    let file = path.normalize(path.join(ADMIN_DIR, rel));
    if (!file.startsWith(ADMIN_DIR)) { res.writeHead(403); return res.end(); }
    if (/\.\./.test(rel)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, 'index.html');
    }
    if (path.basename(file) === 'index.html' && !isAuthed(req)) {
      file = path.join(ADMIN_DIR, 'login.html');
    }
    return serveFile(res, file);
  }

  /* ---------- Store static files ---------- */
  const rel = p.replace(/^\/+/, '');
  const file = path.normalize(path.join(ROOT, rel || 'index.html'));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    return serveFile(res, path.join(file, 'index.html'));
  }
  return serveFile(res, file);
});

function serveFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

server.listen(PORT, () => {
  console.log(`============================================`);
  console.log(`  BAJWA SERJICAL — Admin Panel`);
  console.log(`  Store:   http://127.0.0.1:${PORT}`);
  console.log(`  Admin:   http://127.0.0.1:${PORT}/admin`);
  console.log(`  API:     http://127.0.0.1:${PORT}/api/products`);
  console.log(`============================================`);
});