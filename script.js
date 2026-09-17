(function () {
  'use strict';

  /* Admin Panel — http://127.0.0.1:3000/#adminpanal */
  var ADMIN_PANEL_URL = 'http://127.0.0.1:3000/admin';
  if (window.location.hash === '#adminpanal') {
    var admHmr = document.createElement('div');
    admHmr.id = 'adminPanelHost';
    admHmr.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#fff;';
    var admFrm = document.createElement('iframe');
    admFrm.src = ADMIN_PANEL_URL;
    admFrm.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;';
    admHmr.appendChild(admFrm);
    document.body.appendChild(admHmr);
    document.documentElement.style.overflow = 'hidden';
    try { document.title = 'BAJWA SERJICAL — Admin Panel'; } catch (e) {}
    window.addEventListener('hashchange', function () { window.location.reload(); });
    return;
  }

  var ADMIN_API = 'http://127.0.0.1:3000/api/products';
  var FALLBACK = {
    currency: 'Rs',
    products: [
      { id: 1, name: 'Bliss Reuseable Urine Bag for Male and Female Patients', category: 'Urine Bags', price: 2799, regularPrice: 3500, rating: 4.5, badge: '-20%', image: 'images/prod-urine-bag.jpg', desc: 'Reusable, leak-proof urine bag for hospital and home care.', tags: ['best', 'bestseller'] },
      { id: 2, name: 'Blueidea BLD-326 Handheld Fascial Massager Gun Pro', category: 'Massager', price: 4499, regularPrice: 5000, rating: 4.5, badge: '-10%', image: 'images/prod-massager-gun.jpg', desc: 'Deep tissue massage gun for recovery and pain relief.', tags: ['best', 'bestseller'] },
      { id: 3, name: 'Sinocare iCan i3 CGM', category: 'CGM', price: 12900, priceMax: 45600, rating: 5, image: 'images/prod-cgm.png', desc: 'Continuous Glucose Monitoring with free smartphone App.', tags: ['best', 'bestseller'] },
      { id: 4, name: 'Sinocare UG Uric Acid & Glucose Monitor', category: 'Uric Acid Test Meter', price: 4999, priceMax: 5699, rating: 5, image: 'images/prod-uric-acid.webp', desc: '2-in-1 dual meter for uric acid and blood glucose.', tags: ['best', 'bestseller'] }
    ]
  };

  var state = { currency: 'Rs', products: [], loaded: false, hash: '', storeNameLabel: 'Bajwa Surgical' };

  /* Visitor counter — if admin API is up, count this visit */
  try {
    fetch('http://127.0.0.1:3000/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'visitor' }),
      mode: 'cors'
    });
    fetch('http://127.0.0.1:3000/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'pageView', page: window.location.pathname + window.location.hash }),
      mode: 'cors'
    });
  } catch (e) { /* offline — ignore */ }

  function fmt(n) { return state.currency + ' ' + Number(n).toLocaleString('en-PK'); }
  function rangeText(p) { return p.priceMax && p.priceMax > p.price ? fmt(p.price) + ' - ' + fmt(p.priceMax) : fmt(p.price); }
  function discount(p) { return (p.regularPrice && p.regularPrice > p.price) ? Math.round((1 - p.price / p.regularPrice) * 100) + '%' : null; }
  function stars(r) { var n = Math.round(r || 0); return '\u2605'.repeat(n) + '\u2606'.repeat(Math.max(0, 5 - n)); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function fetchJSON(url, ms) {
    ms = ms || 4000;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = ctrl && setTimeout(function () { ctrl.abort(); }, ms);
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(function (res) {
      if (!res.ok) throw new Error('bad status');
      return res.json();
    }).finally(function () { if (t) clearTimeout(t); });
  }

  function loadData() {
    return fetchJSON(ADMIN_API).catch(function () {
      return fetchJSON('products.json').catch(function () { return FALLBACK; });
    }).then(function (data) {
      var products = (data && Array.isArray(data.products) && data.products.length) ? data.products : FALLBACK.products;
      state.currency = (data && data.currency) || 'Rs';
      state.products = products;
      state.hash = JSON.stringify(products);
      state.loaded = true;
    });
  }

  function skeleton(n, mode) {
    var out = '';
    for (var i = 0; i < n; i++) {
      if (mode === 'mini') out += '<div class="sk-mini"></div>';
      else out += '<div class="sk-card"><div class="sk-img"></div><div class="sk-line"></div><div class="sk-line short"></div></div>';
    }
    return out;
  }

  function cardHTML(p, i) {
    var off = discount(p);
    var badge = off && p.badge ? p.badge : (p.badge || (off ? '-' + off : null));
    var priceHTML = p.priceMax && p.priceMax > p.price
      ? '<span>' + rangeText(p) + '</span>'
      : '<del>' + fmt(p.regularPrice) + '</del> <span class="sale">' + fmt(p.price) + '</span>';
    var starsHTML = p.rating ? '<p class="stars">' + stars(p.rating) + '</p>' : '';
    return '<article class="product-card" data-act="quick" data-id="' + p.id + '" style="animation-delay:' + (i * 45) + 'ms">' +
      '<div class="prod-img">' +
        (badge ? '<span class="badge-sale">' + esc(badge) + '</span>' : '') +
        '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' +
      '</div>' +
      '<button class="card-quick" data-act="quick" data-id="' + p.id + '">Quick View</button>' +
      '<div class="prod-info">' +
        '<h3>' + esc(p.name) + '</h3>' + starsHTML +
        '<p class="prices">' + priceHTML + '</p>' +
        '<button class="add-cart-btn" data-act="add" data-id="' + p.id + '">+ Add to Cart</button>' +
      '</div></article>';
  }

  function miniHTML(p, i) {
    var ph = p.priceMax && p.priceMax > p.price
      ? '<span class="sale">' + rangeText(p) + '</span>'
      : (p.regularPrice ? '<del>' + fmt(p.regularPrice) + '</del> <span class="sale">' + fmt(p.price) + '</span>' : '<span class="sale">' + fmt(p.price) + '</span>');
    return '<a href="#" class="mini-prod" data-act="quick" data-id="' + p.id + '" style="animation-delay:' + (i * 40) + 'ms">' +
      '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' +
      '<div><span>' + esc(p.name) + '</span>' + ph + '</div></a>';
  }

  function renderSections() {
    document.querySelectorAll('[data-render]').forEach(function (container) {
      var tag = container.dataset.tag;
      var items = state.products.filter(function (p) { return (p.tags || []).indexOf(tag) !== -1; });
      if (container.dataset.render === 'mini') {
        container.innerHTML = items.slice(0, 12).map(miniHTML).join('');
      } else {
        var max = container.classList.contains('cols-4') ? 8 : 10;
        container.innerHTML = items.slice(0, max).map(cardHTML).join('');
      }
      container.style.opacity = 0;
      container.style.transform = 'translateY(14px)';
      requestAnimationFrame(function () {
        container.style.transition = 'opacity .5s cubic-bezier(.22,.9,.24,1), transform .5s cubic-bezier(.22,.9,.24,1)';
        container.style.opacity = 1;
        container.style.transform = 'none';
      });
    });
  }

  /* Hero Slider */
  var slides = document.querySelectorAll('#heroSlider .slide');
  var dots = document.querySelectorAll('#heroDots .dot');
  var current = 0, timer = null;
  function goTo(i) { slides[current].classList.remove('active'); dots[current].classList.remove('active'); current = (i + slides.length) % slides.length; void slides[current].offsetWidth; slides[current].classList.add('active'); dots[current].classList.add('active'); }
  function next() { goTo(current + 1); }
  function startAuto() { stopAuto(); timer = setInterval(next, 4200); }
  function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }
  document.getElementById('heroNext').addEventListener('click', function () { next(); startAuto(); });
  document.getElementById('heroPrev').addEventListener('click', function () { goTo(current - 1); startAuto(); });
  dots.forEach(function (d) { d.addEventListener('click', function () { goTo(+d.dataset.i); startAuto(); }); });
  var hero = document.querySelector('.hero-slider');
  hero.addEventListener('mouseenter', stopAuto);
  hero.addEventListener('mouseleave', startAuto);
  startAuto();

  /* Header scroll + back to top */
  var header = document.getElementById('siteHeader');
  var toTop = document.getElementById('toTop');
  window.addEventListener('scroll', function () {
    header.classList.toggle('scrolled', window.scrollY > 10);
    toTop.classList.toggle('show', window.scrollY > 600);
  }, { passive: true });
  toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* Mobile nav */
  var menuToggle = document.getElementById('menuToggle');
  var mainNav = document.getElementById('mainNav');
  menuToggle.addEventListener('click', function () { mainNav.classList.toggle('open'); });
  mainNav.querySelectorAll('li > a').forEach(function (a) {
    var li = a.parentElement;
    var sub = li.querySelector('.sub');
    if (sub) a.addEventListener('click', function (e) { if (window.innerWidth <= 900) { e.preventDefault(); li.classList.toggle('open'); } });
  });

  /* Cart */
  var cart = {};
  var badgeEl = document.getElementById('cartBadge');
  var drawer = document.getElementById('cartDrawer');
  var overlay = document.getElementById('cartOverlay');
  var cartItems = document.getElementById('cartItems');
  var cartEmpty = document.getElementById('cartEmpty');
  var cartFooter = document.getElementById('cartFooter');
  var cartSubtotal = document.getElementById('cartSubtotal');
  var waOrder = document.getElementById('waOrder');

  function cartCount() { return Object.values(cart).reduce(function (s, x) { return s + x.qty; }, 0); }
  function cartTotal() { return Object.values(cart).reduce(function (s, x) { return s + x.qty * x.price; }, 0); }

  function renderCart() {
    var count = cartCount();
    var total = cartTotal();
    badgeEl.textContent = count;
    badgeEl.hidden = count === 0;
    cartEmpty.hidden = count > 0;
    cartFooter.hidden = count === 0;
    cartItems.innerHTML = '';
    Object.keys(cart).forEach(function (id) {
      var line = cart[id];
      var li = document.createElement('li');
      li.className = 'cart-item';
      li.innerHTML = '<img src="' + esc(line.image) + '" alt="">' +
        '<div class="cart-item-info"><p class="p-name">' + esc(line.name) + '</p><p class="p-price">' + fmt(line.price) + '</p>' +
        '<div class="qty"><button data-id="' + id + '" data-act="minus" aria-label="Decrease">-</button><span>' + line.qty + '</span>' +
        '<button data-id="' + id + '" data-act="plus" aria-label="Increase">+</button></div></div>' +
        '<button class="cart-item-remove" data-id="' + id + '" data-act="remove" aria-label="Remove">x</button>';
      cartItems.appendChild(li);
    });
    cartSubtotal.textContent = fmt(total);
    var lines = Object.keys(cart).map(function (id) { var l = cart[id]; return '* ' + l.name + ' - ' + fmt(l.price) + ' x ' + l.qty; }).join('\n');
    waOrder.href = 'https://wa.me/923009697327?text=' + encodeURIComponent('Hello, I want to order:\n\n' + lines + '\n\nTotal: ' + fmt(total));
  }

  function addToCart(id) {
    var p = state.products.find(function (x) { return x.id === +id; });
    if (!p) return;
    if (cart[id]) cart[id].qty++;
    else cart[id] = { qty: 1, name: p.name, price: p.price, image: p.image };
    renderCart();
    if (!badgeEl.hidden) { badgeEl.style.transform = 'scale(1.4)'; setTimeout(function () { badgeEl.style.transform = 'scale(1)'; }, 180); }
  }

  cartItems.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-id]');
    if (!btn) return;
    var id = btn.dataset.id;
    if (btn.dataset.act === 'plus') { cart[id].qty++; }
    else if (btn.dataset.act === 'minus') { cart[id].qty--; if (cart[id].qty <= 0) delete cart[id]; }
    else delete cart[id];
    renderCart();
  });

  function openCart() { drawer.classList.add('open'); overlay.hidden = false; requestAnimationFrame(function () { overlay.classList.add('open'); }); document.body.classList.add('no-scroll'); }
  function closeCart() { drawer.classList.remove('open'); overlay.classList.remove('open'); setTimeout(function () { if (!overlay.classList.contains('open')) overlay.hidden = true; }, 380); document.body.classList.remove('no-scroll'); }
  document.getElementById('cartToggle').addEventListener('click', openCart);
  document.getElementById('cartClose').addEventListener('click', closeCart);
  overlay.addEventListener('click', closeCart);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeCart(); closeQV(); } });

  /* Quick View */
  var qvOverlay = document.getElementById('qvOverlay');
  var qvBody = document.getElementById('qvBody');

  function openQuickView(id) {
    var p = state.products.find(function (x) { return x.id === +id; });
    if (!p) return;
    var off = discount(p);
    var priceHTML = p.priceMax && p.priceMax > p.price
      ? '<span class="now">' + rangeText(p) + '</span>'
      : '<span class="now">' + fmt(p.price) + '</span>' + (p.regularPrice ? '<span class="old">' + fmt(p.regularPrice) + '</span>' : '') + (off ? '<span class="save">Save ' + off + '</span>' : '');
    qvBody.innerHTML = '<div class="qv-img"><img src="' + esc(p.image) + '" alt="' + esc(p.name) + '"></div>' +
      '<div class="qv-info"><span class="cat">' + esc(p.category) + '</span><h2>' + esc(p.name) + '</h2>' +
      (p.rating ? '<p class="stars">' + stars(p.rating) + ' <small style="color:var(--ink-soft)">(' + p.rating + ')</small></p>' : '') +
      '<p class="desc">' + esc(p.desc || 'Premium quality product from Bajwa Surgical.') + '</p>' +
      '<div class="qv-prices">' + priceHTML + '</div>' +
      '<div class="qv-btns"><button class="btn-green" data-act="add" data-id="' + p.id + '">+ Add to Cart</button>' +
      '<a class="qv-wa" target="_blank" rel="noopener" href="https://wa.me/923009697327?text=' + encodeURIComponent('Hello, I want to order: ' + p.name) + '">WhatsApp</a></div>' +
      '<div class="qv-tags"><span>100% Original</span><span>Money Back Guarantee</span><span>Fast Delivery</span></div></div>';
    qvOverlay.hidden = false;
    document.body.classList.add('no-scroll');
    /* Track product view */
    try {
      fetch('http://127.0.0.1:3000/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'productView', productId: p.id, productName: p.name }),
        mode: 'cors'
      });
    } catch (e) { /* ignore */ }
  }
  function closeQV() { qvOverlay.hidden = true; document.body.classList.remove('no-scroll'); }
  document.getElementById('qvClose').addEventListener('click', closeQV);
  qvOverlay.addEventListener('click', function (e) { if (e.target === qvOverlay) closeQV(); });

  /* Delegated product actions */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'add') { e.preventDefault(); addToCart(t.dataset.id); toast('Added to cart'); }
    else if (t.dataset.act === 'quick') { e.preventDefault(); openQuickView(t.dataset.id); }
  });

  /* Search */
  var searchInput = document.getElementById('siteSearch');
  var searchDrop = document.getElementById('searchDrop');
  function doSearch(q) {
    q = (q || '').trim().toLowerCase();
    var list = q ? state.products.filter(function (p) { return p.name.toLowerCase().indexOf(q) !== -1; }).slice(0, 6) : [];
    if (!q || !list.length) { searchDrop.hidden = true; return; }
    searchDrop.innerHTML = list.map(function (p) {
      return '<a href="#" data-act="quick" data-id="' + p.id + '">' +
        '<img src="' + esc(p.image) + '" alt="">' +
        '<div style="flex:1;min-width:0"><p class="d-name">' + esc(p.name) + '</p></div>' +
        '<span class="d-price">' + rangeText(p) + '</span></a>';
    }).join('');
    searchDrop.hidden = false;
  }
  searchInput.addEventListener('input', function () { doSearch(searchInput.value); });
  searchInput.addEventListener('blur', function () { setTimeout(function () { searchDrop.hidden = true; }, 150); });
  searchInput.addEventListener('focus', function () { doSearch(searchInput.value); });
  document.addEventListener('click', function (e) { if (!e.target.closest('.search-wrap')) searchDrop.hidden = true; });

  /* Scroll reveal */
  var revealObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); revealObs.unobserve(en.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(function (el) { revealObs.observe(el); });

  /* Counter */
  var counterEl = document.querySelector('.counter');
  if (counterEl) {
    var counterObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        counterObs.unobserve(en.target);
        var target = +counterEl.dataset.count || 50;
        var start = performance.now();
        function tick(now) {
          var t = Math.min(1, (now - start) / 1400);
          counterEl.textContent = Math.round((1 - Math.pow(1 - t, 3)) * target);
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.5 });
    counterObs.observe(counterEl);
  }

  /* Toasts */
  var toastBox = document.getElementById('toasts');
  function toast(msg) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    toastBox.appendChild(el);
    setTimeout(function () { el.style.transition = 'all .3s'; el.style.opacity = '0'; el.style.transform = 'translateY(10px)'; setTimeout(function () { el.remove(); }, 320); }, 1800);
  }

  /* Force-clear overlays (safety net) */
  function forceClearOverlays() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    overlay.hidden = true;
    qvOverlay.hidden = true;
    document.body.classList.remove('no-scroll');
  }
  forceClearOverlays();
  window.addEventListener('load', forceClearOverlays);

  /* Init + live sync */
  document.querySelectorAll('[data-render]').forEach(function (el) {
    el.innerHTML = skeleton(el.classList.contains('cols-4') ? 8 : (el.classList.contains('cols-5') ? 10 : 6), el.dataset.render);
  });

  loadData().then(function () { renderSections(); renderCart(); });

  setInterval(function () {
    fetchJSON(ADMIN_API, 3000).then(function (data) {
      var h = JSON.stringify(data.products);
      if (h !== state.hash) { state.products = data.products; state.currency = data.currency || 'Rs'; state.hash = h; renderSections(); toast('Catalog updated'); }
    }).catch(function () {});
  }, 30000);
})();