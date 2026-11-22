/* OG — Only Gods · storefront */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  async function api(path, opts = {}) {
    const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong"), { status: res.status, data });
    return data;
  }

  // ---------- Visitor id (anonymous, for conversion analytics) ----------
  let sid = store.get("og-sid", "");
  if (!/^[a-z0-9]{8,40}$/.test(sid)) { sid = (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 24); store.set("og-sid", sid); }
  const track = (type) => { fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sid, type }), keepalive: true }).catch(() => {}); };
  track("visit");

  document.body.classList.add("loading");
  $("#year").textContent = new Date().getFullYear();

  // ---------- Preloader ----------
  const pre = $("#preloader");
  const finishLoad = () => { pre.classList.add("done"); document.body.classList.remove("loading"); setTimeout(() => document.body.classList.add("ready"), 150); };
  if (reduced) finishLoad();
  else {
    let p = 0;
    const tick = () => {
      p = Math.min(100, p + Math.random() * 10 + 4);
      $("#preBar").style.width = p + "%";
      $("#preCount").textContent = Math.floor(p);
      if (p < 100) setTimeout(tick, 40); else setTimeout(finishLoad, 220);
    };
    tick();
  }

  // ---------- State ----------
  let config = { paymentMode: "off", shippingFee: 0, states: [] };
  let products = [];
  let cart = store.get("og-cart-v2", []);
  const productById = (id) => products.find((p) => p.id === id);
  const saveCart = () => store.set("og-cart-v2", cart);

  // ---------- Statement words ----------
  const statement = $("#statement");
  (function wrap(node) {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
          else { const s = document.createElement("span"); s.className = "w"; s.textContent = part; frag.appendChild(s); }
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) wrap(child);
    });
  })(statement);
  const words = $$(".w", statement);

  // ---------- 28-day grid ----------
  const grid = $("#sachetGrid");
  const sachetImgs = ["/img/sachet-whey-choco-green.webp", "/img/sachet-whey-vanilla-green.webp", "/img/sachet-yeast-vanilla.webp"]; // all green-topped
  for (let i = 1; i <= 28; i++) {
    const s = document.createElement("div");
    s.className = "sachet";
    s.innerHTML = `<img src="${sachetImgs[(i - 1) % 3]}" alt="" loading="lazy" width="341" height="700" /><small>D${String(i).padStart(2, "0")}</small>`;
    grid.appendChild(s);
  }
  const sachets = $$(".sachet", grid);
  const phases = [
    ["Week 1 — Start", "Tear the first sachet. 24g of protein, no scoops, no guesswork."],
    ["Week 2 — Routine", "One sachet, every day. The box on your shelf keeps count so you don't have to."],
    ["Week 3 — Momentum", "The habit runs itself now. Gym bag, desk drawer, car — OG goes where you go."],
    ["Week 4 — Own it", "28 days. 28 sachets. Zero missed. Time to order the next box."],
  ];
  const journey = $("#journey");
  const weeks = $$(".wk");
  let lastDay = -1, lastWeek = -1;
  function updateJourney() {
    const r = journey.getBoundingClientRect();
    const total = journey.offsetHeight - window.innerHeight;
    const prog = Math.min(1, Math.max(0, -r.top / total));
    const day = Math.max(1, Math.min(28, Math.ceil(prog * 28.5)));
    if (day !== lastDay) {
      lastDay = day;
      $("#dayNum").textContent = String(day).padStart(2, "0");
      sachets.forEach((s, i) => { s.classList.toggle("on", i < day); s.classList.toggle("current", i === day - 1); });
    }
    const week = Math.min(3, Math.floor((day - 1) / 7));
    weeks.forEach((w, i) => { w.style.setProperty("--p", Math.min(1, Math.max(0, (day - i * 7) / 7))); w.classList.toggle("active", i === week); });
    if (week !== lastWeek) {
      lastWeek = week;
      $("#phaseTitle").textContent = phases[week][0];
      $("#phaseText").textContent = phases[week][1];
      const ph = $("#phase"); ph.classList.remove("swap"); void ph.offsetWidth; ph.classList.add("swap");
    }
  }

  // ---------- Scroll effects ----------
  const nav = $("#nav"), progress = $("#progress"), buybar = $("#buybar"), shop = $("#shop");
  const heroProduct = $("#heroProduct"), hero = $("#hero"), lifestyleImg = $("#lifestyleImg");
  let lastY = window.scrollY, mx = 0, my = 0;
  function updateHeroTilt() {
    if (reduced || !fine) return; // gentle mouse tilt on desktop only; the spin itself works everywhere
    heroProduct.style.transform = `rotateY(${mx * 10}deg) rotateX(${-my * 6}deg)`;
  }
  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle("scrolled", y > 30);
    nav.classList.toggle("hide", y > lastY && y > 600 && !document.body.classList.contains("menu-open"));
    lastY = y;

    const sr = shop.getBoundingClientRect();
    const jr = journey.getBoundingClientRect();
    const visible = (r) => r.top < window.innerHeight * 0.85 && r.bottom > 0;
    buybar.classList.toggle("show", y > window.innerHeight * 0.8 && !visible(sr) && !visible(jr));

    const st = statement.getBoundingClientRect();
    const sp = Math.min(1, Math.max(0, (window.innerHeight * 0.85 - st.top) / (st.height + window.innerHeight * 0.35)));
    const lit = Math.floor(sp * words.length);
    words.forEach((w, i) => w.classList.toggle("lit", i < lit));

    if (!reduced) {
      const lr = lifestyleImg.getBoundingClientRect();
      if (lr.bottom > 0 && lr.top < window.innerHeight) {
        const k = (lr.top + lr.height / 2 - window.innerHeight / 2) / window.innerHeight;
        lifestyleImg.style.setProperty("--py", `${-7 + k * 10}%`);
      }
    }
    updateJourney();
    updateHeroTilt();
  }
  let ticking = false;
  window.addEventListener("scroll", () => { if (!ticking) { requestAnimationFrame(() => { onScroll(); ticking = false; }); ticking = true; } }, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  // ---------- Hero: two-sided 3D product spin (drag / swipe) ----------
  (function heroSpin() {
    const hv = $("#heroVisual"), spinner = $("#spinner"), hint = $("#spinHint");
    const btns = $$(".spin-ctl button"), origin = $("#chipOrigin");
    const FACES = [
      { origin: "Whey imported from Europe" },
      { origin: "Protein imported from Europe" },
    ];
    let angle = 0, vel = 0, target = null, dragging = false, moved = 0;
    let lastX = 0, lastInteract = 0, raf = null, face = 0;

    const norm = (a) => ((a % 360) + 360) % 360;
    function setFace(f) {
      if (f === face) return;
      face = f;
      hv.classList.toggle("is-yeast", f === 1);
      origin.textContent = FACES[f].origin;
      btns.forEach((b, i) => { b.classList.toggle("on", i === f); b.setAttribute("aria-pressed", String(i === f)); });
    }
    function render() {
      spinner.style.transform = `rotateY(${angle}deg)`;
      const a = norm(angle);
      setFace(a > 90 && a < 270 ? 1 : 0);
    }
    function loop() {
      if (!dragging) {
        if (target !== null) {
          const d = target - angle;
          angle += d * 0.1;
          if (Math.abs(d) < 0.25) { angle = target; target = null; vel = 0; render(); raf = null; return; }
        } else if (Math.abs(vel) > 0.6) {
          angle += vel;
          vel *= 0.94;
        } else {
          target = Math.round(angle / 180) * 180; // settle on whichever side faces the viewer
        }
      }
      render();
      raf = requestAnimationFrame(loop);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    const touched = () => { lastInteract = Date.now(); hint.classList.add("gone"); };

    hv.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest(".spin-ctl")) return;
      dragging = true; moved = 0; vel = 0; target = null; lastX = e.clientX;
      hv.setPointerCapture(e.pointerId);
      hv.classList.add("dragging");
      touched(); kick();
    });
    hv.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      moved += Math.abs(dx);
      angle += dx * 0.55;
      vel = vel * 0.4 + dx * 0.55 * 0.6;
      render();
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      hv.classList.remove("dragging");
      if (moved < 4) target = Math.round(angle / 180) * 180 + 180; // a tap flips it
      touched(); kick();
    };
    hv.addEventListener("pointerup", end);
    hv.addEventListener("pointercancel", end);
    hv.addEventListener("lostpointercapture", end);

    function goTo(f) {
      const off = f === 1 ? 180 : 0;
      // nearest angle showing that face, continuing in the current direction
      let t = Math.round((angle - off) / 360) * 360 + off;
      if (t === angle) return;
      target = t; vel = 0; kick();
    }
    btns.forEach((b) => b.addEventListener("click", () => { touched(); goTo(Number(b.dataset.face)); }));

    // Idle showcase: flip every few seconds until the visitor interacts.
    if (!reduced) {
      let heroOn = true;
      new IntersectionObserver(([en]) => { heroOn = en.isIntersecting; }).observe(hv);
      setInterval(() => {
        if (dragging || !heroOn || document.hidden || Date.now() - lastInteract < 9000) return;
        target = Math.round(angle / 180) * 180 + 180; kick();
      }, 4500);
    }
    render();
  })();

  if (fine && !reduced) {
    window.addEventListener("pointermove", (e) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
      updateHeroTilt();
    }, { passive: true });
  }

  // ---------- Testimonials (scrolling strip) ----------
  {
    const list = (Array.isArray(window.OG_TESTIMONIALS) ? window.OG_TESTIMONIALS : []).filter((t) => t && t.name && t.text);
    if (list.length) {
      const star = '<svg viewBox="0 0 24 24"><path d="m12 2 3 6.9 7.5.7-5.7 5 1.7 7.4L12 18.1 5.5 22l1.7-7.4-5.7-5 7.5-.7z"/></svg>';
      const card = (t, hidden) => {
        const r = Math.max(1, Math.min(5, Math.round(Number(t.rating) || 5)));
        return `<figure class="review"${hidden ? ' aria-hidden="true"' : ""}>
          <div class="review-stars" aria-label="${r} out of 5 stars">${star.repeat(r)}</div>
          <blockquote>${esc(t.text)}</blockquote>
          <figcaption><span class="review-av">${esc(t.name.trim()[0].toUpperCase())}</span><span><b>${esc(t.name)}</b><small>${esc([t.city, t.product].filter(Boolean).join(" · "))}</small></span></figcaption>
        </figure>`;
      };
      const track = $("#reviewsTrack");
      // Two copies side by side; the CSS animation slides by exactly one copy for a seamless loop.
      track.innerHTML = list.map((t) => card(t)).join("") + list.map((t) => card(t, true)).join("");
      track.style.setProperty("--dur", Math.max(30, list.length * 7) + "s");
      $("#reviews").hidden = false;
    }
  }

  // ---------- Reveal + counters ----------
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  const observeReveals = () => $$(".reveal:not(.in)").forEach((el) => io.observe(el));
  observeReveals();

  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target, target = +el.dataset.count, t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / 1500); el.textContent = Math.round(target * (1 - Math.pow(1 - k, 4))); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
      countIO.unobserve(el);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => countIO.observe(el));

  function bindTilt(root = document) {
    if (!fine || reduced) return;
    $$(".tilt", root).forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty("--mx", x * 100 + "%"); card.style.setProperty("--my", y * 100 + "%");
        card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 8}deg) rotateY(${(x - 0.5) * 10}deg) translateY(-6px)`;
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    });
    $$(".magnetic", root).forEach((b) => {
      b.addEventListener("pointermove", (e) => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.2}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`; });
      b.addEventListener("pointerleave", () => { b.style.transform = ""; });
    });
  }
  bindTilt();

  // ---------- Embers ----------
  const canvas = $("#embers"), ctx = canvas.getContext("2d");
  let W, H, embers = [], heroVisible = true;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const spawn = (any) => ({ x: Math.random() * W, y: any ? Math.random() * H : H + 10, r: Math.random() * 2.2 + 0.4, vy: Math.random() * 0.7 + 0.25, vx: (Math.random() - 0.5) * 0.3, life: Math.random() * 0.6 + 0.4, hue: 22 + Math.random() * 18, t: Math.random() * 100 });
  function resize() { W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); embers = Array.from({ length: Math.round(Math.min(60, (W * H) / 22000)) }, () => spawn(true)); }
  function draw() {
    if (heroVisible) {
      ctx.clearRect(0, 0, W, H);
      for (const e of embers) {
        e.t += 0.02; e.y -= e.vy; e.x += e.vx + Math.sin(e.t) * 0.3;
        const a = Math.min(1, e.y / H) * e.life * 0.75;
        ctx.fillStyle = `hsla(${e.hue},95%,52%,${a})`;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.6, 0, Math.PI * 2); ctx.fill();
        if (e.y < -10) Object.assign(e, spawn(false));
      }
    }
    requestAnimationFrame(draw);
  }
  if (!reduced) { resize(); window.addEventListener("resize", resize); new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; }).observe(hero); requestAnimationFrame(draw); }

  // ---------- Menu ----------
  const burger = $("#burger");
  const setMenu = (open) => { document.body.classList.toggle("menu-open", open); burger.setAttribute("aria-expanded", String(open)); };
  burger.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
  $$("#navLinks a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

  // ---------- Toast ----------
  const toast = $("#toast");
  let toastT;
  function showToast(msg, ms = 2800) { toast.textContent = msg; toast.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove("show"), ms); }

  // ---------- Products ----------
  const safeColor = (c) => (/^#[0-9a-fA-F]{3,8}$/.test(c || "") ? c : null);
  const flavorStyle = (f) => {
    const c = safeColor(f.color), t = safeColor(f.text);
    return c ? ` style="--fc:${c};--fct:${t || "#111"}"` : "";
  };
  const flavorOf = (p, name) => p.flavors.find((f) => f.name === name) || p.flavors[0];
  function renderProducts() {
    const wrap = $("#products");
    wrap.innerHTML = "";
    products.forEach((p) => {
      const card = document.createElement("article");
      card.className = "p-card reveal";
      const f0 = p.flavors[0];
      card.style.setProperty("--accent", f0.color || p.accent);
      const off = p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;
      const hasSachet = p.flavors.some((f) => f.image && f.image !== p.image);
      const firstImg = p.flavors[0].image && p.flavors[0].image !== p.image ? p.flavors[0].image : null;
      card.innerHTML = `
        <div class="p-stage">
          <div class="p-beam"></div>
          <div class="p-ghost" style="--chars:${p.shortName.split(" ")[0].length}">${esc(p.shortName.split(" ")[0])}</div>
          <img class="p-img" src="${esc(f0.main || p.image)}" alt="${esc(p.name)} — ${esc(f0.name)}" loading="lazy" />
          ${hasSachet ? `<img class="p-sachet${firstImg ? "" : " gone"}" src="${esc(firstImg || p.flavors.find((f) => f.image && f.image !== p.image).image)}" alt="" loading="lazy" />` : ""}
          ${!p.inStock ? `<span class="p-badge sold">Out of stock</span>` : p.lowStock ? `<span class="p-badge low">Only ${p.lowStock} left</span>` : ""}
        </div>
        <div class="p-body">
          <h3>${esc(p.name.replace(/^OG\s+/, ""))}</h3>
          <p class="p-sub">${esc(p.subtitle)}</p>
          <p class="p-desc">${esc(p.description)}</p>
          <div class="p-flavors" role="radiogroup" aria-label="Flavour">
            ${p.flavors.map((f, i) => `<button class="p-flavor${i === 0 ? " active" : ""}${f.color ? " has-color" : ""}" role="radio" aria-checked="${i === 0}" data-flavor="${esc(f.name)}"${flavorStyle(f)}>${esc(f.name)}</button>`).join("")}
          </div>
          <div class="p-buy">
            <div class="p-price"><b>${inr(p.price)}</b>${off ? `<s>${inr(p.mrp)}</s><span class="off">${off}% off</span>` : ""}</div>
            <div class="qty"><button aria-label="Decrease quantity" data-q="-1">−</button><span>1</span><button aria-label="Increase quantity" data-q="1">+</button></div>
            <button class="btn ${p.inStock ? "btn-fire" : "btn-ghost"} btn-block p-add" ${p.inStock ? "" : "disabled"}>${p.inStock ? "Add to cart" : "Out of stock"}</button>
          </div>
        </div>`;
      let flavor = p.flavors[0].name, qty = 1;
      const sachetEl = $(".p-sachet", card);
      $$(".p-flavor", card).forEach((b) => b.addEventListener("click", () => {
        $$(".p-flavor", card).forEach((x) => { x.classList.remove("active"); x.setAttribute("aria-checked", "false"); });
        b.classList.add("active"); b.setAttribute("aria-checked", "true");
        flavor = b.dataset.flavor;
        const f = p.flavors.find((x) => x.name === flavor);
        if (f) card.style.setProperty("--accent", f.color || p.accent);
        if (f && f.main) {
          const img = $(".p-img", card);
          if (!img.src.endsWith(f.main)) {
            img.classList.add("swapping");
            setTimeout(() => { img.src = f.main; img.alt = `${p.name} — ${f.name}`; img.classList.remove("swapping"); }, 220);
          }
        }
        if (sachetEl && f) {
          if (!f.image || f.image === p.image) { sachetEl.classList.add("gone"); return; }
          sachetEl.classList.add("swap");
          setTimeout(() => { sachetEl.src = f.image; sachetEl.classList.toggle("swap", false); sachetEl.classList.toggle("gone", false); }, 250);
        }
      }));
      $$(".qty button", card).forEach((b) => b.addEventListener("click", () => {
        qty = Math.max(1, Math.min(10, qty + Number(b.dataset.q)));
        $(".qty span", card).textContent = qty;
      }));
      $(".p-add", card).addEventListener("click", () => addToCart(p.id, flavor, qty));
      wrap.appendChild(card);
    });
    observeReveals();
    const min = products.filter((p) => p.inStock).reduce((m, p) => Math.min(m, p.price), Infinity);
    if (isFinite(min)) $("#buybarPrice").textContent = `from ${inr(min)} · delivered across India`;
    renderCreatine();
  }

  // ---------- Creatine spotlight ----------
  let crFlavor = "Fruit Fusion";
  function renderCreatine() {
    const c = productById("og-creatine");
    const btn = $("#crAdd");
    if (!c) { $("#creatine").hidden = true; return; }
    const off = c.mrp && c.mrp > c.price ? Math.round((1 - c.price / c.mrp) * 100) : 0;
    $("#crPrice").innerHTML = `<b>${inr(c.price)}</b>${off ? `<s>${inr(c.mrp)}</s><span class="off">${off}% off</span>` : ""}`;
    const names = c.flavors.map((f) => f.name);
    $$("[data-cr-flavor]").forEach((b) => {
      b.hidden = !names.includes(b.dataset.crFlavor);
      const f = c.flavors.find((x) => x.name === b.dataset.crFlavor);
      if (f && safeColor(f.color)) { b.classList.add("has-color"); b.style.setProperty("--fc", f.color); b.style.setProperty("--fct", safeColor(f.text) || "#111"); }
    });
    if (!names.includes(crFlavor)) crFlavor = names[0];
    applyCrFlavor();
    btn.disabled = !c.inStock;
    btn.textContent = c.inStock ? "Add creatine to cart" : "Out of stock";
  }
  $$("[data-cr-flavor]").forEach((b) => b.addEventListener("click", () => {
    $$("[data-cr-flavor]").forEach((x) => { x.classList.toggle("active", false); x.setAttribute("aria-checked", "false"); });
    b.classList.add("active"); b.setAttribute("aria-checked", "true");
    crFlavor = b.dataset.crFlavor;
    applyCrFlavor();
  }));
  function applyCrFlavor() {
    const c = productById("og-creatine");
    if (!c) return;
    const f = flavorOf(c, crFlavor);
    const sec = $("#creatine"), img = $("#crImg");
    sec.style.setProperty("--cr", safeColor(f.color) || c.accent);
    sec.style.setProperty("--crt", safeColor(f.text) || "#111");
    if (f.main && !img.src.endsWith(f.main)) {
      img.classList.add("swapping");
      setTimeout(() => { img.src = f.main; img.alt = `${c.name} — ${f.name}`; img.classList.remove("swapping"); }, 220);
    }
    $("#crTag").textContent = `120g · ${f.name}`;
  }
  $("#crAdd").addEventListener("click", () => addToCart("og-creatine", crFlavor, 1));
  const etaText = (eta) => (/^7/.test(eta) ? "within 7 days" : "in " + eta);

  // ---------- Cart ----------
  const cartCount = $("#cartCount");
  let pending = null; // { orderId, payment } awaiting payment

  function addToCart(productId, flavor, qty) {
    const line = cart.find((l) => l.productId === productId && l.flavor === flavor);
    if (line) line.qty = Math.min(10, line.qty + qty); else cart.push({ productId, flavor, qty });
    pending = null;
    saveCart(); renderCart(); track("add_to_cart");
    cartCount.classList.remove("bump"); void cartCount.offsetWidth; cartCount.classList.add("bump");
    setTimeout(() => openCart(true), 220);
  }

  function cartTotals() {
    const lines = cart.map((l) => ({ ...l, product: productById(l.productId) })).filter((l) => l.product);
    const subtotal = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
    const shipping = lines.length ? config.shippingFee : 0;
    return { lines, subtotal, shipping, total: subtotal + shipping };
  }

  function renderCart() {
    if (products.length) cart = cart.filter((l) => { const p = productById(l.productId); return p && p.flavors.some((f) => f.name === l.flavor); });
    const { lines, subtotal, shipping, total } = cartTotals();
    const count = cart.reduce((a, l) => a + l.qty, 0);
    cartCount.textContent = count;
    cartCount.classList.toggle("show", count > 0);
    $("#cartSubtotal").textContent = inr(subtotal);
    $("#cartShipping").textContent = shipping ? inr(shipping) : "Free";
    $("#cartTotal").textContent = inr(total);
    $("#toDetails").disabled = !lines.length;
    const box = $("#cartItems");
    if (!lines.length) {
      box.innerHTML = `<div class="cart-empty"><img src="/img/logo-dark.png" alt="" />Your stack is empty.<br/>Day 01 is waiting.<br/><br/><a href="#shop" class="btn btn-ghost btn-sm" id="emptyShop">Shop the lineup</a></div>`;
      $("#emptyShop").addEventListener("click", () => openCart(false));
      return;
    }
    box.innerHTML = "";
    lines.forEach((l) => {
      const p = l.product, f = p.flavors.find((x) => x.name === l.flavor);
      const row = document.createElement("div");
      row.className = "ci";
      row.innerHTML = `
        <div class="ci-thumb" style="--accent:${esc((f && f.color) || p.accent)}"><img src="${esc((f && f.main) || p.image)}" alt="" /></div>
        <div><h4>${esc(p.name)}</h4><small>${esc(f ? f.name : l.flavor)}${p.inStock ? "" : " · <b style='color:var(--danger)'>Out of stock</b>"}</small>
          <div class="qty"><button aria-label="Decrease">−</button><span>${l.qty}</span><button aria-label="Increase">+</button></div></div>
        <div class="ci-price">${inr(p.price * l.qty)}<button class="ci-remove">Remove</button></div>`;
      const [dec, inc] = $$(".qty button", row);
      const change = (d) => { l.qty += d; const ref = cart.find((c) => c.productId === l.productId && c.flavor === l.flavor); if (ref) ref.qty = Math.min(10, l.qty); cart = cart.filter((c) => c.qty > 0); pending = null; saveCart(); renderCart(); };
      dec.addEventListener("click", () => change(-1));
      inc.addEventListener("click", () => change(1));
      $(".ci-remove", row).addEventListener("click", () => change(-l.qty));
      box.appendChild(row);
    });
  }

  // ---------- Drawer & steps ----------
  const stepCart = $("#stepCart"), stepDetails = $("#stepDetails");
  function setStep(n) {
    stepCart.hidden = n !== 1; stepDetails.hidden = n !== 2;
    $("#cartBack").hidden = n === 1;
    $("#cartTitle").textContent = n === 1 ? "Your stack" : "Delivery";
    $$("#stepsInd span").forEach((s, i) => s.classList.toggle("on", i < n + (n === 2 ? 0 : 0)));
  }
  function openCart(open) {
    document.body.classList.toggle("cart-open", open);
    $("#cart").setAttribute("aria-hidden", String(!open));
    if (open) setStep(1);
  }
  $("#cartOpen").addEventListener("click", () => openCart(true));
  $("#cartClose").addEventListener("click", () => openCart(false));
  $("#cartOverlay").addEventListener("click", () => openCart(false));
  $("#cartBack").addEventListener("click", () => setStep(1));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!$("#modal").hidden) closeModal(); else openCart(false); setMenu(false); } });

  $("#toDetails").addEventListener("click", () => {
    const { lines } = cartTotals();
    if (!lines.length) return;
    const oos = lines.find((l) => !l.product.inStock);
    if (oos) return showToast(`${oos.product.name} is out of stock — please remove it`);
    setStep(2);
    track("checkout_start");
    renderSummary();
    const first = $$("input", stepDetails).find((i) => !i.value);
    if (first && fine) first.focus();
  });

  // ---------- Details form ----------
  const form = stepDetails;
  const saved = store.get("og-customer", {});
  ["name", "phone", "email", "address1", "address2", "pincode", "city", "state"].forEach((k) => { if (saved[k] && form.elements[k]) form.elements[k].value = saved[k]; });

  function fieldMsg(name, msg, hint) {
    const el = form.elements[name]; if (!el) return;
    const wrap = el.closest(".field"), small = $("small", wrap);
    wrap.classList.toggle("err", !!msg && !hint);
    small.textContent = msg || "";
    small.classList.toggle("hint", !!hint);
  }
  function renderSummary() {
    const { lines, subtotal, shipping, total } = cartTotals();
    $("#summary").innerHTML =
      lines.map((l) => `<div><span>${l.qty} × ${esc(l.product.name.replace(/^OG\s+/, ""))} (${esc(l.flavor)})</span><b>${inr(l.product.price * l.qty)}</b></div>`).join("") +
      `<div><span>Shipping</span><b>${shipping ? inr(shipping) : "Free"}</b></div><div class="tot"><span>Total to pay</span><b>${inr(total)}</b></div>`;
    $("#payBtn").textContent = pending ? `Retry payment · ${inr(total)}` : `Pay ${inr(total)} securely`;
  }

  let pinTimer;
  form.elements.pincode.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
    clearTimeout(pinTimer);
    fieldMsg("pincode", "");
    if (e.target.value.length === 6) pinTimer = setTimeout(async () => {
      try {
        const r = await api("/api/pincode/" + e.target.value);
        if (r.ok && r.priority) { form.elements.state.value = r.state; fieldMsg("state", ""); fieldMsg("pincode", `✓ Delivers to ${r.state} in ${r.eta}`, true); }
        else if (r.ok) {
          if (["Tamil Nadu", "Karnataka", "Kerala"].includes(form.elements.state.value)) form.elements.state.value = "";
          fieldMsg("pincode", "✓ We deliver here within 7 days", true);
        } else fieldMsg("pincode", "Enter a valid 6-digit pincode");
      } catch {}
    }, 250);
  });
  form.elements.phone.addEventListener("input", (e) => { e.target.value = e.target.value.replace(/[^\d+ ]/g, "").slice(0, 14); });

  function readForm() {
    const c = {};
    ["name", "phone", "email", "address1", "address2", "pincode", "city", "state"].forEach((k) => (c[k] = form.elements[k].value.trim()));
    return c;
  }
  function clientValidate(c) {
    const e = {};
    if (c.name.length < 2) e.name = "Enter your full name";
    if (!/^[6-9]\d{9}$/.test(c.phone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""))) e.phone = "Enter a valid 10-digit mobile number";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) e.email = "Enter a valid email";
    if (c.address1.length < 5) e.address1 = "Enter your house / street address";
    if (!/^\d{6}$/.test(c.pincode)) e.pincode = "Enter a valid 6-digit pincode";
    if (c.city.length < 2) e.city = "Enter your city";
    if (!c.state) e.state = "Select your state";
    return e;
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    $("#formError").textContent = "";
    if (pending) return startPayment(pending);
    const c = readForm();
    ["name", "phone", "email", "address1", "pincode", "city", "state"].forEach((k) => fieldMsg(k, ""));
    const errs = clientValidate(c);
    if (Object.keys(errs).length) { Object.entries(errs).forEach(([k, v]) => fieldMsg(k, v)); form.elements[Object.keys(errs)[0]].focus(); return; }
    store.set("og-customer", c);
    const btn = $("#payBtn");
    btn.classList.add("loading");
    try {
      const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ sid, customer: c, items: cart }) });
      pending = r;
      startPayment(r);
    } catch (e) {
      if (e.data && e.data.fields) Object.entries(e.data.fields).forEach(([k, v]) => fieldMsg(k, v));
      $("#formError").textContent = e.message;
    } finally {
      btn.classList.remove("loading");
    }
  });

  // ---------- Payment ----------
  function loadRazorpay() {
    if (window.Razorpay) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = resolve; s.onerror = () => reject(new Error("Could not load the payment window. Check your connection and try again."));
      document.head.appendChild(s);
    });
  }

  async function startPayment(r) {
    renderSummary();
    if (r.payment.provider === "demo") return demoPayment(r);
    try {
      await loadRazorpay();
    } catch (e) { $("#formError").textContent = e.message; return; }
    const rzp = new window.Razorpay({
      key: r.payment.key,
      amount: r.payment.amount,
      currency: r.payment.currency,
      order_id: r.payment.gatewayOrderId,
      name: "OG — Only Gods",
      description: `Order ${r.order.id}`,
      prefill: r.payment.prefill,
      notes: { og_order_id: r.order.id },
      theme: { color: "#F7931E" },
      handler: async (resp) => {
        try {
          const v = await api(`/api/orders/${encodeURIComponent(r.order.id)}/verify`, { method: "POST", body: JSON.stringify(resp) });
          paid(v.order);
        } catch (e) { $("#formError").textContent = e.message; }
      },
      modal: { ondismiss: () => { $("#formError").textContent = "Payment not completed. Your order is saved — tap below to try again."; } },
    });
    rzp.on("payment.failed", (resp) => { $("#formError").textContent = (resp.error && resp.error.description) || "Payment failed. Please try again."; });
    rzp.open();
  }

  function demoPayment(r) {
    openModal(`
      <div class="modal-icon demo"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg></div>
      <span class="test-pill" style="margin-top:16px">Test mode</span>
      <h3 id="modalTitle">Payment gateway</h3>
      <p>Real payments are not switched on yet. This simulates a successful prepaid payment so the full order flow can be tested.</p>
      <div class="order-box"><div><span>Order</span><b class="order-id">${esc(r.order.id)}</b></div><div><span>Amount</span><b>${inr(r.order.total)}</b></div></div>
      <button class="btn btn-fire btn-block" id="demoOk">Simulate successful payment</button>
      <button class="btn btn-ghost btn-block" id="demoCancel">Cancel</button>`);
    $("#demoCancel").addEventListener("click", () => { closeModal(); $("#formError").textContent = "Payment not completed. Your order is saved — tap below to try again."; });
    $("#demoOk").addEventListener("click", async (e) => {
      e.currentTarget.classList.add("loading");
      try { const v = await api(`/api/orders/${encodeURIComponent(r.order.id)}/demo-pay`, { method: "POST", body: "{}" }); paid(v.order); }
      catch (err) { closeModal(); $("#formError").textContent = err.message; }
    });
  }

  function paid(order) {
    pending = null; cart = []; saveCart(); renderCart(); openCart(false); setStep(1);
    openModal(`
      <div class="modal-icon"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h3 id="modalTitle">You're an OG.</h3>
      <p>Payment received. Your order is confirmed and will reach ${esc(order.city)}, ${esc(order.state)} ${esc(etaText(order.eta))}*.</p>
      <div class="order-box">
        <div><span>Order ID</span><b class="order-id">${esc(order.id)}</b></div>
        ${order.items.map((i) => `<div><span>${i.qty} × ${esc(i.name.replace(/^OG\s+/, ""))} (${esc(i.flavor)})</span><b>${inr(i.qty * i.price)}</b></div>`).join("")}
        <div><span>Paid</span><b>${inr(order.total)}</b></div>
      </div>
      <p style="font-size:13px">Save your order ID. Track it any time with your mobile number.</p>
      <a class="btn btn-ghost btn-block" href="/track?id=${encodeURIComponent(order.id)}">Track order</a>
      <button class="btn btn-fire btn-block" id="doneBtn">Keep moving</button>`);
    $("#doneBtn").addEventListener("click", closeModal);
    confetti();
  }

  // ---------- Modal ----------
  const modal = $("#modal");
  function openModal(html) { $("#modalCard").innerHTML = html; modal.hidden = false; document.body.classList.add("modal-open"); }
  function closeModal() { modal.hidden = true; document.body.classList.remove("modal-open"); }
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  function confetti() {
    if (reduced) return;
    const c = document.createElement("canvas"); c.className = "confetti"; document.body.appendChild(c);
    const x = c.getContext("2d"); c.width = innerWidth * dpr; c.height = innerHeight * dpr; x.scale(dpr, dpr);
    const colors = ["#F7931E", "#111111", "#8DC63F", "#FFB547", "#F7931E"];
    const bits = Array.from({ length: 160 }, () => ({ x: innerWidth / 2, y: innerHeight / 2, vx: (Math.random() - 0.5) * 16, vy: Math.random() * -16 - 4, s: Math.random() * 6 + 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: colors[(Math.random() * colors.length) | 0] }));
    const t0 = performance.now();
    (function frame(t) {
      x.clearRect(0, 0, innerWidth, innerHeight);
      bits.forEach((b) => { b.vy += 0.4; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr; x.save(); x.translate(b.x, b.y); x.rotate(b.r); x.fillStyle = b.c; x.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); x.restore(); });
      if (t - t0 < 3200) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }

  // ---------- Pincode checker ----------
  $("#pinInput").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); });
  $("#pinForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pin = $("#pinInput").value, out = $("#pinResult");
    out.className = "pin-result";
    if (!/^\d{6}$/.test(pin)) { out.textContent = "Enter a 6-digit pincode"; out.classList.add("no"); return; }
    try {
      const r = await api("/api/pincode/" + pin);
      if (r.ok && r.priority) { out.textContent = `✓ Express zone — we deliver to ${pin} (${r.state}) in ${r.eta}, subject to availability.`; out.classList.add("ok"); }
      else if (r.ok) { out.textContent = `✓ We deliver to ${pin} within 7 days, subject to availability.`; out.classList.add("ok"); }
      else { out.textContent = "That doesn't look like a valid pincode."; out.classList.add("no"); }
    } catch { out.textContent = "Couldn't check right now. Please try again."; out.classList.add("no"); }
  });

  // ---------- Boot ----------
  renderCart();
  Promise.all([api("/api/config"), api("/api/products")])
    .then(([c, p]) => { config = c; products = p.products; renderProducts(); renderCart(); })
    .catch(() => { $("#products").innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--muted)">Couldn't load products. Please refresh the page.</p>`; });
})();
