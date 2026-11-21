/* OG — Original Grind */
(() => {
  "use strict";

  // ---- Store config: edit these to change currency / pricing display ----
  const CURRENCY = "₹";
  const LOCALE = "en-IN";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const money = (n) => CURRENCY + Number(n).toLocaleString(LOCALE);

  document.body.classList.add("loading");
  $("#year").textContent = new Date().getFullYear();

  // ---------- Prices ----------
  $$(".price .cur").forEach((el) => (el.textContent = CURRENCY));
  $$(".price .amt").forEach((el) => (el.textContent = Number(el.dataset.price).toLocaleString(LOCALE)));
  const was = $(".per .was");
  if (was) was.textContent = money(2499);
  $("#buybarPrice").textContent = money(2124);

  // ---------- Preloader ----------
  const pre = $("#preloader");
  const preBar = $("#preBar");
  const preCount = $("#preCount");
  let p = 0;
  const finishLoad = () => {
    pre.classList.add("done");
    document.body.classList.remove("loading");
    setTimeout(() => document.body.classList.add("ready"), 150);
  };
  if (reduced) {
    finishLoad();
  } else {
    const tick = () => {
      p = Math.min(100, p + Math.random() * 9 + 3);
      preBar.style.width = p + "%";
      preCount.textContent = Math.floor(p);
      if (p < 100) setTimeout(tick, 45);
      else setTimeout(finishLoad, 250);
    };
    tick();
  }

  // ---------- Statement: split words ----------
  const statement = $("#statement");
  const wrapWords = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
          else {
            const s = document.createElement("span");
            s.className = "w";
            s.textContent = part;
            frag.appendChild(s);
          }
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) wrapWords(child);
    });
  };
  wrapWords(statement);
  const words = $$(".w", statement);

  // ---------- Sachet grid ----------
  const grid = $("#sachetGrid");
  for (let i = 1; i <= 28; i++) {
    const s = document.createElement("div");
    s.className = "sachet";
    s.innerHTML = `<b>OG</b><small>D${String(i).padStart(2, "0")}</small>`;
    grid.appendChild(s);
  }
  const sachets = $$(".sachet", grid);
  const phases = [
    ["Week 1 — Ignite", "Your body gets the steady protein supply it's been begging for. Recovery starts to feel different."],
    ["Week 2 — Adapt", "The habit locks in. One sachet, every day. Soreness fades faster and energy holds through the session."],
    ["Week 3 — Build", "This is where the work compounds. Heavier sets, extra reps, the kind of pump you notice in the mirror."],
    ["Week 4 — Own it", "28 days. Zero missed. You're not the same lifter who opened this box. Time to order the next one."],
  ];
  const dayNum = $("#dayNum");
  const phaseEl = $("#phase");
  const phaseTitle = $("#phaseTitle");
  const phaseText = $("#phaseText");
  const weeks = $$(".wk");
  const journey = $("#journey");
  let lastDay = -1;
  let lastWeek = -1;

  const updateJourney = () => {
    const r = journey.getBoundingClientRect();
    const total = journey.offsetHeight - window.innerHeight;
    const prog = Math.min(1, Math.max(0, -r.top / total));
    const day = Math.max(1, Math.min(28, Math.ceil(prog * 28.5)));
    if (day !== lastDay) {
      lastDay = day;
      dayNum.textContent = String(day).padStart(2, "0");
      sachets.forEach((s, i) => {
        s.classList.toggle("on", i < day);
        s.classList.toggle("current", i === day - 1);
      });
    }
    const week = Math.min(3, Math.floor((day - 1) / 7));
    weeks.forEach((w, i) => {
      const wp = Math.min(1, Math.max(0, (day - i * 7) / 7));
      w.style.setProperty("--p", wp);
      w.classList.toggle("active", i === week);
    });
    if (week !== lastWeek) {
      lastWeek = week;
      phaseTitle.textContent = phases[week][0];
      phaseText.textContent = phases[week][1];
      phaseEl.classList.remove("swap");
      void phaseEl.offsetWidth;
      phaseEl.classList.add("swap");
    }
  };

  // ---------- Scroll-driven effects ----------
  const nav = $("#nav");
  const progress = $("#progress");
  const buybar = $("#buybar");
  const box = $("#box3d");
  const hero = $("#hero");
  const pricing = $("#pricing");
  let lastY = window.scrollY;
  let mouseRX = 0, mouseRY = 0;

  const updateBox = () => {
    if (reduced) return;
    const y = Math.min(window.scrollY, hero.offsetHeight);
    const ry = -28 + y * 0.12 + mouseRY;
    const rx = -8 + mouseRX - y * 0.02;
    box.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  };

  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle("scrolled", y > 30);
    nav.classList.toggle("hide", y > lastY && y > 600 && !document.body.classList.contains("menu-open"));
    lastY = y;

    const pr = pricing.getBoundingClientRect();
    const pricingVisible = pr.top < window.innerHeight * 0.8 && pr.bottom > 0;
    const jr = journey.getBoundingClientRect();
    const inJourney = jr.top < window.innerHeight && jr.bottom > 0;
    buybar.classList.toggle("show", y > window.innerHeight * 0.8 && !pricingVisible && !inJourney);

    // statement words light up
    const sr = statement.getBoundingClientRect();
    const sp = Math.min(1, Math.max(0, (window.innerHeight * 0.85 - sr.top) / (sr.height + window.innerHeight * 0.35)));
    const lit = Math.floor(sp * words.length);
    words.forEach((w, i) => w.classList.toggle("lit", i < lit));

    updateJourney();
    updateBox();
  };

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(() => { onScroll(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  // ---------- Mouse: glow + box tilt ----------
  if (fine && !reduced) {
    const glow = $("#cursorGlow");
    window.addEventListener("pointermove", (e) => {
      glow.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      mouseRY = (e.clientX / window.innerWidth - 0.5) * 30;
      mouseRX = -(e.clientY / window.innerHeight - 0.5) * 16;
      updateBox();
    }, { passive: true });
  }

  // Touch drag to spin the box on phones
  if (!fine && !reduced) {
    const scene = $("#scene");
    let startX = null, base = 0;
    scene.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; base = mouseRY; }, { passive: true });
    scene.addEventListener("touchmove", (e) => {
      if (startX === null) return;
      mouseRY = base + (e.touches[0].clientX - startX) * 0.6;
      updateBox();
    }, { passive: true });
    scene.addEventListener("touchend", () => { startX = null; });
  }

  // ---------- Reveal on view ----------
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("in");
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  $$(".reveal").forEach((el) => io.observe(el));

  // ---------- Counters ----------
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const target = +el.dataset.count;
      const dur = 1600;
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 4);
        el.textContent = Math.round(target * eased);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      countIO.unobserve(el);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => countIO.observe(el));

  // ---------- Card tilt ----------
  if (fine && !reduced) {
    $$(".tilt").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        card.style.setProperty("--mx", x * 100 + "%");
        card.style.setProperty("--my", y * 100 + "%");
        card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 10}deg) rotateY(${(x - 0.5) * 12}deg) translateY(-6px)`;
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    });

    // Magnetic buttons
    $$(".magnetic").forEach((b) => {
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        b.style.transform = `translate(${x * 0.22}px, ${y * 0.3}px)`;
      });
      b.addEventListener("pointerleave", () => { b.style.transform = ""; });
    });
  }

  // ---------- Ember particles ----------
  const canvas = $("#embers");
  const ctx = canvas.getContext("2d");
  let W, H, embers = [], dpr = Math.min(window.devicePixelRatio || 1, 2), heroVisible = true;
  const resize = () => {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(90, (W * H) / 16000));
    embers = Array.from({ length: n }, () => spawn(true));
  };
  const spawn = (anywhere) => ({
    x: Math.random() * W,
    y: anywhere ? Math.random() * H : H + 10,
    r: Math.random() * 2.2 + 0.4,
    vy: Math.random() * 0.7 + 0.25,
    vx: (Math.random() - 0.5) * 0.3,
    life: Math.random() * 0.6 + 0.4,
    hue: 15 + Math.random() * 30,
    t: Math.random() * 100,
  });
  const draw = () => {
    if (heroVisible) {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      for (const e of embers) {
        e.t += 0.02;
        e.y -= e.vy;
        e.x += e.vx + Math.sin(e.t) * 0.3;
        const fade = Math.min(1, e.y / H) * e.life;
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 4);
        g.addColorStop(0, `hsla(${e.hue},100%,62%,${fade})`);
        g.addColorStop(1, `hsla(${e.hue},100%,50%,0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 4, 0, Math.PI * 2);
        ctx.fill();
        if (e.y < -10) Object.assign(e, spawn(false));
      }
    }
    requestAnimationFrame(draw);
  };
  if (!reduced) {
    resize();
    window.addEventListener("resize", resize);
    new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; }).observe(hero);
    requestAnimationFrame(draw);
  }

  // ---------- Mobile menu ----------
  const burger = $("#burger");
  const setMenu = (open) => {
    document.body.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", String(open));
  };
  burger.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
  $$("#navLinks a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

  // ---------- Flavour picker ----------
  let flavor = "Molten Chocolate";
  $$(".flavor").forEach((b) => b.addEventListener("click", () => {
    $$(".flavor").forEach((x) => { x.classList.remove("active"); x.setAttribute("aria-checked", "false"); });
    b.classList.add("active");
    b.setAttribute("aria-checked", "true");
    flavor = b.dataset.flavor;
    $(".pack-flavor").textContent = flavor;
  }));

  // ---------- Cart ----------
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem("og-cart") || "[]"); } catch { cart = []; }
  const save = () => { try { localStorage.setItem("og-cart", JSON.stringify(cart)); } catch {} };
  const cartCount = $("#cartCount");
  const cartItems = $("#cartItems");
  const cartTotal = $("#cartTotal");

  const render = () => {
    const count = cart.reduce((a, i) => a + i.qty, 0);
    cartCount.textContent = count;
    cartCount.classList.toggle("show", count > 0);
    cartTotal.textContent = money(cart.reduce((a, i) => a + i.qty * i.price, 0));
    if (!cart.length) {
      cartItems.innerHTML = `<div class="cart-empty"><b>OG</b>Your stack is empty.<br/>Day 01 is waiting.</div>`;
      return;
    }
    cartItems.innerHTML = "";
    cart.forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = "ci";
      row.innerHTML = `
        <div class="ci-thumb">OG</div>
        <div>
          <h4></h4><small></small>
          <div class="qty"><button aria-label="Decrease">−</button><span>${item.qty}</span><button aria-label="Increase">+</button></div>
        </div>
        <div class="ci-price">${money(item.price * item.qty)}</div>`;
      row.querySelector("h4").textContent = item.plan;
      row.querySelector("small").textContent = item.flavor;
      const [dec, inc] = row.querySelectorAll(".qty button");
      dec.addEventListener("click", () => { item.qty--; if (item.qty <= 0) cart.splice(idx, 1); save(); render(); });
      inc.addEventListener("click", () => { item.qty++; save(); render(); });
      cartItems.appendChild(row);
    });
  };

  const openCart = (open) => {
    document.body.classList.toggle("cart-open", open);
    $("#cart").setAttribute("aria-hidden", String(!open));
  };
  $("#cartOpen").addEventListener("click", () => openCart(true));
  $("#cartClose").addEventListener("click", () => openCart(false));
  $("#cartOverlay").addEventListener("click", () => openCart(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { openCart(false); setMenu(false); } });

  const toast = $("#toast");
  let toastT;
  const showToast = (msg) => {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove("show"), 2600);
  };

  $$(".add").forEach((b) => b.addEventListener("click", () => {
    const plan = b.dataset.plan;
    const price = +b.dataset.price;
    const existing = cart.find((i) => i.plan === plan && i.flavor === flavor);
    if (existing) existing.qty++;
    else cart.push({ plan, flavor, price, qty: 1 });
    save();
    render();
    cartCount.classList.remove("bump");
    void cartCount.offsetWidth;
    cartCount.classList.add("bump");
    setTimeout(() => openCart(true), 250);
  }));

  $("#checkout").addEventListener("click", () => {
    if (!cart.length) return showToast("Add a box to start your grind 🔥");
    showToast("Checkout opens at launch — your stack is saved.");
  });

  render();
})();
