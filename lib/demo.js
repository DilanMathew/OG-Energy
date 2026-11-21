// Demo orders for trying out the admin dashboard and WhatsApp reorder reminders.
// 50 orders spread over the last ~75 days (dates are relative to "now", so reminders show up
// whenever they're loaded). Every id contains "-DEMO" so they can be removed in one go.
const DAY = 864e5;

const CUSTOMERS = [
  ["Arjun Raman", "Chennai", "Tamil Nadu", "600040"], ["Priya Nair", "Kochi", "Kerala", "682020"],
  ["Karthik Subramanian", "Coimbatore", "Tamil Nadu", "641002"], ["Sneha Reddy", "Bengaluru", "Karnataka", "560034"],
  ["Rahul Menon", "Thiruvananthapuram", "Kerala", "695010"], ["Divya Krishnan", "Madurai", "Tamil Nadu", "625001"],
  ["Vikram Shetty", "Mangaluru", "Karnataka", "575001"], ["Ananya Iyer", "Chennai", "Tamil Nadu", "600017"],
  ["Rohan Kapoor", "Mumbai", "Maharashtra", "400050"], ["Meera Pillai", "Kozhikode", "Kerala", "673001"],
  ["Siddharth Rao", "Bengaluru", "Karnataka", "560076"], ["Kavya Suresh", "Tiruchirappalli", "Tamil Nadu", "620001"],
  ["Aditya Sharma", "New Delhi", "Delhi", "110017"], ["Lakshmi Venkat", "Salem", "Tamil Nadu", "636007"],
  ["Nikhil Joseph", "Thrissur", "Kerala", "680001"], ["Pooja Hegde", "Mysuru", "Karnataka", "570009"],
  ["Harish Kumar", "Chennai", "Tamil Nadu", "600028"], ["Fathima Rasheed", "Kochi", "Kerala", "682024"],
  ["Varun Gowda", "Bengaluru", "Karnataka", "560011"], ["Ishita Patel", "Ahmedabad", "Gujarat", "380015"],
  ["Sanjay Murthy", "Hubballi", "Karnataka", "580020"], ["Deepa Mohan", "Erode", "Tamil Nadu", "638001"],
  ["Abhishek Das", "Kolkata", "West Bengal", "700019"], ["Nandini Prakash", "Bengaluru", "Karnataka", "560095"],
  ["Gokul Raj", "Tirunelveli", "Tamil Nadu", "627002"], ["Aswathy Varma", "Kottayam", "Kerala", "686001"],
  ["Kiran Desai", "Pune", "Maharashtra", "411004"], ["Shruti Bhat", "Udupi", "Karnataka", "576101"],
  ["Manoj Selvam", "Vellore", "Tamil Nadu", "632004"], ["Riya Thomas", "Kollam", "Kerala", "691001"],
  ["Tarun Verma", "Hyderabad", "Telangana", "500033"], ["Gayathri Sundar", "Chennai", "Tamil Nadu", "600020"],
  ["Akash Nambiar", "Kannur", "Kerala", "670001"], ["Bhavana Rao", "Bengaluru", "Karnataka", "560068"],
  ["Vishnu Prasad", "Palakkad", "Kerala", "678001"], ["Neha Joshi", "Jaipur", "Rajasthan", "302001"],
  ["Prakash Raj", "Thanjavur", "Tamil Nadu", "613001"], ["Swathi Kamath", "Belagavi", "Karnataka", "590001"],
  ["Ajay Menon", "Kochi", "Kerala", "682016"], ["Dhanya Ravi", "Coimbatore", "Tamil Nadu", "641018"],
  ["Ramesh Babu", "Chennai", "Tamil Nadu", "600090"], ["Anjali Mathew", "Alappuzha", "Kerala", "688001"],
];

// Item shortcuts: [productId, flavor, qty]
const W = (f = "Swiss Choco", q = 1) => ["og-whey", f, q];
const Y = (f = "Vanilla", q = 1) => ["og-yeast", f, q];
const C = (f = "Fruit Fusion", q = 1) => ["og-creatine", f, q];

