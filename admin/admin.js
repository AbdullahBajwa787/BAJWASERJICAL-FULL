(function () {
  'use strict';

  const API = 'http://127.0.0.1:3000';
  let data = { storeName: '', currency: '\u20a8', categories: [], products: [] };
  let images = [];
  let analytics = { visitors: { total: 0, today: 0, todayDate: '', daily: {} }, sales: [] };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  async function apiFetch(url, opts) {
    const res = await apiFetch(url, opts);
    if (res.status === 401) {
      location.href = API + '/admin';
      throw new Error('Admin login required');
    }
    return res;
  }

  const tbody = $('#tbody');
  const emptyEl = $('#empty');
  const searchEl = $('#search');
  const filterCat = $('#filterCat');
  const filterTag = $('#filterTag');
  const resultCount = $('#resultCount');

  const fmt = (n) => { if (n == null || n === '' || Number.isNaN(+n)) return '\u20a8 \u2014'; var v = Math.round(+n); if (!isFinite(v)) return '\u20a8 \u2014'; return '\u20a8 ' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  const fmtNum = (n) => {
    if (n == null || n === '' || Number.isNaN(+n)) return '\u2014';
    var v = Math.round(+n);
    if (!isFinite(v)) return '\u2014';
    return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  const fmtDate = (d) => { const x = new Date(d); if (isNaN(x.getTime())) return '\u2014'; const padd = (n) => (n < 10 ? '0' + n : '' + n); return padd(x.getDate()) + '/' + padd(x.getMonth() + 1) + '/' + x.getFullYear(); };

  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'ok');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, 2600);
  }

  function setApiStatus(ok) {
    const el = $('#apiPulse');
    el.classList.toggle('on', ok);
    el.classList.toggle('err', !ok);
    $('#apiStatus').textContent = ok
      ? 'Connected Â· ' + data.products.length + ' products'
      : 'Offline â€” products.json not found';
  }

  async function fetchData() {
    const res = await apiFetch(API + '/api/products');
    if (!res.ok) throw new Error('bad status');
    return res.json();
  }

  async function loadImages() {
    try {
      const res = await apiFetch(API + '/api/images');
      if (res.ok) images = await res.json();
    } catch (e) { images = []; }
  }

  async function fetchAnalytics() {
    try {
      const res = await apiFetch(API + '/api/analytics');
      if (res.ok) analytics = await res.json();
    } catch (e) { /* keep last */ }
  }

  let retryTimer = null;

  async function load() {
    try {
      data = await fetchData();
      setApiStatus(true);
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    } catch (e) {
      setApiStatus(false);
      data = { storeName: 'BAJWA SERJICAL', currency: '\u20a8', categories: [], products: [] };
      if (e && e.message !== 'Admin login required' && !retryTimer) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          loadImages().then(load).then(fetchAnalytics);
        }, 8000);
      }
    }
    renderStats();
    renderFilters();
    render();
  }

  /* ---------- Stats ---------- */
  function animateCount(el, to) {
    const dur = 650, t0 = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmtNum(Math.round(eased * to));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderStats() {
    const p = data.products;
    const onSale = p.filter((x) => x.regularPrice && x.regularPrice > x.price);
    const minP = p.length ? Math.min.apply(null, p.map((x) => x.price)) : 0;
    const maxP = p.length ? Math.max.apply(null, p.map((x) => x.price)) : 0;
    const stats = [
      { num: '<b data-count="' + p.length + '">0</b>', lbl: 'Total products', sub: data.categories.length + ' categories' },
      { num: '<b data-count="' + onSale.length + '">0</b><small> / ' + p.length + '</small>', lbl: 'On sale', sub: 'with discount' },
      { num: '<span data-plain>' + fmt(minP) + '</span>', lbl: 'Cheapest item', sub: 'from' },
      { num: '<span data-plain>' + fmt(maxP) + '</span>', lbl: 'Most expensive', sub: 'top price' },
    ];
    $('#stats').innerHTML = stats.map((s, i) =>
      '<div class="stat" style="animation-delay:' + (i * 70) + 'ms">' +
      '<span class="num">' + s.num + '</span><span class="lbl">' + s.lbl + '</span><span class="sub">' + s.sub + '</span></div>'
    ).join('');
    $('#stats').querySelectorAll('[data-count]').forEach((el) => animateCount(el, +el.dataset.count));
    $('#subtitle').textContent = p.length + ' products Â· saved to products.json';
  }

  /* ---------- Filters ---------- */
  function renderFilters() {
    filterCat.innerHTML = '<option value="">All categories</option>' +
      data.categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')
      + data.products.map((x) => x.category).filter((c, i, a) => a.indexOf(c) === i)
        .filter((c) => data.categories.indexOf(c) === -1)
        .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    $('#catList').innerHTML = data.categories.map((c) => `<option value="${esc(c)}"></option>`).join('');
  }

  /* ---------- Table ---------- */
  function visible() {
    const q = searchEl.value.trim().toLowerCase();
    const cat = filterCat.value;
    const tag = filterTag.value;
    return data.products.filter((p) => {
      if (q && !(p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))) return false;
      if (cat && p.category !== cat) return false;
      if (tag && !(p.tags || []).includes(tag)) return false;
      return true;
    });
  }

  function render() {
    const list = visible();
    emptyEl.hidden = list.length > 0;
    resultCount.textContent = list.length + ' shown';
    tbody.innerHTML = list.map((p, i) => {
      const off = p.regularPrice && p.regularPrice > p.price
        ? Math.round((1 - p.price / p.regularPrice) * 100) + '%'
        : null;
      const tagsRow = ['best', 'bestseller', 'latest', 'recent', 'surgical'].map((t) =>
        `<span class="tag-chip ${t}${(p.tags || []).includes(t) ? ' on' : ''}">${t}</span>`).join('');
      const stars = p.rating
        ? '<span class="stars">' + 'â˜…'.repeat(Math.round(p.rating)).padEnd(5, 'â˜†') + '</span>'
        : '<span class="stars" style="opacity:.35">â˜†â˜†â˜†â˜†â˜†</span>';
      return `<tr style="animation-delay:${Math.min(i, 12) * 35}ms">
        <td><div class="cell-prod"><img src="${p.image}" alt="" onerror="this.src='images/prod-cgm.png'"><div><p class="p-name">${esc(p.name)}</p><span class="p-id">#${p.id}${p.badge ? ' Â· ' + esc(p.badge) : ''}</span></div></div></td>
        <td><span class="cat-tag">${esc(p.category)}</span></td>
        <td><span class="price-now">${fmt(p.price)}${p.priceMax ? ' â€“ ' + fmt(p.priceMax) : ''}</span></td>
        <td>${p.regularPrice ? `<span class="price-old">${fmt(p.regularPrice)}</span>` : 'â€”'}</td>
        <td>${off ? `<span class="off-pill">-${off}</span>` : '<span class="off-pill zero">â€”</span>'}</td>
        <td>${stars}</td>
        <td><div class="tag-chips">${tagsRow}</div></td>
        <td class="ta-r"><div class="actions">
          <button class="icon-btn" data-act="edit" data-id="${p.id}" title="Edit">âœŽ</button>
          <button class="icon-btn del" data-act="del" data-id="${p.id}" title="Delete">ðŸ—‘</button>
        </div></td>
      </tr>`;
    }).join('');
  }

  searchEl.addEventListener('input', render);
  filterCat.addEventListener('change', render);
  filterTag.addEventListener('change', render);
  $('#refreshBtn').addEventListener('click', () => { load(); toast('Refreshed from server', 'ok'); });

  /* ---------- Table actions ---------- */
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = +btn.dataset.id;
    const product = data.products.find((x) => x.id === id);
    if (!product) return;
    if (btn.dataset.act === 'edit') openModal(product);
    if (btn.dataset.act === 'del') askDelete(product);
  });

  /* ---------- Modal ---------- */
  const overlay = $('#modalOverlay');
  const form = $('#productForm');

  function openModal(product) {
    $('#modalTitle').textContent = product ? 'Edit Product #' + product.id : 'Add Product';
    $('#fId').value = product ? product.id : '';
    $('#fName').value = product ? product.name : '';
    $('#fCategory').value = product ? product.category : '';
    $('#fPrice').value = product ? product.price : '';
    $('#fPriceMax').value = product && product.priceMax ? product.priceMax : '';
    $('#fRegular').value = product && product.regularPrice ? product.regularPrice : '';
    $('#fRating').value = product && product.rating ? String(product.rating) : '';
    $('#fBadge').value = product && product.badge ? product.badge : '';
    $('#fDesc').value = product ? product.desc : '';
    fillImageSelect();
    $('#fImage').value = product ? product.image : 'images/prod-cgm.png';
    $$$('.chip input').forEach((cb) => { cb.checked = product && (product.tags || []).includes(cb.value); });
    overlay.hidden = false;
    requestAnimationFrame(() => $('#fName').focus());
  }

  function $$$(s) { return Array.from(document.querySelectorAll(s)); }

  function fillImageSelect() {
    const sel = $('#fImageSel');
    sel.innerHTML = '<option value="__custom">Custom URLâ€¦</option>' +
      images.map((im) => `<option value="${im}">${im}</option>`).join('') +
      '<option value="__paste">Paste full URL</option>';
    sel.addEventListener('change', () => {
      if (sel.value === '__custom') $('#fImage').value = 'images/';
      else if (sel.value === '__paste') $('#fImage').value = 'https://';
      else $('#fImage').value = sel.value;
    });
  }

  function closeModal() { overlay.hidden = true; }

  $('#addBtn').addEventListener('click', () => openModal(null));
  $('#modalClose').addEventListener('click', closeModal);
  $('#cancelBtn').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeDel(); }
  });

  /* ---------- Image Upload ---------- */
  $('#fImageUploadBtn').addEventListener('click', () => $('#fImageUpload').click());
  $('#fImageUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8e6) { toast('File too large (max 8 MB)', 'err'); e.target.value = ''; return; }
    toast('Uploadingâ€¦', 'ok');
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
      });
      const res = await apiFetch(API + '/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data: dataUrl }),
      });
      if (!res.ok) { const r = await res.json().catch(() => ({})); throw new Error(r.error || 'Upload failed'); }
      const result = await res.json();
      $('#fImage').value = result.path;
      if ($('#fImageSel')) $('#fImageSel').value = '__custom';
      toast('Uploaded: ' + result.filename, 'ok');
    } catch (err) {
      toast('Upload failed: ' + err.message, 'err');
    }
    e.target.value = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#fId').value;
    const rating = $('#fRating').value;
    const payload = {
      name: $('#fName').value.trim(),
      category: $('#fCategory').value.trim() || 'General',
      price: +$('#fPrice').value,
      priceMax: $('#fPriceMax').value ? +$('#fPriceMax').value : null,
      regularPrice: $('#fRegular').value ? +$('#fRegular').value : null,
      rating: rating ? +rating : null,
      badge: $('#fBadge').value.trim() || null,
      image: $('#fImage').value.trim(),
      desc: $('#fDesc').value.trim(),
      tags: $$$('.chip input:checked').map((c) => c.value),
    };
    if (!payload.name) { toast('Product name is required', 'err'); return; }
    if (!(payload.regularPrice && payload.regularPrice > payload.price)) payload.regularPrice = null;
    const url = API + '/api/products' + (id ? '/' + id : '');
    const method = id ? 'PUT' : 'POST';
    try {
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const r = await res.json().catch(() => ({})); throw new Error(r.error || 'Save failed'); }
      toast(id ? 'Product #' + id + ' updated' : 'Product added', 'ok');
      closeModal();
      await load();
    } catch (err) {
      toast(err.message, 'err');
    }
  });

  /* ---------- Delete ---------- */
  let pendingDelete = null;
  const delOverlay = $('#delOverlay');
  function askDelete(p) {
    pendingDelete = p;
    $('#delText').textContent = `"${p.name}" will be permanently removed.`;
    delOverlay.hidden = false;
  }
  function closeDel() { delOverlay.hidden = true; pendingDelete = null; }
  $('#delCancel').addEventListener('click', closeDel);
  delOverlay.addEventListener('click', (e) => { if (e.target === delOverlay) closeDel(); });
  $('#delConfirm').addEventListener('click', async () => {
    if (!pendingDelete) return;
    try {
      const res = await apiFetch(API + '/api/products/' + pendingDelete.id, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast('Deleted ' + pendingDelete.name, 'ok');
      closeDel();
      await load();
    } catch (err) { toast(err.message, 'err'); }
  });

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- Gemini AI Description ---------- */
  $('#aiDescBtn').addEventListener('click', async () => {
    const name = $('#fName').value.trim();
    const cat = $('#fCategory').value.trim();
    const currentDesc = $('#fDesc').value.trim();
    const apiKey = ($('#geminiKey').value || '').trim() || localStorage.getItem('gemini_api_key') || '';
    if (!name) { toast('Enter product name first', 'err'); return; }
    if (apiKey) localStorage.setItem('gemini_api_key', apiKey);
    $('#aiDescBtn').textContent = 'â³ Generatingâ€¦';
    $('#aiDescBtn').disabled = true;
    try {
      const res = await apiFetch(API + '/api/gemini/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: name, category: cat, currentDesc, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      $('#fDesc').value = data.description;
      toast('AI description generated!', 'ok');
    } catch (err) {
      toast('AI Error: ' + err.message, 'err');
    }
    $('#aiDescBtn').textContent = 'âœ¨ Generate with AI (Gemini)';
    $('#aiDescBtn').disabled = false;
  });

/* Restore saved Gemini key */
  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey) $('#geminiKey').value = savedKey;
  $('#geminiKey').addEventListener('change', () => {
    localStorage.setItem('gemini_api_key', $('#geminiKey').value.trim());
  });

  /* Logout */
  const logoutBtn = $('#logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    location.href = API + '/api/admin/logout';
  });

  /* ---------- Views ---------- */
  const productsApp = $('#productsView');
  const analyticsApp = $('#analyticsView');

  function switchView(name) {
    const showAnalytics = name === 'analytics';
    if (productsApp) productsApp.style.display = showAnalytics ? 'none' : '';
    if (analyticsApp) {
      analyticsApp.hidden = !showAnalytics;
      analyticsApp.style.display = showAnalytics ? '' : 'none';
    }
    if (showAnalytics) loadAnalytics();
    document.body.classList.remove('view-swap');
    void document.body.offsetWidth;
    document.body.classList.add('view-swap');
  }

  $$('.nav-item[data-view]').forEach((b) => b.addEventListener('click', () => {
    $$('.nav-item').forEach((n) => n.classList.remove('active'));
    b.classList.add('active');
    switchView(b.dataset.view);
  }));

