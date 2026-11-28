/* OG — direct UPI payment panel (shared by the storefront checkout and the track page).
   OGUPI.render(el, { order, payment }, { onSubmitted(order), onLater() })
   payment: { amount, payee, vpa|null, uri|null, qrSvg|null, qrImage|null, exactAmount } */
(() => {
  "use strict";
  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const SUPPORT_WA = "919842121163";

  const ICON_COPY = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;
  const ICON_LOCK = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;

  function flash(el, text) {
    const old = el.dataset.label || el.innerHTML;
    el.dataset.label = old;
    el.innerHTML = text;
    el.classList.add("done");
    setTimeout(() => { el.innerHTML = old; el.classList.remove("done"); }, 1600);
  }
  function copy(text, btn) {
    const ok = () => flash(btn, "Copied");
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(ok, () => fallback());
    fallback();
    function fallback() {
      const t = document.createElement("textarea");
      t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); ok(); } catch {}
      t.remove();
    }
  }

  function render(el, { order, payment: p }, { onSubmitted, onLater, laterLabel = "I'll pay later" } = {}) {
    const wa = `https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent(`Hi OG, I need help paying for order ${order.id} (${inr(p.amount)}).`)}`;
    const qr = p.qrSvg
      ? `<div class="upi-qr-svg" role="img" aria-label="UPI QR code to pay ${esc(inr(p.amount))} to ${esc(p.payee)}">${p.qrSvg}</div>`
      : `<img src="${esc(p.qrImage)}" alt="UPI QR code to pay ${esc(p.payee)}" width="451" height="452" />`;
    const steps = p.exactAmount
      ? [`${coarse && p.uri ? "Tap <b>Pay with UPI app</b>, or scan" : "Scan"} the QR with any UPI app — amount and order note are filled in for you.`,
         "Approve the payment with your UPI PIN.",
         "Enter the 12-digit UPI reference number below to confirm your order."]
      : [`Scan the QR with any UPI app and enter exactly <b>${inr(p.amount)}</b>.`,
         `Add your order ID <b>${esc(order.id)}</b> in the note / remarks, if your app allows it.`,
         "Enter the 12-digit UPI reference number below to confirm your order."];

    el.innerHTML = `
      <div class="upi">
        <span class="upi-kicker">${ICON_LOCK} Pay via UPI</span>
        <h3 id="modalTitle">Scan &amp; pay</h3>
        <div class="upi-amount">
          <span>Amount to pay</span>
          <b>${inr(p.amount)}</b>
          <button type="button" class="upi-chip" data-copy="${esc(String(p.amount))}">${ICON_COPY}<span>Copy amount</span></button>
        </div>
        <div class="upi-qr">
          ${qr}
          <p class="upi-payee">Paying <b>${esc(p.payee)}</b></p>
        </div>
        <div class="upi-apps" aria-label="Works with any UPI app"><span>GPay</span><span>PhonePe</span><span>Paytm</span><span>BHIM</span><span>Any UPI app</span></div>
        ${coarse && p.uri ? `<a class="btn btn-fire btn-block upi-open" href="${esc(p.uri)}">Pay ${inr(p.amount)} with UPI app</a>` : ""}
        ${coarse && !p.uri ? `<a class="btn btn-ghost btn-block upi-save" href="${esc(p.qrImage)}" download="OG-UPI-QR.png">Save QR to gallery</a>
          <p class="upi-tip">Paying from this phone? Save the QR, open your UPI app → <b>Scan QR</b> → choose the image from your gallery.</p>` : ""}
        <div class="upi-rows">
          ${p.vpa ? `<div class="upi-row"><span>UPI ID</span><b>${esc(p.vpa)}</b><button type="button" class="upi-chip" data-copy="${esc(p.vpa)}">${ICON_COPY}<span>Copy</span></button></div>` : ""}
          <div class="upi-row"><span>Order ID</span><b class="mono">${esc(order.id)}</b><button type="button" class="upi-chip" data-copy="${esc(order.id)}">${ICON_COPY}<span>Copy</span></button></div>
        </div>
        <ol class="upi-steps">${steps.map((s) => `<li>${s}</li>`).join("")}</ol>
        <form class="upi-form" novalidate>
          <div class="field">
            <label for="upiUtr">UPI reference / UTR number</label>
            <input id="upiUtr" name="utr" inputmode="numeric" autocomplete="off" enterkeyhint="done" maxlength="15" placeholder="12-digit number" required />
            <small></small>
          </div>
          <p class="upi-help">You'll find it on the payment success screen or in your UPI app's history — shown as <b>UPI Ref. No.</b>, <b>UTR</b> or <b>UPI transaction ID</b>.</p>
          <p class="form-error" role="alert"></p>
          <button class="btn btn-fire btn-block upi-submit" type="submit">I've paid — confirm my order</button>
        </form>
        ${onLater ? `<button class="btn btn-ghost btn-block upi-later" type="button">${esc(laterLabel)}</button>` : ""}
        <p class="upi-assist">Payment issue? <a href="${wa}" target="_blank" rel="noopener">WhatsApp us</a> with your order ID. Your order is confirmed once we verify the payment.</p>
      </div>`;

    el.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => copy(b.dataset.copy, b)));
    const later = el.querySelector(".upi-later");
    if (later) later.addEventListener("click", () => onLater());

    const form = el.querySelector(".upi-form");
    const input = form.elements.utr;
    const small = form.querySelector(".field small");
    const errP = form.querySelector(".form-error");
    const setErr = (m) => { form.querySelector(".field").classList.toggle("err", !!m); small.textContent = m || ""; };
    input.addEventListener("input", () => {
      const d = input.value.replace(/\D/g, "").slice(0, 12);
      input.value = d.replace(/(\d{4})(?=\d)/g, "$1 ");
      setErr(""); errP.textContent = "";
    });
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      errP.textContent = "";
      const utr = input.value.replace(/\D/g, "");
      if (utr.length !== 12) { setErr("Enter the 12-digit UPI reference number"); input.focus(); return; }
      const btn = form.querySelector(".upi-submit");
      btn.classList.add("loading"); btn.disabled = true;
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/upi-submit`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ utr }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data.fields && data.fields.utr) setErr(data.fields.utr);
          throw new Error(data.error || "Couldn't submit right now. Please try again.");
        }
        onSubmitted(data.order);
      } catch (e) { errP.textContent = e.message; }
      finally { btn.classList.remove("loading"); btn.disabled = false; }
    });
  }

  window.OGUPI = { render, inr, esc };
})();