// [customer index, days ago placed, status, items, options]
// options.deliveredAfter: days after placing it was delivered; options.reminder: 'sent' | 'skipped' (days ago)
// Whey / Yeast boxes last 28 days; a reminder is "due" from day 25 and "upcoming" in the 7 days before that.
const PLAN = [
  // ---- Reminders DUE now (started 25–55 days ago) ----
  [0, 30, "delivered", [W()], { deliveredAfter: 2 }],
  [1, 29, "delivered", [Y("Choco Berry")], { deliveredAfter: 3 }],
  [2, 33, "delivered", [W("Vanilla"), C()], { deliveredAfter: 2 }],
  [3, 31, "delivered", [W()], { deliveredAfter: 3 }],
  [4, 36, "delivered", [Y()], { deliveredAfter: 2 }],
  [5, 40, "delivered", [W("Vanilla")], { deliveredAfter: 3 }],
  [6, 28, "delivered", [W(), C("Orange")], { deliveredAfter: 2 }],
  [7, 45, "delivered", [Y("Choco Berry")], { deliveredAfter: 3 }],
  [8, 27, "shipped", [W()]], // not yet marked delivered → counted from payment
  [9, 52, "delivered", [W("Vanilla")], { deliveredAfter: 2 }],
  [10, 34, "delivered", [W(), Y()], { deliveredAfter: 4 }], // 2 boxes = 56 days → upcoming later, see below
  [11, 26, "delivered", [Y()], { deliveredAfter: 1 }],
  [12, 38, "delivered", [W()], { deliveredAfter: 7 }],
  [13, 58, "delivered", [W("Swiss Choco", 2)], { deliveredAfter: 3 }], // 2 boxes, day 55 of 56

  // ---- Reminders UPCOMING (due within the next 7 days) ----
  [14, 22, "delivered", [W()], { deliveredAfter: 2 }],
  [15, 21, "delivered", [Y("Choco Berry")], { deliveredAfter: 1 }],
  [16, 23, "delivered", [W("Vanilla")], { deliveredAfter: 3 }],
  [17, 20, "delivered", [W(), C()], { deliveredAfter: 2 }],
  [18, 19, "shipped", [Y()]],
  [19, 24, "delivered", [W()], { deliveredAfter: 6 }],

  // ---- Already handled (shows under "Done") ----
  [20, 35, "delivered", [W()], { deliveredAfter: 2, reminder: ["sent", 4] }],
  [21, 32, "delivered", [Y()], { deliveredAfter: 3, reminder: ["sent", 1] }],
  [22, 41, "delivered", [W("Vanilla")], { deliveredAfter: 4, reminder: ["skipped", 6] }],

  // ---- Repeat customers who already reordered (old order drops off reminders) ----
  [23, 60, "delivered", [W()], { deliveredAfter: 2 }],
  [23, 27, "delivered", [W()], { deliveredAfter: 2 }], // reorder → its own reminder is due
  [24, 50, "delivered", [Y()], { deliveredAfter: 3 }],
  [24, 4, "packed", [Y(), C("Orange")]],
  [25, 47, "delivered", [W("Vanilla")], { deliveredAfter: 2 }],
  [25, 12, "delivered", [W("Vanilla")], { deliveredAfter: 2 }],

  // ---- Too long ago to remind (lapsed customer) ----
  [26, 75, "delivered", [W()], { deliveredAfter: 3 }],
  [27, 70, "delivered", [Y()], { deliveredAfter: 2 }],

  // ---- Recent orders still in the fulfilment queue ----
  [28, 0, "paid", [W()]],
  [29, 0, "paid", [Y("Choco Berry"), C()]],
  [30, 1, "paid", [W("Vanilla")]],
  [31, 1, "packed", [W(), W("Vanilla")]],
  [32, 2, "packed", [Y()]],
  [33, 3, "shipped", [W()]],
  [34, 5, "shipped", [W("Swiss Choco", 2)]],
  [35, 8, "delivered", [Y()], { deliveredAfter: 5 }],
  [36, 10, "delivered", [W()], { deliveredAfter: 2 }],
  [37, 14, "delivered", [W("Vanilla"), C("Orange")], { deliveredAfter: 4 }],

  // ---- Creatine only (no reminder — creatine has no days-per-unit set) ----
  [38, 6, "delivered", [C()], { deliveredAfter: 2 }],
  [39, 30, "delivered", [C("Orange", 2)], { deliveredAfter: 3 }],

  // ---- Unpaid / cancelled / refunded ----
  [40, 0, "pending_payment", [W()]],
  [41, 2, "pending_payment", [Y()]],
  [40, 9, "cancelled", [W("Vanilla")]],
  [41, 16, "refunded", [W()]],
  [8, 44, "cancelled", [C()]],
  [0, 63, "delivered", [W()], { deliveredAfter: 3 }], // first order of customer 0, reordered since
  [3, 66, "refunded", [Y()]],
];

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function buildDemoOrders(products, at = Date.now()) {
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  return PLAN.map(([ci, daysAgo, status, lines, opt = {}], n) => {
    const [name, city, state, pincode] = CUSTOMERS[ci];
    // Spread times through the day (09:00–21:00 IST) so the list looks natural.
    const created = new Date(at - daysAgo * DAY - ((n * 37) % 600) * 60000 - (daysAgo === 0 ? 0 : 3 * 3600e3));
    const iso = (d) => d.toISOString();
    const plus = (days, hours = 0) => new Date(Math.min(created.getTime() + days * DAY + hours * 3600e3, at));
    const items = lines.map(([pid, flavor, qty]) => ({ productId: pid, name: byId[pid].name, flavor, price: byId[pid].price, qty }));
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

    const history = [{ at: iso(created), status: "pending_payment", by: "customer" }];
    let paidAt = null;
    if (status !== "pending_payment") {
      const paid = plus(0, 0.05);
      if (status === "cancelled" && n % 2) {
        history.push({ at: iso(plus(0, 2)), status: "cancelled", by: "admin" }); // never paid
      } else {
        paidAt = iso(paid);
        history.push({ at: paidAt, status: "paid", by: "payment" });
        const steps = { paid: [], packed: ["packed"], shipped: ["packed", "shipped"], delivered: ["packed", "shipped", "delivered"], cancelled: ["cancelled"], refunded: ["refunded"] }[status];
        const d = opt.deliveredAfter || 3;
        const when = { packed: plus(0, 6), shipped: plus(Math.min(1, daysAgo), 2), delivered: plus(d, 4), cancelled: plus(0, 5), refunded: plus(1, 3) };
        for (const s of steps) history.push({ at: iso(when[s]), status: s, by: "admin" });
      }
    }
    const yymmdd = new Date(created.getTime() + 330 * 60000).toISOString().slice(2, 10).replace(/-/g, "");
    const id = `OG-${yymmdd}-DEMO${ALPHA[(n * 7) % 32]}${String(n + 1).padStart(2, "0")}`;
    const first = name.split(" ")[0].toLowerCase();
    return {
      id,
      createdAt: iso(created),
      updatedAt: history[history.length - 1].at,
      status,
      customer: {
        name,
        phone: `90000${String(10000 + ci * 137).slice(-5)}`, // obviously-fake 90000xxxxx numbers
        email: `${first}.demo${ci}@example.com`,
        address1: `${10 + ci * 3}, ${["MG Road", "Gandhi Street", "Temple Road", "Lake View Lane", "2nd Cross"][ci % 5]}`,
        address2: ci % 3 ? `Near ${["Bus Stand", "City Mall", "Govt School"][ci % 3]}` : null,
        city, state, pincode,
      },
      items, subtotal, shipping: 0, total: subtotal,
      paymentProvider: "demo",
      paymentId: paidAt ? `pay_DEMO${String(n + 1).padStart(4, "0")}` : null,
      paidAt,
      tracking: ["shipped", "delivered"].includes(status) ? `DTDC ${7000000000 + n * 104729}` : null,
      adminNote: "Demo order",
      history,
      reminder: opt.reminder ? { status: opt.reminder[0], at: iso(new Date(at - opt.reminder[1] * DAY)), message: opt.reminder[0] === "sent" ? `Hi ${name.split(" ")[0]}! Your OG sachets are almost over — reorder here.` : null } : null,
    };
  });
}

module.exports = { buildDemoOrders, DEMO_COUNT: PLAN.length };