/* ---------- Analytics ---------- */
  async function loadAnalytics() {
    try {
      await fetchAnalytics();
    } catch (e) { console.error('analytics load', e); }
    try { renderAnalyticsStats(); } catch (e) { console.error('renderAnalyticsStats', e); }
    try { renderSales(); } catch (e) { console.error('renderSales', e); }
  }

  function renderAnalyticsStats() {
    const v = analytics.visitors || { total: 0, today: 0 };
    const sales = analytics.sales || [];
    const revenue = sales.reduce((s, x) => s + (x.quantity || 1) * (x.price || 0), 0);
    const avg = sales.length ? Math.round(revenue / sales.length) : 0;
    const pv = analytics.pageViews || { total: 0, pages: {} };
    const prodViews = analytics.productViews || {};
    const topProducts = Object.entries(prodViews)
      .sort((a, b) => (b[1].total || 0) - (a[1].total || 0))
      .slice(0, 5);
    $('#analyticsSubtitle').textContent =
      (sales.length + ' sales Â· ' + v.total + ' visitors Â· ' + pv.total + ' page views').toString();
    $('#analyticsStats').innerHTML = `
      <div class="stat"><span class="num">${v.total}</span><span class="lbl">Total visitors</span><span class="sub">${v.today} today</span></div>
      <div class="stat"><span class="num">${pv.total}</span><span class="lbl">Page views</span><span class="sub">all pages</span></div>
      <div class="stat"><span class="num">${sales.length}</span><span class="lbl">Total sales</span><span class="sub">recorded</span></div>
      <div class="stat"><span class="num">${fmt(revenue)}</span><span class="lbl">Revenue</span><span class="sub">all time</span></div>
      <div class="stat"><span class="num">${fmt(avg)}</span><span class="lbl">Avg sale</span><span class="sub">per order</span></div>
      <div class="stat"><span class="num">${Object.keys(prodViews).length}</span><span class="lbl">Products viewed</span><span class="sub">unique items</span></div>
    `;
    /* Render product views table */
    const pvContainer = $('#productViewsBody');
    if (pvContainer) {
      if (topProducts.length) {
        pvContainer.innerHTML = topProducts.map(([id, data]) =>
          `<tr>
            <td><span class="p-id">#${id}</span></td>
            <td><p class="p-name">${esc(data.name || 'Unknown')}</p></td>
            <td><b>${data.total || 0}</b> views</td>
            <td>${Object.entries(data.daily || {}).slice(-3).map(([d, c]) => d + ': ' + c).join(', ') || 'â€”'}</td>
          </tr>`
        ).join('');
      } else {
        pvContainer.innerHTML = '<tr><td colspan="4" class="empty">No product views yet</td></tr>';
      }
    }
    /* Render page views */
    const pageContainer = $('#pageViewsBody');
    if (pageContainer) {
      const pages = Object.entries(pv.pages || {}).sort((a, b) => b[1] - a[1]);
      if (pages.length) {
        pageContainer.innerHTML = pages.map(([page, count]) =>
          `<tr><td>${esc(page)}</td><td><b>${count}</b></td></tr>`
        ).join('');
      } else {
        pageContainer.innerHTML = '<tr><td colspan="2" class="empty">No page views yet</td></tr>';
      }
    }
  }

  function saleInRange(s, r) {
    if (!r) return true;
    const d = new Date(s.date);
    const now = new Date();
    if (r === 'today') return d.toDateString() === now.toDateString();
    if (r === 'week') { const start = new Date(now); start.setDate(now.getDate() - now.getDay()); return d >= start; }
    if (r === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  }

  function renderSales() {
    const q = $('#saleSearch').value.trim().toLowerCase();
    const f = $('#saleFilter').value;
    const list = (analytics.sales || []).filter((s) => {
      if (!saleInRange(s, f)) return false;
      if (q && !(s.productName + ' ' + (s.customer || '') + ' ' + (s.phone || '')).toLowerCase().includes(q)) return false;
      return true;
    }).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    $('#saleCount').textContent = list.length + ' sales';
    $('#saleEmpty').hidden = list.length > 0;
    $('#saleTbody').innerHTML = list.map((s) => `
      <tr>
        <td><span class="p-id">#${s.id}</span></td>
        <td><p class="p-name">${esc(s.productName)}</p></td>
        <td>${s.quantity || 1}</td>
        <td><span class="price-now">${fmt((s.quantity || 1) * (s.price || 0))}</span></td>
        <td>${esc(s.customer || 'â€”')}</td>
        <td>${esc(s.phone || 'â€”')}</td>
        <td>${fmtDate(s.date)}</td>
        <td class="ta-r"><div class="actions">
          <button class="icon-btn del" data-sale-id="${s.id}" title="Delete">ðŸ—‘</button>
        </div></td>
      </tr>`).join('');
  }

  $('#saleSearch').addEventListener('input', renderSales);
  $('#saleFilter').addEventListener('change', renderSales);
  $('#refreshAnalytics').addEventListener('click', () => { loadAnalytics(); toast('Analytics refreshed', 'ok'); });

  $('#saleTbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-sale-id]');
    if (!btn) return;
    const id = +btn.dataset.saleId;
    if (!confirm('Delete sale #' + id + '?')) return;
    try {
      const res = await apiFetch(API + '/api/sales/' + id, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast('Deleted sale #' + id, 'ok');
      loadAnalytics();
    } catch (err) { toast(err.message, 'err'); }
  });

  /* ---------- Record Sale modal ---------- */
  const saleOverlay = $('#saleModalOverlay');
  function openSaleModal() {
    $('#saleDate').value = new Date().toISOString().slice(0, 10);
    $('#saleForm').reset();
    $('#saleDate').value = new Date().toISOString().slice(0, 10);
    $('#saleQty').value = 1;
    $('#productList').innerHTML = data.products.map((p) => `<option value="${esc(p.name)}"></option>`).join('');
    saleOverlay.hidden = false;
    $('#saleProductName').focus();
  }
  function closeSaleModal() { saleOverlay.hidden = true; }
  $('#addSaleBtn').addEventListener('click', openSaleModal);
  $('#saleModalClose').addEventListener('click', closeSaleModal);
  $('#saleCancelBtn').addEventListener('click', closeSaleModal);
  saleOverlay.addEventListener('click', (e) => { if (e.target === saleOverlay) closeSaleModal(); });

  $('#saleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#saleProductName').value.trim();
    if (!name) { toast('Product name is required', 'err'); return; }
    const qty = +$('#saleQty').value || 1;
    const price = +$('#salePrice').value || 0;
    const payload = {
      type: 'sale',
      productName: name,
      productId: (data.products.find((p) => p.name === name) || {}).id || 0,
      quantity: qty,
      price: price,
      customer: $('#saleCustomer').value.trim(),
      phone: $('#salePhone').value.trim(),
      notes: $('#saleNotes').value.trim(),
      date: $('#saleDate').value || undefined,
    };
try {
      const res = await apiFetch(API + '/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const r = await res.json().catch(() => ({})); throw new Error(r.error || 'Save failed'); }
      toast('Sale recorded', 'ok');
      closeSaleModal();
      loadAnalytics();
    } catch (err) {
      console.error('save sale error', err);
      toast(err && err.message ? err.message : 'Save failed', 'err');
    }
  });

  /* ---------- Init ---------- */
  loadImages().then(load).then(fetchAnalytics);
})();

