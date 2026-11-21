/* OG Admin */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const inr = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
  const inrShort = (n) => n >= 1e7 ? "₹" + (n / 1e7).toFixed(1) + "Cr" : n >= 1e5 ? "₹" + (n / 1e5).toFixed(1) + "L" : n >= 1e3 ? "₹" + (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "k" : "₹" + n;
  const pct = (a, b) => (b ? ((a / b) * 100).toFixed(a / b < 0.1 ? 1 : 0) + "%" : "—");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dt = (iso) => iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
  const STATUS = { pending_payment: "Unpaid", paid: "To pack", packed: "To ship", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded" };
  const pill = (s) => `<span class="st ${esc(s)}">${STATUS[s] || esc(s)}</span>`;

  async function api(path, opts = {}) {
    const res = await fetch(path, { credentials: "same-origin", ...opts, headers: { "Content-Type": "application/json", "X-OG-Admin": "1", ...(opts.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !path.endsWith("/login")) { showLogin(); throw new Error("Signed out"); }
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }
  let toastT;
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); };

  // ---------- Auth ----------
  function showLogin() { $("#app").hidden = true; $("#login").hidden = false; setTimeout(() => $("#pw").focus(), 50); }
  async function boot() {
    try {
      const me = await api("/api/admin/me");
      $("#login").hidden = true; $("#app").hidden = false;
      paymentBanner(me);
      showTab(location.hash.slice(1) || "overview");
      if (location.hash.slice(1) !== "reminders") api("/api/admin/reminders").then((r) => remBadge(r.due.length)).catch(() => {});
    } catch { showLogin(); }
  }
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#loginErr").textContent = "";
    $("#loginBtn").disabled = true;
    try { await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: $("#pw").value }) }); $("#pw").value = ""; boot(); }
    catch (err) { $("#loginErr").textContent = err.message; }
    finally { $("#loginBtn").disabled = false; }
  });
  $("#logout").addEventListener("click", async () => { await api("/api/admin/logout", { method: "POST" }).catch(() => {}); showLogin(); });

  let me = {};
  function paymentBanner(info) {
    me = info;
    const b = $("#payBanner");
    if (info.paymentMode === "demo") { b.className = "banner demo"; b.innerHTML = "<b>Test mode:</b> payments are simulated — no real money is collected. Add your Razorpay keys on the server to go live."; b.hidden = false; }
    else if (info.paymentMode === "off") { b.className = "banner off"; b.innerHTML = "<b>Checkout is disabled:</b> no payment gateway is configured, so customers cannot place orders."; b.hidden = false; }
    else if (!info.webhook) { b.className = "banner demo"; b.innerHTML = "<b>Live payments on.</b> Tip: also set <b>RAZORPAY_WEBHOOK_SECRET</b> so payments are confirmed even if a customer closes the browser mid-payment."; b.hidden = false; }
    else b.hidden = true;
  }

  // ---------- Tabs ----------
  const loaders = { overview: loadOverview, orders: loadOrders, reminders: loadReminders, products: loadProducts, settings: loadSettings };
  function showTab(name) {
    if (!loaders[name]) name = "overview";
    $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
    $$(".view").forEach((v) => (v.hidden = v.id !== "view-" + name));
    if (location.hash.slice(1) !== name) history.replaceState(null, "", "#" + name);
    loaders[name]();
    window.scrollTo(0, 0);
  }
  $$("#tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  document.addEventListener("click", (e) => { const g = e.target.closest("[data-goto]"); if (g) showTab(g.dataset.goto); });

  // ---------- Overview ----------
  let days = 30;
  $$("#range button").forEach((b) => b.addEventListener("click", () => { days = +b.dataset.days; $$("#range button").forEach((x) => x.classList.toggle("on", x === b)); loadOverview(); }));

  async function loadOverview() {
    const [s, recent] = await Promise.all([api("/api/admin/stats?days=" + days), api("/api/admin/orders?status=all")]);
    $("#rangeLabel").textContent = days ? `Last ${days} days (IST)` : "All time";
    const f = s.funnel;
    $("#kpis").innerHTML = [
      { l: "Revenue", v: inr(s.revenue), c: "paid orders only", hero: true },
      { l: "Paid orders", v: s.paidOrders, c: `${s.ordersCreated} checkouts placed` },
      { l: "Avg. order value", v: inr(s.aov), c: "per paid order" },
      { l: "Store conversion", v: pct(f.paid, f.visitors), c: `${f.visitors} visitors → ${f.paid} paid` },
      { l: "Checkout conversion", v: pct(s.paidOrders, s.ordersCreated), c: "placed → paid" },
      { l: "Unpaid / abandoned", v: s.pendingPayments, c: `${s.cancelled} cancelled or refunded` },
    ].map((k) => `<div class="kpi${k.hero ? " hero" : ""}"><div class="lbl">${k.l}</div><div class="val" title="${esc(k.v)}">${k.v}</div><div class="ctx">${k.c}</div></div>`).join("");

    const q = s.queue;
    const qi = (d) => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
    $("#queue").innerHTML = [
      { st: "paid", t: "To pack", n: q.paid || 0, s: "paid, not packed", i: qi("M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9") },
      { st: "packed", t: "To ship", n: q.packed || 0, s: "packed, awaiting pickup", i: qi("M3 7h11v10H3zM14 10h4l3 3v4h-7M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z") },
      { st: "shipped", t: "In transit", n: q.shipped || 0, s: "with courier", i: qi("M5 12h14M13 6l6 6-6 6") },
      { st: "open", t: "Open total", n: (q.paid || 0) + (q.packed || 0) + (q.shipped || 0), s: "not yet delivered", i: qi("M4 6h16M4 12h16M4 18h10") },
    ].map((x) => `<button class="q${x.n && x.st !== "shipped" && x.st !== "open" ? " attn" : ""}" data-status-jump="${x.st}"><span class="ico">${x.i}</span><span><span class="n">${x.n}</span><span class="t"> ${x.t}</span><small>${x.s}</small></span></button>`).join("");
    $$("[data-status-jump]").forEach((b) => b.addEventListener("click", () => { status = b.dataset.statusJump; showTab("orders"); }));
    const open = (q.paid || 0) + (q.packed || 0);
    $("#openBadge").hidden = !open; $("#openBadge").textContent = open;

    revenueChart(s);
    funnel(f);
    hbars($("#states"), s.byState.map((r) => ({ name: r.state, v: r.revenue, label: inr(r.revenue), sub: `${r.orders} orders` })), "No paid orders in this period yet.");
    hbars($("#mix"), s.productMix.slice(0, 6).map((r) => ({ name: r.label.replace(/^OG\s+/, "").split(" — ").reverse().join(" · "), v: r.revenue, label: `${r.units} sold`, sub: inr(r.revenue) })), "No sales in this period yet.");
    const rec = recent.orders.slice(0, 6);
    $("#recent").innerHTML = rec.length ? rec.map((o) => `<div class="mini" data-open="${esc(o.id)}"><div class="who">${esc(o.customer.name)}<small><span class="id">${esc(o.id)}</span> · ${dt(o.createdAt)}</small></div>${pill(o.status)}<b>${inr(o.total)}</b></div>`).join("") : `<div class="empty">No orders yet. They'll appear here the moment a customer checks out.</div>`;
  }

  // Daily revenue: single series bar chart, 4px rounded tops, hover tooltip.
  function revenueChart(s) {
    const el = $("#revChart");
    const byDay = Object.fromEntries(s.daily.map((d) => [d.day, d]));
    const visits = Object.fromEntries(s.visitsDaily.map((d) => [d.day, d.n]));
    const start = days ? new Date(s.since + "T00:00:00Z") : new Date((s.daily[0] || { day: s.since === "0000-00-00" ? new Date().toISOString().slice(0, 10) : s.since }).day + "T00:00:00Z");
    const end = new Date(new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10) + "T00:00:00Z");
    const pts = [];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const k = d.toISOString().slice(0, 10);
      pts.push({ day: k, revenue: (byDay[k] || {}).revenue || 0, orders: (byDay[k] || {}).orders || 0, visits: visits[k] || 0 });
    }
    if (!pts.length) pts.push({ day: end.toISOString().slice(0, 10), revenue: 0, orders: 0, visits: 0 });
    $("#revTotal").textContent = `${inr(s.revenue)} total`;

    const W = el.clientWidth || 800, H = el.clientHeight || 260, padL = 48, padB = 26, padT = 8, padR = 4;
    const iw = W - padL - padR, ih = H - padT - padB;
    const maxV = Math.max(...pts.map((p) => p.revenue));
    const nice = (v) => { if (v <= 0) return 1000; const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
    const top = nice(maxV * 1.08);
    const slot = iw / pts.length, gap = Math.max(2, Math.min(8, slot * 0.25)), bw = Math.max(1, slot - gap);
    const y = (v) => padT + ih - (v / top) * ih;
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenue per day">`;
    for (let i = 0; i <= 4; i++) {
      const v = (top / 4) * i, yy = y(v);
      svg += `<line class="${i ? "gl" : "base"}" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}"/><text class="yl" x="${padL - 8}" y="${yy + 4}" text-anchor="end">${inrShort(v)}</text>`;
    }
    pts.forEach((p, i) => {
      const x = padL + i * slot + gap / 2;
      if (p.revenue > 0) {
        const h = Math.max(2, (p.revenue / top) * ih), r = Math.min(4, bw / 2, h), yb = padT + ih;
        svg += `<path class="bar" data-i="${i}" d="M${x},${yb} V${yb - h + r} Q${x},${yb - h} ${x + r},${yb - h} H${x + bw - r} Q${x + bw},${yb - h} ${x + bw},${yb - h + r} V${yb} Z"/>`;
      }
      svg += `<rect class="hit" data-i="${i}" x="${padL + i * slot}" y="${padT}" width="${slot}" height="${ih}"/>`;
    });
    const fmtD = (k) => new Date(k + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
    const ticks = pts.length <= 8 ? pts.map((_, i) => i) : [0, Math.floor(pts.length / 2), pts.length - 1];
    ticks.forEach((i) => { const x = padL + i * slot + slot / 2; svg += `<text class="xl" x="${x}" y="${H - 6}" text-anchor="${i === 0 && pts.length > 8 ? "start" : i === pts.length - 1 && pts.length > 8 ? "end" : "middle"}">${fmtD(pts[i].day)}</text>`; });
    svg += `</svg>`;
    el.innerHTML = svg;

    const tip = $("#tip");
    $$(".hit", el).forEach((h) => {
      const show = (e) => {
        const p = pts[+h.dataset.i];
        el.classList.add("hovering");
        $$(".bar", el).forEach((b) => b.classList.toggle("hot", b.dataset.i === h.dataset.i));
        tip.innerHTML = `<b>${new Date(p.day + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</b><div class="tr"><span>Revenue</span><strong>${inr(p.revenue)}</strong></div><div class="tr"><span>Paid orders</span><strong>${p.orders}</strong></div><div class="tr"><span>Visitors</span><strong>${p.visits}</strong></div>`;
        const r = h.getBoundingClientRect();
        const tx = Math.min(window.innerWidth - 170, Math.max(8, r.left + r.width / 2 - 80));
        tip.style.left = tx + "px"; tip.style.top = Math.max(8, (e.clientY || r.top) - 110) + "px";
        tip.classList.add("show");
      };
      h.addEventListener("pointerenter", show); h.addEventListener("pointermove", show);
      h.addEventListener("pointerleave", () => { tip.classList.remove("show"); el.classList.remove("hovering"); });
    });
  }

  function funnel(f) {
    const steps = [["Visitors", f.visitors], ["Added to cart", f.addedToCart], ["Started checkout", f.checkoutStarted], ["Paid", f.paid]];
    const max = Math.max(1, steps[0][1], ...steps.map((s) => s[1]));
    $("#funnel").innerHTML = steps.map(([n, v], i) => `
      <div class="hb"><div class="name">${n}</div><div class="track"><div class="fill" style="width:${(v / max) * 100}%"></div></div><div class="num">${v}<small>${i ? pct(v, f.visitors) : ""}</small></div>
      ${i ? `<div class="step">${pct(v, steps[i - 1][1])} of previous step</div>` : ""}</div>`).join("");
  }

  function hbars(el, rows, emptyMsg) {
    if (!rows.length) { el.innerHTML = `<div class="empty">${emptyMsg}</div>`; return; }
    const max = Math.max(...rows.map((r) => r.v), 1);
    el.innerHTML = rows.map((r) => `<div class="hb"><div class="name" title="${esc(r.name)}">${esc(r.name)}</div><div class="track"><div class="fill" style="width:${(r.v / max) * 100}%"></div></div><div class="num">${esc(r.label)}<small>${esc(r.sub)}</small></div></div>`).join("");
  }

  // ---------- Orders ----------
  let status = "open", q = "", searchT;
  $$("#statusChips button").forEach((b) => b.addEventListener("click", () => { status = b.dataset.status; loadOrders(); }));
  $("#search").addEventListener("input", (e) => { clearTimeout(searchT); searchT = setTimeout(() => { q = e.target.value.trim(); loadOrders(); }, 250); });

  async function loadOrders() {
    $$("#statusChips button").forEach((b) => b.classList.toggle("on", b.dataset.status === status));
    $("#exportCsv").href = "/api/admin/orders.csv?status=" + encodeURIComponent(status);
    const { orders } = await api(`/api/admin/orders?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`);
    $("#ordersCount").textContent = `${orders.length} order${orders.length === 1 ? "" : "s"}`;
    $("#ordersBody").innerHTML = orders.length ? orders.map((o) => `
      <tr data-open="${esc(o.id)}">
        <td><span class="id">${esc(o.id)}</span><small>${dt(o.createdAt)}</small></td>
        <td>${esc(o.customer.name)}<small>${esc(o.customer.phone)}</small></td>
        <td class="c-items">${o.items.map((i) => `${i.qty}× ${esc(i.name.replace(/^OG\s+/, ""))} <small style="display:inline">(${esc(i.flavor)})</small>`).join("<br>")}</td>
        <td class="c-ship">${esc(o.customer.city)}<small>${esc(o.customer.state)} · ${esc(o.customer.pincode)}</small></td>
        <td class="r c-tot"><span class="tot">${inr(o.total)}</span></td>
        <td class="c-st">${pill(o.status)}</td>
      </tr>`).join("") : `<tr><td colspan="6"><div class="empty">No orders match this filter.</div></td></tr>`;
  }

  document.addEventListener("click", (e) => { const r = e.target.closest("[data-open]"); if (r) openOrder(r.dataset.open); });

  const NEXT = {
    paid: [["packed", "Mark packed", "primary"], ["cancelled", "Cancel order", "danger"]],
    packed: [["shipped", "Mark shipped", "primary"], ["cancelled", "Cancel order", "danger"]],
    shipped: [["delivered", "Mark delivered", "primary"]],
    delivered: [["refunded", "Mark refunded", "danger"]],
    cancelled: [["refunded", "Mark refunded", ""]],
    pending_payment: [["cancelled", "Cancel (unpaid)", "danger"]],
    refunded: [],
  };
  async function openOrder(id) {
    const { order: o } = await api("/api/admin/orders/" + encodeURIComponent(id));
    const c = o.customer;
    const addr = [c.name, c.address1, c.address2, `${c.city}, ${c.state} ${c.pincode}`, `+91 ${c.phone}`].filter(Boolean).join("\n");
    const d = $("#drawer");
    d.innerHTML = `
      <div class="d-top"><div><h2>${esc(o.id)}</h2><div style="margin-top:8px">${pill(o.status)} <span class="muted" style="margin-left:6px">${dt(o.createdAt)}</span></div></div><button class="x" id="dClose" aria-label="Close">✕</button></div>
      <div class="d-sec"><h4>Update</h4>
        <div class="actions">${(NEXT[o.status] || []).map(([s, l, cls]) => `<button class="btn ${cls}" data-set="${s}">${l}</button>`).join("") || `<span class="muted">No further actions.</span>`}</div>
        <label class="fld"><span>Courier / tracking number</span><input id="dTracking" value="${esc(o.tracking || "")}" placeholder="e.g. DTDC Z12345678" /></label>
        <label class="fld"><span>Internal note</span><textarea id="dNote" rows="2">${esc(o.adminNote || "")}</textarea></label>
        <button class="btn" id="dSave" style="margin-top:10px">Save details</button>
      </div>
      <div class="d-sec"><h4>Ship to</h4><div class="d-addr">${esc(addr)}</div><div class="muted" style="margin-top:6px">${esc(c.email)}</div><button class="copy" id="dCopy">Copy address</button></div>
      <div class="d-sec"><h4>Items</h4>
        ${o.items.map((i) => `<div class="d-row"><span>${i.qty} × ${esc(i.name)} (${esc(i.flavor)})</span><b>${inr(i.qty * i.price)}</b></div>`).join("")}
        <div class="d-row"><span>Shipping</span><b>${inr(o.shipping)}</b></div>
        <div class="d-row" style="border-top:1px solid var(--line);margin-top:6px;padding-top:8px"><span>Total</span><b>${inr(o.total)}</b></div>
      </div>
      <div class="d-sec"><h4>Payment</h4>
        <div class="d-row"><span>Method</span><b>${o.paymentProvider === "demo" ? "Test payment" : "Razorpay"}</b></div>
        <div class="d-row"><span>Payment ID</span><b style="font-family:ui-monospace,monospace;font-size:12px">${esc(o.paymentId || "—")}</b></div>
        <div class="d-row"><span>Paid at</span><b>${o.paidAt ? dt(o.paidAt) : "Not paid"}</b></div>
      </div>
      <div class="d-sec"><h4>History</h4><ul class="hist">${o.history.slice().reverse().map((h) => `<li><span>${STATUS[h.status] || esc(h.status)} · ${esc(h.by)}</span><span>${dt(h.at)}</span></li>`).join("")}</ul></div>`;
    d.classList.add("open"); d.setAttribute("aria-hidden", "false"); $("#scrim").hidden = false;
    $("#dClose").addEventListener("click", closeDrawer);
    $("#dCopy").addEventListener("click", () => { navigator.clipboard && navigator.clipboard.writeText(addr).then(() => toast("Address copied")); });
    const save = async (body) => {
      try {
        await api("/api/admin/orders/" + encodeURIComponent(o.id), { method: "PATCH", body: JSON.stringify({ tracking: $("#dTracking").value, adminNote: $("#dNote").value, ...body }) });
        toast(body.status ? `Marked ${STATUS[body.status].toLowerCase()}` : "Saved");
        openOrder(o.id);
        if (!$("#view-orders").hidden) loadOrders(); else if (!$("#view-overview").hidden) loadOverview();
      } catch (err) { toast(err.message); }
    };
    $$("[data-set]", d).forEach((b) => b.addEventListener("click", () => {
      const s = b.dataset.set;
      if ((s === "cancelled" || s === "refunded") && !confirm(`${b.textContent}? This can't be undone from the dashboard.`)) return;
      save({ status: s });
    }));
    $("#dSave").addEventListener("click", () => save({}));
  }
  function closeDrawer() { const d = $("#drawer"); d.classList.remove("open"); d.setAttribute("aria-hidden", "true"); $("#scrim").hidden = true; }
  $("#scrim").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

  // ---------- Reminders ----------
  const dmy = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const itemsText = (items) => items.map((i) => `${i.qty > 1 ? i.qty + "× " : ""}${i.name} (${i.flavor})`).join(", ");
  const remBadge = (n) => { $("#remBadge").hidden = !n; $("#remBadge").textContent = n; };
  function fillTemplate(tpl, c) {
    const vals = {
      name: (c.name || "").trim().split(/\s+/)[0] || "there",
      product: c.items.map((i) => `${i.name} (${i.flavor})`).join(" and "),
      date: new Date(c.runOutAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" }),
      link: location.origin,
    };
    return tpl.replace(/\{(name|product|date|link)\}/g, (_, k) => vals[k]);
  }
  function leftTag(c) {
    if (c.daysLeft > 1) return `<span class="tag soon">${c.daysLeft} days left</span>`;
    if (c.daysLeft === 1) return `<span class="tag soon">Runs out tomorrow</span>`;
    if (c.daysLeft === 0) return `<span class="tag over">Runs out today</span>`;
    return `<span class="tag over">Ran out ${-c.daysLeft} day${c.daysLeft === -1 ? "" : "s"} ago</span>`;
  }

  async function loadReminders() {
    const r = await api("/api/admin/reminders");
    remBadge(r.due.length);
    $("#remDueCount").textContent = r.due.length ? `${r.due.length} to review` : "";
    $("#remDue").innerHTML = r.due.length ? r.due.map((c) => `
      <div class="rem" data-rem="${esc(c.orderId)}">
        <div class="rem-top"><div><h3>${esc(c.name)}</h3><small>+91 ${esc(c.phone)} · ${esc(c.city)}</small></div>${leftTag(c)}</div>
        <p class="rem-items">${esc(itemsText(c.items))}</p>
        <div class="rem-meter${c.daysLeft <= 0 ? " over" : ""}"><i style="width:${Math.min(100, (c.daysUsed / c.totalDays) * 100)}%"></i></div>
        <div class="rem-meta">Day ${Math.min(c.daysUsed, c.totalDays)} of ${c.totalDays} since ${c.startedFrom} on ${dmy(c.startedAt)} · runs out ${dmy(c.runOutAt)} · order <button class="link" data-open="${esc(c.orderId)}">${esc(c.orderId)}</button></div>
        <label class="fld"><span>Message</span><textarea rows="7" maxlength="2000">${esc(fillTemplate(r.template, c))}</textarea></label>
        <div class="rem-actions">
          <button class="btn" data-act="skipped">Skip</button>
          <button class="btn wa" data-act="sent">Approve &amp; send on WhatsApp</button>
        </div>
      </div>`).join("") : `<div class="panel"><div class="empty">No reminders due. Customers show up here from day ${28 - r.leadDays} of a 28-sachet box.</div></div>`;

    $("#remUpcoming").innerHTML = r.upcoming.length ? r.upcoming.map((c) => `
      <div class="rem-row"><div class="who">${esc(c.name)} <span class="muted">+91 ${esc(c.phone)}</span><small>${esc(itemsText(c.items))}</small></div>
      <div class="when">Reminder due ${dmy(c.dueAt)}<br><small>runs out ${dmy(c.runOutAt)}</small></div></div>`).join("") : `<div class="empty">Nobody else runs out in the next week.</div>`;

    $("#remDone").innerHTML = r.done.length ? r.done.map((c) => `
      <div class="rem-row" data-rem="${esc(c.orderId)}"><div class="who">${esc(c.name)} <span class="muted">+91 ${esc(c.phone)}</span><small>${esc(itemsText(c.items))}</small></div>
      <span class="tag ${esc(c.reminder.status)}">${c.reminder.status === "sent" ? "Sent" : "Skipped"} ${dt(c.reminder.at)}</span>
      <button class="link" data-act="reset">Undo</button></div>`).join("") : `<div class="empty">Nothing yet.</div>`;

    const byId = Object.fromEntries([...r.due, ...r.done].map((c) => [c.orderId, c]));
    $$("[data-act]", $("#view-reminders")).forEach((b) => b.addEventListener("click", async () => {
      const box = b.closest("[data-rem]"), c = byId[box.dataset.rem], action = b.dataset.act;
      let message;
      if (action === "sent") {
        message = $("textarea", box).value.trim();
        if (!message) return toast("Write a message first");
        // Open WhatsApp synchronously (inside the click) so the browser doesn't block it.
        window.open(`https://wa.me/91${c.phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
      }
      b.disabled = true;
      try {
        await api("/api/admin/reminders/" + encodeURIComponent(c.orderId), { method: "POST", body: JSON.stringify({ action, message }) });
        toast(action === "sent" ? `Opened WhatsApp for ${c.name} — marked sent` : action === "skipped" ? "Skipped" : "Moved back to due");
        loadReminders();
      } catch (err) { b.disabled = false; toast(err.message); }
    }));
  }

  // ---------- Products ----------
  async function loadProducts() {
    const { products } = await api("/api/admin/products");
    $("#prodGrid").innerHTML = products.map((p) => `
      <form class="prod" data-id="${esc(p.id)}">
        <div class="prod-top"><div class="ph" style="--pc:${esc(p.accent)}"><img src="${esc(p.image)}" alt="" /></div>
          <div><h3>${esc(p.name)}</h3><small>${esc(p.flavors.map((f) => f.name).join(" · "))}</small></div></div>
        <div class="row3">
          <label class="fld"><span>Price (₹)</span><input name="price" type="number" min="1" value="${p.price}" required /></label>
          <label class="fld"><span>MRP (₹)</span><input name="mrp" type="number" min="1" value="${p.mrp ?? ""}" placeholder="—" /></label>
          <label class="fld"><span>Stock</span><input name="stock" type="number" min="0" value="${p.stock ?? ""}" placeholder="Not tracked" /></label>
        </div>
        <label class="fld"><span>Days one unit lasts (for WhatsApp reminders)</span><input name="supplyDays" type="number" min="1" max="365" value="${p.supplyDays ?? ""}" placeholder="No reminders" /></label>
        <label class="toggle"><input type="checkbox" name="inStock" ${p.inStockFlag ? "checked" : ""} /> Available to buy</label>
        <label class="toggle"><input type="checkbox" name="active" ${p.active ? "checked" : ""} /> Show on store</label>
        <button class="btn primary">Save</button>
      </form>`).join("");
    $$(".prod").forEach((f) => f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const el = f.elements;
      try {
        await api("/api/admin/products/" + f.dataset.id, { method: "PATCH", body: JSON.stringify({ price: el.price.value, mrp: el.mrp.value, stock: el.stock.value, supplyDays: el.supplyDays.value, inStock: el.inStock.checked, active: el.active.checked }) });
        toast("Product saved");
      } catch (err) { toast(err.message); }
    }));
  }

  // ---------- Settings ----------
  async function loadSettings() {
    const s = await api("/api/admin/settings");
    $("#shipFee").value = s.shippingFee;
    $("#remTemplate").value = s.reminderTemplate;
    api("/api/admin/demo-orders").then((r) => { $("#demoCount").textContent = r.count ? `${r.count} orders` : "None"; }).catch(() => {});
    const mode = { razorpay: "Live — Razorpay", demo: "Test mode (simulated)", off: "Not configured" }[me.paymentMode] || "—";
    $("#payInfo").innerHTML = `<h3>Payments</h3><p class="muted">Prepaid only — cash on delivery is not offered.</p>
      <div class="kv"><span class="muted">Gateway</span><b>${mode}</b></div>
      <div class="kv"><span class="muted">Webhook</span><b>${me.webhook ? "Configured" : "Not set"}</b></div>
      <div class="kv"><span class="muted">Delivery</span><b>TN · KA · KL 2–3 days · rest of India 7 days</b></div>`;
  }
  $("#shipForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ shippingFee: $("#shipFee").value }) }); toast("Shipping fee saved"); }
    catch (err) { toast(err.message); }
  });

  $("#remForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ reminderTemplate: $("#remTemplate").value }) }); toast("Reminder message saved"); }
    catch (err) { toast(err.message); }
  });

  async function demo(method) {
    const r = await api("/api/admin/demo-orders", { method });
    $("#demoCount").textContent = r.count ? `${r.count} orders` : "None";
    return r;
  }
  $("#demoLoad").addEventListener("click", async () => {
    try { await demo("POST"); toast("Demo orders loaded — see Orders and Reminders"); api("/api/admin/reminders").then((r) => remBadge(r.due.length)).catch(() => {}); }
    catch (err) { toast(err.message); }
  });
  $("#demoClear").addEventListener("click", async () => {
    if (!confirm("Remove all demo orders?")) return;
    try { await demo("DELETE"); toast("Demo orders removed"); api("/api/admin/reminders").then((r) => remBadge(r.due.length)).catch(() => {}); }
    catch (err) { toast(err.message); }
  });

  let resizeT;
  window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (!$("#view-overview").hidden && !$("#app").hidden) loadOverview(); }, 300); });

  boot();
})();
