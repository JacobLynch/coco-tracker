import { NextResponse } from "next/server";

const WIDGET_SCRIPT = `
// Coco Capital — Scriptable Widget
// Tap the widget to open the dashboard in Safari.

const BASE_URL = "{{BASE_URL}}";
const PERIOD = "1d";

// ── Data ────────────────────────────────────────────────────────────────

async function fetchSummary() {
  const req = new Request(BASE_URL + "/api/summary?period=" + PERIOD);
  req.timeoutInterval = 15;
  return await req.loadJSON();
}

// ── Formatting ──────────────────────────────────────────────────────────

function formatDollars(n) {
  const sign = n < 0 ? "-" : "";
  const whole = Math.floor(Math.abs(n)).toLocaleString("en-US");
  const cents = "." + Math.abs(n).toFixed(2).split(".")[1];
  return { sign, whole, cents };
}

function formatChange(n) {
  const sign = n >= 0 ? "+" : "";
  return sign + n.toLocaleString("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2,
  });
}

function formatPct(n) {
  const sign = n >= 0 ? "+" : "";
  return sign + n.toFixed(2) + "%";
}

function formatDate(s) {
  const d = new Date(s + "T00:00:00");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return months[d.getMonth()] + " " + d.getDate();
}

// ── Colors ──────────────────────────────────────────────────────────────

const C = {
  bg:        new Color("#09090b"),
  white:     new Color("#fafafa"),
  zinc400:   new Color("#a1a1aa"),
  zinc500:   new Color("#71717a"),
  zinc600:   new Color("#52525b"),
  zinc700:   new Color("#3f3f46"),
  emerald:   new Color("#34d399"),
  emeraldDim:new Color("#34d399", 0.12),
  red:       new Color("#f87171"),
  redDim:    new Color("#f87171", 0.12),
};

// ── Widget ──────────────────────────────────────────────────────────────

async function buildWidget() {
  const data = await fetchSummary();
  const positive = data.period_change_usd >= 0;
  const accent = positive ? C.emerald : C.red;
  const bal = formatDollars(data.current_balance);

  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(16, 16, 12, 16);
  w.url = BASE_URL;

  // ── Header row: label + dot ───────────────────────────────────────
  const header = w.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();

  const dot = header.addText("●");
  dot.font = Font.systemFont(6);
  dot.textColor = C.emerald;

  header.addSpacer(5);

  const title = header.addText("COCO CAPITAL");
  title.font = Font.semiboldSystemFont(9);
  title.textColor = C.zinc600;
  title.textOpacity = 1;

  header.addSpacer();

  w.addSpacer(6);

  // ── Balance ───────────────────────────────────────────────────────
  const balRow = w.addStack();
  balRow.layoutHorizontally();
  balRow.bottomAlignContent();

  const dollars = balRow.addText(bal.sign + "$" + bal.whole);
  dollars.font = Font.semiboldMonospacedSystemFont(28);
  dollars.textColor = C.white;
  dollars.minimumScaleFactor = 0.6;
  dollars.lineLimit = 1;

  const cents = balRow.addText(bal.cents);
  cents.font = Font.semiboldMonospacedSystemFont(16);
  cents.textColor = C.zinc500;

  balRow.addSpacer();

  w.addSpacer(6);

  // ── Change row ────────────────────────────────────────────────────
  const changeRow = w.addStack();
  changeRow.layoutHorizontally();
  changeRow.centerAlignContent();
  changeRow.spacing = 6;

  const usdChange = changeRow.addText(formatChange(data.period_change_usd));
  usdChange.font = Font.semiboldMonospacedSystemFont(12);
  usdChange.textColor = accent;

  // Pill for percentage
  const pill = changeRow.addStack();
  pill.backgroundColor = positive ? C.emeraldDim : C.redDim;
  pill.cornerRadius = 10;
  pill.setPadding(3, 7, 3, 7);

  const pctText = pill.addText(formatPct(data.period_change_pct));
  pctText.font = Font.boldMonospacedSystemFont(10);
  pctText.textColor = accent;

  changeRow.addSpacer();

  w.addSpacer();

  // ── Footer: as-of date ────────────────────────────────────────────
  const footer = w.addStack();
  footer.layoutHorizontally();

  const dateLabel = footer.addText(formatDate(data.as_of));
  dateLabel.font = Font.mediumSystemFont(9);
  dateLabel.textColor = C.zinc700;

  footer.addSpacer();

  const periodLabel = footer.addText(PERIOD.toUpperCase());
  periodLabel.font = Font.boldSystemFont(9);
  periodLabel.textColor = C.zinc700;

  return w;
}

// ── Error Widget ────────────────────────────────────────────────────────

function buildError(msg) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(16, 16, 16, 16);

  const t = w.addText("Coco Capital");
  t.font = Font.semiboldSystemFont(12);
  t.textColor = C.zinc500;
  w.addSpacer(8);

  const e = w.addText(msg);
  e.font = Font.systemFont(11);
  e.textColor = C.red;
  return w;
}

// ── Main (wrapped in async IIFE for eval() compatibility) ───────────────

await (async () => {
  try {
    const widget = await buildWidget();
    if (config.runsInWidget) {
      Script.setWidget(widget);
    } else {
      await widget.presentSmall();
    }
  } catch (err) {
    const widget = buildError(err.message || "Failed to load");
    if (config.runsInWidget) {
      Script.setWidget(widget);
    } else {
      await widget.presentSmall();
    }
  }
  Script.complete();
})();
`;

export async function GET(request: Request) {
  // Determine the base URL from the request or env
  const url = new URL(request.url);
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    `${url.protocol}//${url.host}`;

  const script = WIDGET_SCRIPT.replace(/\{\{BASE_URL}}/g, baseUrl);

  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}