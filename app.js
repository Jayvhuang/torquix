/* Torquix — tire, wheel & running-cost calculators for car owners.
 * 10 client-side tools. Everything runs locally in the browser.
 * Bilingual (EN / 中文) via bi-en / bi-zh spans toggled by <html data-lang>.
 */
(function () {
  "use strict";

  /* ============================================================
   * 1. Constants & small helpers
   * ============================================================ */
  var MM_IN = 25.4;
  var KM_MI = 1.609344;
  var L_GAL = 3.785411784;
  var KG_LB = 0.45359237;
  var KPA_PSI = 6.894757293;
  var M_FT = 0.3048;
  var ATM_PSI = 14.6959488;              // standard sea-level pressure
  var CO2_KG_PER_GAL_GASOLINE = 8.887;   // US EPA, gasoline
  var CO2_KG_PER_GAL_DIESEL = 10.180;    // US EPA, diesel

  var state = { lang: "en", theme: "light", sys: "us" };
  var landingTool = window.TORQUIX_TOOL || null;

  function bi(en, zh) { return '<span class="bi-en">' + en + '</span><span class="bi-zh">' + zh + '</span>'; }
  function L(en, zh) { return state.lang === "zh" ? zh : en; }
  function isUS() { return state.sys === "us"; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function num(x, dp) {
    if (x === null || x === undefined || !isFinite(x)) return "—";
    var d = (dp === undefined) ? 2 : dp;
    return x.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d });
  }
  function sgn(x, dp) {
    if (!isFinite(x)) return "—";
    return (x > 0 ? "+" : x < 0 ? "\u2212" : "") + num(Math.abs(x), dp);
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function hhmm(hours) {
    if (!isFinite(hours) || hours < 0) return "—";
    var totalMin = Math.round(hours * 60);
    var h = Math.floor(totalMin / 60), m = totalMin % 60;
    return h + "h " + (m < 10 ? "0" : "") + m + "m";
  }

  /* ============================================================
   * 2. Unit framework — every field value is stored in a canonical unit
   * ============================================================ */
  var UCONV = {
    speed: { us: "mph", met: "km/h", to: function (v, s) { return s === "us" ? v : v / KM_MI; }, from: function (v, s) { return s === "us" ? v : v * KM_MI; } },
    dist:  { us: "mi",  met: "km",   to: function (v, s) { return s === "us" ? v : v / KM_MI; }, from: function (v, s) { return s === "us" ? v : v * KM_MI; } },
    vol:   { us: "gal", met: "L",    to: function (v, s) { return s === "us" ? v : v / L_GAL; }, from: function (v, s) { return s === "us" ? v : v * L_GAL; } },
    press: { us: "psi", met: "kPa",  to: function (v, s) { return s === "us" ? v : v / KPA_PSI; }, from: function (v, s) { return s === "us" ? v : v * KPA_PSI; } },
    mass:  { us: "lb",  met: "kg",   to: function (v, s) { return s === "us" ? v : v / KG_LB; }, from: function (v, s) { return s === "us" ? v : v * KG_LB; } },
    len:   { us: "in",  met: "mm",   to: function (v, s) { return s === "us" ? v : v / MM_IN; }, from: function (v, s) { return s === "us" ? v : v * MM_IN; } },
    alt:   { us: "ft",  met: "m",    to: function (v, s) { return s === "us" ? v : v / M_FT; }, from: function (v, s) { return s === "us" ? v : v * M_FT; } },
    temp:  { us: "°F",  met: "°C",   to: function (v, s) { return s === "us" ? v : v * 9 / 5 + 32; }, from: function (v, s) { return s === "us" ? v : (v - 32) * 5 / 9; } },
    ppv:   { us: "per gal", met: "per L", to: function (v, s) { return s === "us" ? v : v * L_GAL; }, from: function (v, s) { return s === "us" ? v : v / L_GAL; } },
    econ:  { us: "MPG (US)", met: "L/100 km", to: function (v, s) { return s === "us" ? v : (v > 0 ? 235.214583 / v : NaN); }, from: function (v, s) { return s === "us" ? v : (v > 0 ? 235.214583 / v : NaN); } },
    evEff: { us: "mi/kWh", met: "km/kWh", to: function (v, s) { return s === "us" ? v : v / KM_MI; }, from: function (v, s) { return s === "us" ? v : v * KM_MI; } }
  };
  function unitLabel(u) { var c = UCONV[u]; return c ? (isUS() ? c.us : c.met) : ""; }

  // display formatters: value is canonical, output shows active system first
  function fSpeed(mph) { return isUS() ? num(mph, 1) + " mph" : num(mph * KM_MI, 1) + " km/h"; }
  function fSpeedAlt(mph) { return isUS() ? num(mph * KM_MI, 1) + " km/h" : num(mph, 1) + " mph"; }
  function fDist(mi, dp) { return isUS() ? num(mi, dp === undefined ? 1 : dp) + " mi" : num(mi * KM_MI, dp === undefined ? 1 : dp) + " km"; }
  function fDistAlt(mi, dp) { return isUS() ? num(mi * KM_MI, dp === undefined ? 1 : dp) + " km" : num(mi, dp === undefined ? 1 : dp) + " mi"; }
  function fVol(gal) { return isUS() ? num(gal, 2) + " gal" : num(gal * L_GAL, 2) + " L"; }
  function fVolAlt(gal) { return isUS() ? num(gal * L_GAL, 2) + " L" : num(gal, 2) + " gal"; }
  function fMass(lb, dp) { var d = dp === undefined ? 0 : dp; return isUS() ? num(lb, d) + " lb" : num(lb * KG_LB, d) + " kg"; }
  function fMassAlt(lb, dp) { var d = dp === undefined ? 0 : dp; return isUS() ? num(lb * KG_LB, d) + " kg" : num(lb, d) + " lb"; }
  function fPress(psi) { return isUS() ? num(psi, 1) + " psi" : num(psi * KPA_PSI, 0) + " kPa"; }
  function fPressAlt(psi) { return isUS() ? num(psi * KPA_PSI, 0) + " kPa / " + num(psi * KPA_PSI / 100, 2) + " bar" : num(psi, 1) + " psi"; }
  function fInMm(inch, dp) { return num(inch, dp === undefined ? 2 : dp) + " in"; }
  function fMmIn(mm) { return num(mm, 1) + " mm"; }

  /* ============================================================
   * 3. Tire size parsing
   * ============================================================ */
  /** Parse "225/45R17", "P225/45ZR17", "33x12.50R15", "195R14".
   *  Returns { widthMm, aspect, rimIn, sidewallMm, odMm, odIn, label } or null. */
  function parseTire(raw) {
    if (raw === null || raw === undefined) return null;
    var s = String(raw).toUpperCase().replace(/\s+/g, "").replace(/[，,]/g, "");
    if (!s) return null;
    var m;

    // Flotation / LT inch sizing: 33X12.50R15, 31X10.5-15
    m = s.match(/^(\d{2}(?:\.\d+)?)X(\d{1,2}(?:\.\d+)?)(?:LT)?[R\-]?(\d{2}(?:\.\d+)?)(?:LT)?$/);
    if (m) {
      var od = parseFloat(m[1]), wIn = parseFloat(m[2]), rim = parseFloat(m[3]);
      if (!(od > rim)) return null;
      var swIn = (od - rim) / 2;
      return {
        widthMm: wIn * MM_IN, aspect: (swIn / wIn) * 100, rimIn: rim,
        sidewallMm: swIn * MM_IN, odMm: od * MM_IN, odIn: od,
        label: s, kind: "flotation"
      };
    }

    // Metric with aspect ratio: 225/45R17, LT265/70R17, 225/45ZR17, 225/45-17
    m = s.match(/^(?:P|LT|ST|T|C)?(\d{3})\/(\d{2,3})(?:Z|ZR|R|-)?R?(\d{2}(?:\.\d)?)$/);
    if (m) {
      var w = parseFloat(m[1]), asp = parseFloat(m[2]), rm = parseFloat(m[3]);
      if (!(w > 0 && asp > 0 && rm > 0)) return null;
      var sw = w * asp / 100;
      return {
        widthMm: w, aspect: asp, rimIn: rm, sidewallMm: sw,
        odMm: rm * MM_IN + 2 * sw, odIn: (rm * MM_IN + 2 * sw) / MM_IN,
        label: s, kind: "metric"
      };
    }

    // Metric, aspect omitted (full profile, treated as 82 series): 195R14
    m = s.match(/^(?:P|LT)?(\d{3})[R\-](\d{2})$/);
    if (m) {
      var w2 = parseFloat(m[1]), rm2 = parseFloat(m[2]), asp2 = 82, sw2 = w2 * asp2 / 100;
      return {
        widthMm: w2, aspect: asp2, rimIn: rm2, sidewallMm: sw2,
        odMm: rm2 * MM_IN + 2 * sw2, odIn: (rm2 * MM_IN + 2 * sw2) / MM_IN,
        label: s, kind: "metric-noaspect"
      };
    }
    return null;
  }
  function revsPerMile(odIn) { return 63360 / (Math.PI * odIn); }
  function revsPerKm(odMm) { return 1000000 / (Math.PI * odMm); }

  /* ============================================================
   * 4. i18n chrome dictionary
   * ============================================================ */
  var I18N = {
    en: {
      nav_tools: "Calculators", nav_how: "How it works", nav_faq: "FAQ", nav_privacy: "Privacy",
      hero_eyebrow: "Free · Private · No sign-up",
      hero_title: "Run the numbers before you buy the wheels",
      hero_sub: "Ten car calculators that answer the questions a parts page never does: will this tire fit, how far will it poke, how wrong is my speedometer, and what will it actually cost to drive.",
      hero_cta: "Open the calculators",
      hp1: "Wheel width included in the offset math",
      hp2: "Live to-scale tire & fitment diagrams",
      hp3: "Imperial and metric, both ways",
      hp4: "Runs 100% in your browser",
      tools_title: "Ten car calculators",
      tools_sub: "Pick a job, type your specs, and read the answer straight off the diagram. Nothing is uploaded.",
      how_title: "How Torquix works",
      how_sub: "Every tool is the same three moves: turn a spec code into real geometry, apply the physics, then translate it back into something you can act on.",
      how1_t: "1. Decode the spec",
      how1_d: "225/45R17 is not a size, it is three numbers in three different units. Torquix converts sidewall percentages, rim inches and section millimetres into one honest diameter before anything else happens.",
      how2_t: "2. Apply the physics",
      how2_d: "Rolling circumference drives speedometer error and gearing. Offset and rim width place the wheel relative to the hub face. Gay-Lussac's law moves tire pressure with temperature. Same equations a workshop uses.",
      how3_t: "3. Make it a decision",
      how3_d: "A number is useless until it is a yes or a no. Torquix flags the ±3% diameter rule, tongue-weight ranges, TPMS trigger thresholds and cost-per-mile so you leave with an answer, not homework.",
      vision_title: "Who this is for",
      vision_d: "Torquix is built for the person standing in front of a wheel-and-tire listing at 11pm, for the owner who just fitted bigger tires and does not trust the speedometer, for the family pricing a road trip, and for the driver working out whether an EV actually pays. Shops have these numbers. Now you do too.",
      sources_title: "Where the numbers come from",
      faq_title: "Frequently asked questions",
      amazon_title: "Tools that pair with these calculators",
      amazon_disclosure: "Torquix is an Amazon Associate. As an Amazon Associate we earn from qualifying purchases. This never changes the price you pay.",
      footer_tagline: "Torquix — private, browser-based tire, wheel and running-cost calculators.",
      footer_privacy: "Privacy Policy",
      footer_disclaimer: "Torquix is a planning and estimating aid, not a fitment guarantee or an engineering service. Real-world clearance depends on suspension travel, fender liners, brake hardware and tire construction; loaded rolling radius differs from the theoretical diameter. Always confirm against your vehicle's door-jamb placard, owner's manual and, for towing or structural changes, a qualified professional.",
      footer_rights: "© 2026 Torquix. All calculations run locally in your browser.",
      back_all: "← All calculators",
      unit_us: "US units (in, mph, psi, gal)", unit_met: "Metric (mm, km/h, kPa, L)"
    },
    zh: {
      nav_tools: "计算器", nav_how: "工作原理", nav_faq: "常见问题", nav_privacy: "隐私",
      hero_eyebrow: "免费 · 隐私优先 · 无需注册",
      hero_title: "下单买轮毂之前，先把数算清楚",
      hero_sub: "十款汽车计算器，回答商品页永远不会告诉你的问题：这条胎装不装得下、轮毂会外抛多少、码表偏了多少、这台车开起来到底多少钱一公里。",
      hero_cta: "打开计算器",
      hp1: "偏距计算把轮毂宽度也算进去",
      hp2: "轮胎与装配位置实时等比示意图",
      hp3: "英制、公制随时互切",
      hp4: "100% 在你的浏览器本地运行",
      tools_title: "十款汽车计算器",
      tools_sub: "选一个场景，填上参数，答案直接画在示意图上。所有数据都不上传。",
      how_title: "Torquix 的工作原理",
      how_sub: "每个工具都是同样三步：把规格代码还原成真实几何尺寸，套用物理公式，再翻译成你能据此做决定的结论。",
      how1_t: "1. 解码规格",
      how1_d: "225/45R17 并不是「一个尺寸」，而是三个单位完全不同的数字。Torquix 先把扁平比、轮辋英寸和胎宽毫米统一换算成一个真实外径，再谈其他。",
      how2_t: "2. 套用物理",
      how2_d: "滚动周长决定码表误差与传动比；偏距和轮辋宽度共同决定轮毂相对于轮毂法兰面的位置；查理定律决定胎压随温度的变化。和修理厂用的是同一套公式。",
      how3_t: "3. 变成一个决定",
      how3_d: "数字本身没用，能给出「行 / 不行」才有用。Torquix 会标出 ±3% 外径规则、舌重合理区间、TPMS 报警阈值和每公里成本——你带走的是结论，不是作业。",
      vision_title: "这个站为谁而做",
      vision_d: "为深夜盯着轮毂轮胎商品页拿不定主意的人，为刚换了大轮胎却不敢信码表的车主，为一家人出发前想算清油钱的司机，也为正在犹豫电车到底省不省的人。这些数字修理厂一直都有，现在你也有了。",
      sources_title: "数据依据",
      faq_title: "常见问题",
      amazon_title: "配套的实用工具",
      amazon_disclosure: "Torquix 是 Amazon Associates 会员。作为会员，我们会从符合条件的购买中获得佣金，这不会影响你支付的价格。",
      footer_tagline: "Torquix —— 隐私优先、基于浏览器的轮胎、轮毂与用车成本计算器。",
      footer_privacy: "隐私政策",
      footer_disclaimer: "Torquix 是用于规划和估算的辅助工具，不是装配保证，也不是工程设计服务。实际间隙取决于悬挂行程、翼子板内衬、制动卡钳和轮胎结构；负载滚动半径也与理论外径不同。请以车辆 B 柱／门框铭牌和车主手册为准；涉及拖挂或结构改动，请咨询有资质的专业人员。",
      footer_rights: "© 2026 Torquix。所有计算均在你的浏览器本地完成。",
      back_all: "← 返回全部计算器",
      unit_us: "英制（in / mph / psi / gal）", unit_met: "公制（mm / km/h / kPa / L）"
    }
  };

  /* ============================================================
   * 5. Tool definitions
   * ============================================================ */
  function F(id, labEn, labZh, def, opt) {
    var f = { id: id, lab: [labEn, labZh], def: def, type: "num" };
    if (opt) for (var k in opt) if (Object.prototype.hasOwnProperty.call(opt, k)) f[k] = opt[k];
    return f;
  }
  function H(en, zh) { return { head: [en, zh] }; }

  var TOOLS = [];

  /* ---------- Tool 1: Tire size comparison ---------- */
  TOOLS.push({
    id: "tire-compare",
    slug: "tire-size-comparison",
    name: ["Tire Size Comparison", "轮胎尺寸对比"],
    tab: ["Tire compare", "轮胎对比"],
    desc: [
      "Put two tire sizes side by side to scale: diameter, section width, sidewall, revolutions per mile, speedometer error and ride-height change.",
      "把两条轮胎按真实比例并排对比：外径、断面宽、胎壁高、每英里转数、码表误差和车身高度变化。"
    ],
    fields: [
      H("Current tire", "原车轮胎"),
      F("a", "Tire size A (current)", "轮胎尺寸 A（原车）", "225/45R17", { type: "text", hint: ["225/45R17, P225/45ZR17, 33x12.50R15 and 195R14 all parse", "支持 225/45R17、P225/45ZR17、33x12.50R15、195R14 等写法"] }),
      H("New tire", "打算换的轮胎"),
      F("b", "Tire size B (new)", "轮胎尺寸 B（新）", "245/40R18", { type: "text" }),
      F("v", "Speedometer reading to check", "要核对的码表读数", 60, { u: "speed" })
    ],
    calc: function (v, s) {
      var A = parseTire(s("a")), B = parseTire(s("b"));
      if (!A) return { err: ["Tire size A is not a size Torquix recognises.", "无法识别轮胎尺寸 A 的写法。"] };
      if (!B) return { err: ["Tire size B is not a size Torquix recognises.", "无法识别轮胎尺寸 B 的写法。"] };

      var dDiffIn = B.odIn - A.odIn;
      var dPct = (B.odIn / A.odIn - 1) * 100;
      var wDiff = B.widthMm - A.widthMm;
      var swDiff = B.sidewallMm - A.sidewallMm;
      var rideIn = dDiffIn / 2;
      var indicated = v("v");
      var trueSpeed = indicated * (B.odIn / A.odIn);

      var flags = [];
      var ad = Math.abs(dPct);
      if (ad <= 3) flags.push(["ok", L("Within the ±3% diameter rule", "在 ±3% 外径规则以内")]);
      else if (ad <= 5) flags.push(["warn", L("Outside ±3% — check TPMS, ABS and clearance", "超出 ±3% —— 需要留意 TPMS、ABS 和间隙")]);
      else flags.push(["bad", L("More than 5% diameter change — speedometer, ABS and gearing all affected", "外径变化超过 5% —— 码表、ABS 和传动比都会受影响")]);
      if (Math.abs(wDiff) >= 20) flags.push(["warn", L("Section width changes by " + num(Math.abs(wDiff), 0) + " mm — confirm rim width and fender clearance", "断面宽变化 " + num(Math.abs(wDiff), 0) + " mm —— 请确认轮辋宽度与翼子板间隙")]);

      // speed table
      var pts = isUS() ? [30, 45, 60, 75] : [50 / KM_MI, 80 / KM_MI, 100 / KM_MI, 120 / KM_MI];
      var rows = pts.map(function (p) {
        return [fSpeed(p), fSpeed(p * B.odIn / A.odIn), sgn(p * (B.odIn / A.odIn - 1) * (isUS() ? 1 : KM_MI), 1)];
      });

      return {
        res: [
          { l: ["Diameter A", "A 外径"], v: fInMm(A.odIn), s: fMmIn(A.odMm) },
          { l: ["Diameter B", "B 外径"], v: fInMm(B.odIn), s: fMmIn(B.odMm) },
          { l: ["Diameter change", "外径变化"], v: sgn(dDiffIn, 2) + " in", s: sgn(dPct, 2) + " %  ·  " + sgn(B.odMm - A.odMm, 1) + " mm", accent: true },
          { l: ["Ride height change", "车身高度变化"], v: sgn(rideIn, 2) + " in", s: sgn(rideIn * MM_IN, 1) + " mm " + L("at the axle", "（轴心抬升）") },
          { l: ["Section width", "断面宽"], v: num(A.widthMm, 0) + " → " + num(B.widthMm, 0) + " mm", s: sgn(wDiff, 0) + " mm" },
          { l: ["Sidewall height", "胎壁高度"], v: num(A.sidewallMm, 1) + " → " + num(B.sidewallMm, 1) + " mm", s: sgn(swDiff, 1) + " mm" },
          { l: ["Revs per mile", "每英里转数"], v: num(revsPerMile(A.odIn), 0) + " → " + num(revsPerMile(B.odIn), 0), s: num(revsPerKm(A.odMm), 0) + " → " + num(revsPerKm(B.odMm), 0) + " /km" },
          { l: ["True speed at " + fSpeed(indicated), fSpeed(indicated) + " 时的真实车速"], v: fSpeed(trueSpeed), s: sgn(dPct, 2) + " % " + L("speedometer error", "码表误差"), accent: true }
        ],
        flags: flags,
        table: {
          head: [L("Speedometer says", "码表显示"), L("You are really doing", "实际车速"), L("Difference", "差值")],
          rows: rows
        },
        svg: tireSvg(A, B),
        legend: [["a", L("A · current", "A · 原车")], ["b", L("B · new", "B · 新胎")]],
        formula: [
          "Overall diameter = rim × 25.4 + 2 × (section width × aspect ÷ 100). Speedometer error = (D<sub>new</sub> ÷ D<sub>old</sub> − 1) × 100%.",
          "外径 = 轮辋英寸 × 25.4 + 2 ×（断面宽 × 扁平比 ÷ 100）。码表误差 =（新外径 ÷ 原外径 − 1）× 100%。"
        ],
        note: [
          "These are unloaded, theoretical dimensions from the size code — the industry-standard way to compare sizes. A loaded tire squats a little, so real revs per mile run slightly higher and real diameter slightly lower than shown. Manufacturers also build the same size to slightly different specs.",
          "以上是按尺寸代码算出的空载理论尺寸，也是行业内比较尺寸的通用口径。轮胎受载后会略微下沉，因此实际每英里转数会略高、实际外径略低。同一规格不同品牌的实测值也会有差异。"
        ]
      };
    }
  });

  /* ---------- Tool 2: Wheel offset & backspacing ---------- */
  TOOLS.push({
    id: "wheel-offset",
    slug: "wheel-offset-backspacing",
    name: ["Wheel Offset & Backspacing", "轮毂偏距与内背距"],
    tab: ["Wheel offset", "轮毂偏距"],
    desc: [
      "Wheel width, offset, spacer and tire width in one calculation — so you get real poke and real inner clearance, not just an offset difference.",
      "把轮辋宽度、偏距、垫片和胎宽放进同一次计算——得到真实的外抛量和真实的内侧间隙，而不只是偏距差。"
    ],
    fields: [
      H("Current wheel", "原车轮毂"),
      F("w1", "Rim width (in)", "轮辋宽度（英寸）", 7.5, { step: 0.5 }),
      F("et1", "Offset ET (mm)", "偏距 ET（mm）", 45, { hint: ["Positive ET moves the wheel inboard, negative pushes it out", "ET 为正表示轮毂向内收，为负表示向外抛"] }),
      F("t1", "Tire section width (mm)", "轮胎断面宽（mm）", 225),
      H("New wheel", "新轮毂"),
      F("w2", "Rim width (in)", "轮辋宽度（英寸）", 8.5, { step: 0.5 }),
      F("et2", "Offset ET (mm)", "偏距 ET（mm）", 35),
      F("t2", "Tire section width (mm)", "轮胎断面宽（mm）", 245),
      F("sp", "Spacer thickness (mm)", "垫片厚度（mm）", 0, { hint: ["A spacer subtracts directly from effective offset", "垫片会等量减小有效偏距"] })
    ],
    calc: function (v) {
      var w1 = v("w1"), et1 = v("et1"), t1 = v("t1");
      var w2 = v("w2"), et2 = v("et2"), t2 = v("t2"), sp = v("sp");
      if (!(w1 > 0 && w2 > 0)) return { err: ["Rim width must be greater than zero.", "轮辋宽度必须大于 0。"] };
      var W1 = w1 * MM_IN + MM_IN;          // overall wheel width incl. both flanges (+1 in)
      var W2 = w2 * MM_IN + MM_IN;
      var etE = et2 - sp;                    // effective offset after spacer

      var bs1 = (W1 / 2 + et1) / MM_IN;      // backspacing, inches
      var bs2 = (W2 / 2 + etE) / MM_IN;

      var out1 = W1 / 2 - et1, out2 = W2 / 2 - etE;       // rim outer lip, mm from hub face
      var in1 = W1 / 2 + et1, in2 = W2 / 2 + etE;         // rim inner lip
      var tOut1 = t1 / 2 - et1, tOut2 = t2 / 2 - etE;     // tire outer sidewall
      var tIn1 = t1 / 2 + et1, tIn2 = t2 / 2 + etE;       // tire inner sidewall

      var poke = out2 - out1;
      var tirePoke = (t1 > 0 && t2 > 0) ? (tOut2 - tOut1) : NaN;
      var innerLoss = in2 - in1;                          // + = deeper toward suspension
      var tireInner = (t1 > 0 && t2 > 0) ? (tIn2 - tIn1) : NaN;
      var trackPerSide = et1 - etE;                       // + = centreline moves outboard
      var trackTotal = 2 * trackPerSide;

      var flags = [];
      if (Math.abs(poke) < 3) flags.push(["ok", L("Outer lip stays within 3 mm of stock", "外沿位置与原厂相差在 3 mm 以内")]);
      else if (poke > 0) flags.push(["warn", L("Outer lip sits " + num(poke, 1) + " mm further out — check fender and liner clearance", "外沿向外多出 " + num(poke, 1) + " mm —— 请检查翼子板与内衬间隙")]);
      else flags.push(["warn", L("Outer lip tucks " + num(-poke, 1) + " mm inward", "外沿向内收进 " + num(-poke, 1) + " mm")]);
      if (innerLoss > 0) flags.push(["bad", L("Inner edge moves " + num(innerLoss, 1) + " mm toward the strut and control arm", "内沿向减震器／摆臂方向靠近 " + num(innerLoss, 1) + " mm")]);
      else if (innerLoss < -0.5) flags.push(["ok", L("Gains " + num(-innerLoss, 1) + " mm of inner clearance", "内侧间隙增加 " + num(-innerLoss, 1) + " mm")]);
      if (sp > 0) flags.push(["warn", L("Spacer fitted — confirm stud engagement and hub centring", "使用了垫片 —— 请确认螺栓咬合长度与轮毂定位")]);

      return {
        res: [
          { l: ["Backspacing — current", "内背距 · 原车"], v: num(bs1, 2) + " in", s: num(bs1 * MM_IN, 1) + " mm" },
          { l: ["Backspacing — new", "内背距 · 新"], v: num(bs2, 2) + " in", s: num(bs2 * MM_IN, 1) + " mm" },
          { l: ["Rim outer lip moves", "轮辋外沿移动"], v: sgn(poke, 1) + " mm", s: sgn(poke / MM_IN, 3) + " in · " + L("+ = further out", "正值 = 更外抛"), accent: true },
          { l: ["Tire outer edge moves", "轮胎外侧移动"], v: sgn(tirePoke, 1) + " mm", s: L("what the fender actually sees", "翼子板真正感受到的量") },
          { l: ["Inner clearance change", "内侧间隙变化"], v: sgn(-innerLoss, 1) + " mm", s: L("negative = closer to suspension", "负值 = 更靠近悬挂"), accent: true },
          { l: ["Tire inner edge moves", "轮胎内侧移动"], v: sgn(tireInner, 1) + " mm", s: L("+ = deeper inboard", "正值 = 更深入内侧") },
          { l: ["Track width change", "轮距变化"], v: sgn(trackTotal, 1) + " mm", s: sgn(trackPerSide, 1) + " mm " + L("per side", "（单侧）") },
          { l: ["Effective offset (new)", "有效偏距（新）"], v: (etE >= 0 ? "ET+" : "ET") + num(etE, 1), s: sp > 0 ? "ET" + num(et2, 1) + " − " + num(sp, 1) + " mm " + L("spacer", "垫片") : L("no spacer", "无垫片") }
        ],
        flags: flags,
        svg: offsetSvg({ W: W1, et: et1, t: t1 }, { W: W2, et: etE, t: t2 }),
        legend: [["a", L("current setup", "原车配置")], ["b", L("new setup", "新配置")]],
        formula: [
          "Backspacing (in) = (rim width + 1 in) ÷ 2 + ET ÷ 25.4. Outer lip from hub face = overall width ÷ 2 − ET. A spacer of <em>s</em> mm simply makes ET → ET − s.",
          "内背距（英寸）=（轮辋宽度 + 1 英寸）÷ 2 + ET ÷ 25.4。外沿到法兰面距离 = 全宽 ÷ 2 − ET。厚度 s 的垫片相当于把 ET 变成 ET − s。"
        ],
        note: [
          "The +1 inch is the industry convention for the two rim flanges, so an 8-inch wheel is about 9 inches wide overall. This is the step most offset calculators skip: comparing offsets alone is only valid when both wheels are the same width. Clearance still depends on suspension travel, brake hardware and tire shape — measure before you commit.",
          "这里的 +1 英寸是行业惯例，代表两侧轮辋翻边，所以 8 英寸轮毂的实际全宽约 9 英寸。这恰恰是多数偏距计算器省略的一步：只比偏距，仅在两个轮毂等宽时才成立。最终间隙还取决于悬挂行程、制动系统和胎型，动手前请实测。"
        ]
      };
    }
  });

  /* ---------- Tool 3: Speedometer & odometer error ---------- */
  TOOLS.push({
    id: "speedo",
    slug: "speedometer-error-calculator",
    name: ["Speedometer & Odometer Error", "码表与里程表误差"],
    tab: ["Speedometer", "码表误差"],
    desc: [
      "Two ways in: from a tire size change, or from a GPS reading. Get true speed, odometer drift and the correction factor for your logged mileage.",
      "两种输入方式：按轮胎尺寸变化推算，或用 GPS 实测值校准。得到真实车速、里程表偏差和里程修正系数。"
    ],
    fields: [
      F("mode", "Method", "计算方式", "tire", {
        type: "sel", opts: [["tire", "From a tire size change", "按轮胎尺寸变化"], ["gps", "From a GPS speed check", "按 GPS 实测车速"]]
      }),
      F("a", "Original tire size", "原车轮胎尺寸", "225/45R17", { type: "text", showIf: { mode: "tire" } }),
      F("b", "Fitted tire size", "已装轮胎尺寸", "235/45R17", { type: "text", showIf: { mode: "tire" } }),
      F("ind", "Speedometer reading", "码表读数", 60, { u: "speed" }),
      F("gps", "GPS / true speed", "GPS 实测车速", 58, { u: "speed", showIf: { mode: "gps" } }),
      F("odo", "Distance shown on the odometer", "里程表显示的里程", 100, { u: "dist" })
    ],
    calc: function (v, s) {
      var mode = s("mode"), ratio, aLbl, bLbl;
      if (mode === "tire") {
        var A = parseTire(s("a")), B = parseTire(s("b"));
        if (!A) return { err: ["The original tire size is not recognised.", "无法识别原车轮胎尺寸。"] };
        if (!B) return { err: ["The fitted tire size is not recognised.", "无法识别已装轮胎尺寸。"] };
        ratio = B.odIn / A.odIn;
        aLbl = fInMm(A.odIn); bLbl = fInMm(B.odIn);
      } else {
        var ind0 = v("ind"), g = v("gps");
        if (!(ind0 > 0)) return { err: ["Enter the speed shown on the speedometer.", "请输入码表显示的车速。"] };
        ratio = g / ind0;
      }
      var ind = v("ind");
      var trueSpeed = ind * ratio;
      var errPct = (ratio - 1) * 100;
      var odo = v("odo");
      var trueDist = odo * ratio;

      var flags = [];
      if (errPct > 0.5) flags.push(["bad", L("You are driving faster than the speedometer shows", "你的实际车速高于码表显示")]);
      else if (errPct < -0.5) flags.push(["ok", L("You are driving slower than the speedometer shows", "你的实际车速低于码表显示")]);
      else flags.push(["ok", L("Effectively calibrated", "基本一致，可视为已校准")]);
      if (Math.abs(errPct) > 3) flags.push(["warn", L("More than 3% off — worth correcting the calibration", "误差超过 3% —— 建议做码表校准")]);

      var pts = isUS() ? [25, 40, 55, 65, 75] : [40 / KM_MI, 60 / KM_MI, 80 / KM_MI, 100 / KM_MI, 120 / KM_MI];
      var rows = pts.map(function (p) { return [fSpeed(p), fSpeed(p * ratio), sgn((p * ratio - p) * (isUS() ? 1 : KM_MI), 1)]; });

      return {
        res: [
          { l: ["True speed", "真实车速"], v: fSpeed(trueSpeed), s: fSpeedAlt(trueSpeed), accent: true },
          { l: ["Speedometer error", "码表误差"], v: sgn(errPct, 2) + " %", s: L("of the indicated reading", "（相对码表读数）"), accent: true },
          { l: ["Correction factor", "修正系数"], v: "× " + num(ratio, 4), s: L("multiply any reading by this", "任何读数乘以此系数") },
          { l: ["Odometer check", "里程表核对"], v: fDist(odo, 0) + " → " + fDist(trueDist, 1), s: sgn(trueDist - odo, 2) + (isUS() ? " mi" : " km") },
          mode === "tire" ? { l: ["Original diameter", "原车外径"], v: aLbl, s: "" } : { l: ["Reading used", "使用的码表读数"], v: fSpeed(ind), s: "" },
          mode === "tire" ? { l: ["Fitted diameter", "已装外径"], v: bLbl, s: "" } : { l: ["GPS reading used", "使用的 GPS 车速"], v: fSpeed(v("gps")), s: "" }
        ],
        flags: flags,
        table: { head: [L("Speedometer says", "码表显示"), L("Actual speed", "实际车速"), L("Difference", "差值")], rows: rows },
        svg: speedoSvg(ind, trueSpeed),
        formula: [
          "True speed = indicated × (D<sub>fitted</sub> ÷ D<sub>original</sub>). The same ratio applies to the odometer, because both are driven by the same wheel-speed signal.",
          "真实车速 = 码表读数 ×（已装外径 ÷ 原车外径）。里程表用的是同一路轮速信号，因此适用同一系数。"
        ],
        note: [
          "Most factory speedometers are deliberately optimistic: UNECE Regulation 39 and EU Directive 2000/7/EC allow a reading up to 10% + 4 km/h above true speed but never below it. A GPS check therefore usually shows the car travelling slightly slower than the dial — before any tire change is even considered.",
          "多数原厂码表本身就偏乐观：联合国 UNECE R39 与欧盟 2000/7/EC 规定，码表读数最多可比真实车速高 10% + 4 km/h，但绝不能低于真实车速。所以即使没换胎，GPS 实测通常也会比码表略低。"
        ]
      };
    }
  });

  /* ---------- Tool 4: Gear ratio & cruising RPM ---------- */
  TOOLS.push({
    id: "gearing",
    slug: "gear-ratio-rpm-calculator",
    name: ["Gear Ratio & Cruising RPM", "齿比与巡航转速"],
    tab: ["Gearing", "齿比转速"],
    desc: [
      "Engine RPM at any speed from tire diameter, axle ratio and gear — plus the axle ratio that restores stock RPM after a tire upsize.",
      "由轮胎外径、主减速比和挡位齿比算出任意车速下的发动机转速，并给出换大胎后恢复原厂转速所需的主减速比。"
    ],
    fields: [
      F("tire", "Tire size or diameter (in)", "轮胎尺寸或外径（英寸）", "265/70R17", { type: "text", hint: ["Type a size code or just the diameter in inches", "可填尺寸代码，也可直接填英寸外径"] }),
      F("axle", "Final drive / axle ratio", "主减速比", 3.73, { step: 0.01 }),
      F("gear", "Transmission gear ratio", "变速箱挡位齿比", 1.0, { step: 0.01, hint: ["1.00 for a direct top gear, 0.70 for a typical overdrive", "直接挡通常为 1.00，超速挡约 0.70"] }),
      F("spd", "Road speed", "车速", 70, { u: "speed" }),
      H("Re-gear after a tire change", "换胎后的齿比补偿"),
      F("old", "Tire size before the change", "换胎前的轮胎尺寸", "245/75R17", { type: "text" })
    ],
    calc: function (v, s) {
      function diaOf(raw) {
        var t = parseTire(raw);
        if (t) return t.odIn;
        var n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ""));
        return isFinite(n) && n > 0 ? n : NaN;
      }
      var d = diaOf(s("tire"));
      if (!isFinite(d)) return { err: ["Enter a tire size such as 265/70R17, or a diameter in inches.", "请输入 265/70R17 之类的尺寸代码，或直接填英寸外径。"] };
      var axle = v("axle"), gear = v("gear"), mph = v("spd");
      if (!(axle > 0 && gear > 0)) return { err: ["Axle ratio and gear ratio must both be greater than zero.", "主减速比和挡位齿比都必须大于 0。"] };

      var tireRpm = mph * revsPerMile(d) / 60;
      var rpm = tireRpm * axle * gear;
      var mphPer1000 = 1000 / (revsPerMile(d) / 60 * axle * gear);

      var dOld = diaOf(s("old"));
      var needed = isFinite(dOld) ? axle * (d / dOld) : NaN;
      var COMMON = [2.73, 3.08, 3.23, 3.42, 3.55, 3.73, 3.90, 4.10, 4.30, 4.56, 4.88, 5.13, 5.38];
      var closest = NaN;
      if (isFinite(needed)) {
        closest = COMMON.reduce(function (best, r) { return Math.abs(r - needed) < Math.abs(best - needed) ? r : best; }, COMMON[0]);
      }
      var rpmOld = isFinite(dOld) ? (mph * revsPerMile(dOld) / 60) * axle * gear : NaN;

      var flags = [];
      if (isFinite(dOld)) {
        var lostPct = (dOld / d - 1) * 100;
        if (Math.abs(lostPct) < 1) flags.push(["ok", L("Effective gearing barely changes", "有效传动比几乎不变")]);
        else if (d > dOld) flags.push(["warn", L("Taller tire: effective gearing is " + num(-lostPct, 1) + "% longer, so acceleration softens", "轮胎变大：有效传动比拉长 " + num(-lostPct, 1) + "%，加速会变肉")]);
        else flags.push(["warn", L("Shorter tire: effective gearing is " + num(lostPct, 1) + "% shorter, so RPM rises", "轮胎变小：有效传动比变短 " + num(lostPct, 1) + "%，转速会升高")]);
      }

      return {
        res: [
          { l: ["Engine RPM at " + fSpeed(mph), fSpeed(mph) + " 时的发动机转速"], v: num(rpm, 0) + " rpm", s: L("in this gear", "（当前挡位）"), accent: true },
          { l: ["Speed per 1000 rpm", "每 1000 转对应车速"], v: isUS() ? num(mphPer1000, 1) + " mph" : num(mphPer1000 * KM_MI, 1) + " km/h", s: isUS() ? num(mphPer1000 * KM_MI, 1) + " km/h" : num(mphPer1000, 1) + " mph" },
          { l: ["Tire speed", "车轮转速"], v: num(tireRpm, 0) + " rpm", s: num(revsPerMile(d), 0) + " " + L("revs / mile", "转/英里") },
          { l: ["Tire diameter used", "使用的轮胎外径"], v: fInMm(d), s: fMmIn(d * MM_IN) },
          { l: ["RPM with the old tire", "换胎前的转速"], v: isFinite(rpmOld) ? num(rpmOld, 0) + " rpm" : "—", s: isFinite(rpmOld) ? sgn(rpm - rpmOld, 0) + " rpm " + L("after the change", "（换胎后变化）") : "" },
          { l: ["Axle ratio to restore it", "恢复原转速所需主减速比"], v: isFinite(needed) ? num(needed, 2) + " : 1" : "—", s: isFinite(closest) ? L("nearest common ratio ", "最接近的常见比 ") + num(closest, 2) : "", accent: true }
        ],
        flags: flags,
        svg: gearSvg(axle * gear, d),
        formula: [
          "RPM = speed(mph) × 336 × axle × gear ÷ tire diameter(in), where 336 = 63360 ÷ (π × 60). To keep RPM after fitting taller tires: new axle = old axle × D<sub>new</sub> ÷ D<sub>old</sub>.",
          "转速 = 车速(mph) × 336 × 主减速比 × 挡位齿比 ÷ 轮胎外径(in)，其中 336 = 63360 ÷ (π × 60)。换大胎后要维持原转速：新主减速比 = 原主减速比 × 新外径 ÷ 原外径。"
        ],
        note: [
          "This is the mechanical relationship only. It ignores torque-converter slip in an automatic, which typically adds a little RPM below lock-up, and it assumes no tire slip. Ratios listed as 'common' are standard ring-and-pinion sizes; availability depends on your axle.",
          "这里只算机械关系。自动变速箱在锁止之前存在液力变矩器滑差，实际转速会略高；同时假设轮胎无滑转。列出的「常见比」是标准主减速齿轮规格，实际能否装取决于你的桥型。"
        ]
      };
    }
  });

  /* ---------- Tool 5: Fuel economy converter ---------- */
  TOOLS.push({
    id: "fuel-econ",
    slug: "fuel-economy-converter",
    name: ["Fuel Economy Converter", "油耗单位换算"],
    tab: ["Fuel economy", "油耗换算"],
    desc: [
      "MPG (US), MPG (Imperial), L/100 km and km/L in one pass — plus what that economy actually costs you per mile, per kilometre and per year.",
      "美制 MPG、英制 MPG、L/100 km、km/L 一次全部换算，并算出这个油耗每英里、每公里和每年到底花多少钱。"
    ],
    fields: [
      F("val", "Fuel economy figure", "油耗数值", 30, { step: 0.1 }),
      F("unit", "Unit of that figure", "该数值的单位", "mpgus", {
        type: "sel", opts: [
          ["mpgus", "MPG (US gallon)", "MPG（美制加仑）"],
          ["mpguk", "MPG (Imperial gallon)", "MPG（英制加仑）"],
          ["l100", "L / 100 km", "L / 100 km"],
          ["kml", "km / L", "km / L"],
          ["mil", "miles / L", "英里 / 升"]
        ]
      }),
      F("price", "Fuel price", "燃油单价", 3.50, { u: "ppv", step: 0.01 }),
      F("annual", "Distance driven per year", "年行驶里程", 12000, { u: "dist" })
    ],
    calc: function (v, s) {
      var x = v("val"), u = s("unit");
      if (!(x > 0)) return { err: ["Enter a fuel economy figure greater than zero.", "请输入大于 0 的油耗数值。"] };
      var mpgUS;
      if (u === "mpgus") mpgUS = x;
      else if (u === "mpguk") mpgUS = x * (L_GAL / 4.54609);
      else if (u === "l100") mpgUS = 235.214583 / x;
      else if (u === "kml") mpgUS = x * L_GAL / KM_MI;
      else mpgUS = x * L_GAL;

      var mpgUK = mpgUS * (4.54609 / L_GAL);
      var l100 = 235.214583 / mpgUS;
      var kml = mpgUS * KM_MI / L_GAL;
      var mil = mpgUS / L_GAL;

      var price = v("price");                       // canonical: currency per US gallon
      var costPerMile = price / mpgUS;
      var costPerKm = costPerMile / KM_MI;
      var annualMi = v("annual");
      var annualCost = costPerMile * annualMi;
      var annualFuel = annualMi / mpgUS;

      return {
        res: [
          { l: ["MPG (US)", "MPG（美制）"], v: num(mpgUS, 2), s: "US gal", accent: u !== "mpgus" },
          { l: ["MPG (Imperial)", "MPG（英制）"], v: num(mpgUK, 2), s: "Imp gal" },
          { l: ["L / 100 km", "L / 100 km"], v: num(l100, 2), s: L("lower is better", "数值越低越省"), accent: u !== "l100" },
          { l: ["km / L", "km / L"], v: num(kml, 2), s: L("higher is better", "数值越高越省") },
          { l: ["miles / L", "英里 / 升"], v: num(mil, 2), s: "" },
          { l: ["Cost per distance", "单位里程成本"], v: isUS() ? num(costPerMile, 3) + " / mi" : num(costPerKm, 3) + " / km", s: isUS() ? num(costPerKm, 3) + " / km" : num(costPerMile, 3) + " / mi" },
          { l: ["Fuel used per year", "年耗油量"], v: fVol(annualFuel), s: fVolAlt(annualFuel) },
          { l: ["Fuel cost per year", "年油费"], v: num(annualCost, 0), s: L("at the price entered", "按输入的油价计算"), accent: true }
        ],
        table: {
          head: [L("Economy", "油耗"), "MPG (US)", "L/100 km", L("Cost per " + (isUS() ? "100 mi" : "100 km"), "每 " + (isUS() ? "100 英里" : "100 公里") + " 成本")],
          rows: [-20, -10, 0, 10, 20].map(function (dp) {
            var m = mpgUS * (1 + dp / 100);
            var cost = (isUS() ? 100 : 100 / KM_MI) * price / m;
            return [(dp === 0 ? L("your figure", "当前值") : sgn(dp, 0) + "%"), num(m, 1), num(235.214583 / m, 2), num(cost, 2)];
          })
        },
        formula: [
          "L/100 km = 235.215 ÷ MPG(US). One US gallon is 3.785411784 L, one Imperial gallon is 4.54609 L, one mile is 1.609344 km. Cost per mile = fuel price ÷ MPG.",
          "L/100 km = 235.215 ÷ MPG（美制）。1 美制加仑 = 3.785411784 L，1 英制加仑 = 4.54609 L，1 英里 = 1.609344 km。每英里成本 = 油价 ÷ MPG。"
        ],
        note: [
          "MPG and L/100 km are reciprocals, which is why they mislead in opposite directions: going from 15 to 20 MPG saves far more fuel than going from 40 to 45 MPG, even though both are +5 MPG. If you are comparing two cars, compare litres per 100 km or cost per mile, not MPG.",
          "MPG 与 L/100 km 互为倒数，所以两者的直觉误导方向相反：从 15 提到 20 MPG 省下的油，远多于从 40 提到 45 MPG，尽管都是 +5 MPG。比较两台车时，请看 L/100 km 或每英里成本，而不是 MPG。"
        ]
      };
    }
  });

  /* ---------- Tool 6: Trip fuel cost ---------- */
  TOOLS.push({
    id: "trip-cost",
    slug: "trip-fuel-cost-calculator",
    name: ["Trip Fuel Cost", "行程油费"],
    tab: ["Trip cost", "行程油费"],
    desc: [
      "What the drive really costs: fuel, cost per head, cost per mile and CO₂ — with a second vehicle alongside so you can decide which car to take.",
      "这趟路到底花多少：油费、人均分摊、每英里成本和碳排放，并可同时对比第二台车，决定开哪一辆。"
    ],
    fields: [
      F("dist", "One-way distance", "单程距离", 250, { u: "dist" }),
      F("rt", "Trip type", "行程类型", "rt", { type: "sel", opts: [["rt", "Round trip", "往返"], ["ow", "One way", "单程"]] }),
      F("eff", "Vehicle 1 fuel economy", "车辆 1 油耗", 28, { u: "econ", step: 0.1 }),
      F("price", "Fuel price", "燃油单价", 3.50, { u: "ppv", step: 0.01 }),
      F("pax", "People sharing the cost", "分摊人数", 2, { step: 1 }),
      F("extra", "Tolls, parking and ferries", "过路费 / 停车 / 轮渡", 0, { step: 1 }),
      H("Compare a second vehicle", "对比第二台车"),
      F("eff2", "Vehicle 2 fuel economy", "车辆 2 油耗", 42, { u: "econ", step: 0.1 }),
      F("fuel", "Fuel type (for CO₂)", "燃料类型（用于碳排放）", "gas", { type: "sel", opts: [["gas", "Gasoline / petrol", "汽油"], ["diesel", "Diesel", "柴油"]] })
    ],
    calc: function (v, s) {
      var one = v("dist");
      var total = s("rt") === "rt" ? one * 2 : one;
      var mpg = v("eff"), mpg2 = v("eff2"), price = v("price");
      if (!(mpg > 0)) return { err: ["Fuel economy must be greater than zero.", "油耗必须大于 0。"] };
      var pax = Math.max(1, Math.round(v("pax")));
      var extra = v("extra") || 0;

      var gal = total / mpg;
      var fuelCost = gal * price;
      var tripCost = fuelCost + extra;
      var perPerson = tripCost / pax;
      var perMile = tripCost / total;

      var co2Factor = s("fuel") === "diesel" ? CO2_KG_PER_GAL_DIESEL : CO2_KG_PER_GAL_GASOLINE;
      var co2 = gal * co2Factor;

      var has2 = mpg2 > 0;
      var gal2 = has2 ? total / mpg2 : NaN;
      var cost2 = has2 ? gal2 * price + extra : NaN;
      var save = has2 ? tripCost - cost2 : NaN;

      var maxC = Math.max(tripCost, has2 ? cost2 : 0) || 1;
      var meters = [
        { lab: L("Vehicle 1", "车辆 1") + " · " + num(tripCost, 2), pct: tripCost / maxC * 100, cls: "warn" }
      ];
      if (has2) meters.push({ lab: L("Vehicle 2", "车辆 2") + " · " + num(cost2, 2), pct: cost2 / maxC * 100, cls: cost2 <= tripCost ? "ok" : "over" });

      var flags = [];
      if (has2) {
        if (save > 0) flags.push(["ok", L("Taking vehicle 2 saves " + num(save, 2) + " on this trip", "开车辆 2 这趟省下 " + num(save, 2))]);
        else if (save < 0) flags.push(["warn", L("Vehicle 2 costs " + num(-save, 2) + " more on this trip", "开车辆 2 这趟要多花 " + num(-save, 2))]);
        else flags.push(["ok", L("Both vehicles cost the same here", "两台车这趟成本相同")]);
      }

      return {
        res: [
          { l: ["Total distance", "总里程"], v: fDist(total, 0), s: fDistAlt(total, 0) },
          { l: ["Fuel needed", "需要加油"], v: fVol(gal), s: fVolAlt(gal) },
          { l: ["Fuel cost", "油费"], v: num(fuelCost, 2), s: extra > 0 ? "+ " + num(extra, 2) + " " + L("extras", "其他费用") : "" },
          { l: ["Total trip cost", "行程总成本"], v: num(tripCost, 2), s: L("fuel plus extras", "油费 + 其他费用"), accent: true },
          { l: ["Per person", "人均"], v: num(perPerson, 2), s: pax + " " + L("sharing", "人分摊"), accent: true },
          { l: ["Cost per distance", "单位里程成本"], v: isUS() ? num(perMile, 3) + " / mi" : num(perMile / KM_MI, 3) + " / km", s: isUS() ? num(perMile / KM_MI, 3) + " / km" : num(perMile, 3) + " / mi" },
          { l: ["CO₂ from the fuel burned", "燃油产生的 CO₂"], v: num(co2, 1) + " kg", s: num(co2 * 2.20462, 0) + " lb · " + L("EPA tailpipe factor", "EPA 尾气排放因子") },
          { l: ["Vehicle 2 total", "车辆 2 总成本"], v: has2 ? num(cost2, 2) : "—", s: has2 ? sgn(-save, 2) + " " + L("vs vehicle 1", "相对车辆 1") : "" }
        ],
        flags: flags,
        meters: meters,
        formula: [
          "Fuel = distance ÷ economy. Cost = fuel × price + extras. CO₂ uses the US EPA tailpipe factors of 8.887 kg per gallon of gasoline and 10.180 kg per gallon of diesel.",
          "耗油量 = 里程 ÷ 油耗。成本 = 耗油量 × 单价 + 其他费用。CO₂ 采用美国 EPA 的尾气排放因子：汽油 8.887 kg/加仑，柴油 10.180 kg/加仑。"
        ],
        note: [
          "This is fuel and out-of-pocket cost only. It deliberately excludes depreciation, tires, insurance and maintenance, which for most cars add substantially more per mile than fuel does. Real economy on a long highway run is usually better than the mixed-cycle figure on the window sticker, and worse in winter or with a roof box fitted.",
          "这里只计算油费和现金支出，刻意不含折旧、轮胎、保险和保养——对多数车而言，这些项目摊到每公里往往比油费还高。长途高速的实际油耗通常好于综合工况标称值，而冬季或装了车顶行李箱时则会变差。"
        ]
      };
    }
  });

  /* ---------- Tool 7: EV charging cost & time ---------- */
  TOOLS.push({
    id: "ev-charge",
    slug: "ev-charging-cost-calculator",
    name: ["EV Charging Cost & Time", "电动车充电成本与时间"],
    tab: ["EV charging", "充电成本"],
    desc: [
      "How long the charge takes, what it costs at the wall, and how that compares per 100 miles against filling a petrol car.",
      "这次充电要多久、按电表实际花多少钱，以及每 100 英里的成本与加油车相比如何。"
    ],
    fields: [
      F("cap", "Usable battery capacity (kWh)", "可用电池容量（kWh）", 75, { step: 0.5 }),
      F("soc1", "Charge now (%)", "当前电量（%）", 20, { step: 1 }),
      F("soc2", "Charge target (%)", "目标电量（%）", 80, { step: 1 }),
      F("kw", "Charger power (kW)", "充电功率（kW）", 11, { step: 0.1, hint: ["7.4 kW home AC, 11–22 kW three-phase, 50–350 kW DC rapid", "家用交流 7.4 kW，三相 11–22 kW，直流快充 50–350 kW"] }),
      F("effc", "Charging efficiency (%)", "充电效率（%）", 88, { step: 1, hint: ["AC charging typically 85–90%, DC rapid 92–95%", "交流充电通常 85–90%，直流快充 92–95%"] }),
      F("rate", "Electricity price per kWh", "电价（每 kWh）", 0.17, { step: 0.01 }),
      F("mikwh", "Vehicle efficiency", "车辆能耗", 3.5, { u: "evEff", step: 0.1 }),
      H("Compare with a petrol car", "与燃油车对比"),
      F("mpg", "Petrol car economy", "燃油车油耗", 30, { u: "econ", step: 0.1 }),
      F("gasp", "Fuel price", "燃油单价", 3.50, { u: "ppv", step: 0.01 })
    ],
    calc: function (v) {
      var cap = v("cap"), s1 = clamp(v("soc1"), 0, 100), s2 = clamp(v("soc2"), 0, 100);
      var kw = v("kw"), eff = clamp(v("effc"), 1, 100) / 100, rate = v("rate");
      var miKwh = v("mikwh"), mpg = v("mpg"), gasp = v("gasp");
      if (!(cap > 0)) return { err: ["Battery capacity must be greater than zero.", "电池容量必须大于 0。"] };
      if (!(s2 > s1)) return { err: ["The target charge must be higher than the current charge.", "目标电量必须高于当前电量。"] };
      if (!(kw > 0)) return { err: ["Charger power must be greater than zero.", "充电功率必须大于 0。"] };

      var added = cap * (s2 - s1) / 100;      // kWh into the battery
      var drawn = added / eff;                // kWh off the meter
      var hours = added / (kw * eff);         // wall power kw, delivered kw*eff
      var cost = drawn * rate;
      var rangeAdded = added * miKwh;
      var costPer100 = miKwh > 0 ? (100 / miKwh) / eff * rate : NaN;
      var gasPer100 = mpg > 0 ? (100 / mpg) * gasp : NaN;
      var savePer100 = gasPer100 - costPer100;

      var flags = [];
      if (s2 > 80 && kw >= 50) flags.push(["warn", L("DC rapid charging tapers hard above 80% — the last 20% can take as long as the first 60%", "直流快充在 80% 以上会大幅降功率 —— 最后 20% 可能和前 60% 一样久")]);
      if (kw <= 2.5) flags.push(["warn", L("This is trickle-charge power from a household socket", "这是普通家用插座的涓流充电功率")]);
      if (isFinite(savePer100)) {
        if (savePer100 > 0) flags.push(["ok", L("Cheaper than the petrol car by " + num(savePer100, 2) + " per 100 " + (isUS() ? "miles" : "miles"), "每 100 英里比燃油车省 " + num(savePer100, 2))]);
        else flags.push(["bad", L("At these prices the petrol car is cheaper per 100 miles", "按当前价格，燃油车每 100 英里更便宜")]);
      }

      return {
        res: [
          { l: ["Energy into the battery", "充入电池的电量"], v: num(added, 2) + " kWh", s: num(s2 - s1, 0) + "% " + L("of " + num(cap, 1) + " kWh", "× " + num(cap, 1) + " kWh") },
          { l: ["Energy off the meter", "电表计量电量"], v: num(drawn, 2) + " kWh", s: num(drawn - added, 2) + " kWh " + L("lost as heat", "以热量损失") },
          { l: ["Charging time", "充电时间"], v: hhmm(hours), s: num(hours, 2) + " " + L("hours", "小时"), accent: true },
          { l: ["Cost of this charge", "本次充电费用"], v: num(cost, 2), s: L("at ", "电价 ") + num(v("rate"), 3) + " /kWh", accent: true },
          { l: ["Range added", "增加续航"], v: fDist(rangeAdded, 0), s: fDistAlt(rangeAdded, 0) },
          { l: ["Electricity per 100 mi", "每 100 英里电费"], v: num(costPer100, 2), s: num(costPer100 / KM_MI * 1, 2) + " " + L("per 100 km", "/ 100 km") },
          { l: ["Petrol per 100 mi", "每 100 英里油费"], v: num(gasPer100, 2), s: L("at ", "油耗 ") + num(mpg, 1) + " MPG" },
          { l: ["Difference per 100 mi", "每 100 英里差额"], v: sgn(savePer100, 2), s: L("positive = EV is cheaper", "正值 = 电车更省"), accent: true }
        ],
        flags: flags,
        meters: [
          { lab: L("State of charge", "电量状态") + " " + num(s1, 0) + "% → " + num(s2, 0) + "%", pct: s2, cls: s2 > 90 ? "warn" : "ok" }
        ],
        svg: batterySvg(s1, s2),
        formula: [
          "Energy added = capacity × (target − current) ÷ 100. Metered energy = added ÷ efficiency. Time = added ÷ (charger kW × efficiency). Cost = metered energy × price per kWh.",
          "充入电量 = 容量 ×（目标 − 当前）÷ 100。电表电量 = 充入电量 ÷ 效率。时间 = 充入电量 ÷（充电功率 × 效率）。费用 = 电表电量 × 电价。"
        ],
        note: [
          "This assumes a flat charging curve, which is realistic for AC charging but not for DC rapid charging — real DC sessions ramp down as the battery fills and as it warms. Cold weather adds preconditioning energy on top. Efficiency losses happen in the charger, cables and battery, and you pay for all of them.",
          "这里假设充电功率恒定：交流充电基本符合，直流快充则不然——实际直流充电会随电量升高和电池发热而降功率。低温下还要额外消耗电池预热的电量。损耗发生在充电机、线缆和电池内部，而这些电你都要付钱。"
        ]
      };
    }
  });

  /* ---------- Tool 8: Towing & payload ---------- */
  TOOLS.push({
    id: "towing",
    slug: "towing-payload-calculator",
    name: ["Towing & Payload Check", "拖挂与载重核算"],
    tab: ["Towing", "拖挂载重"],
    desc: [
      "Payload, tongue weight and combined weight checked against GVWR and GCWR — the two limits people blow past without noticing.",
      "把载重、舌重和总组合重量分别对照 GVWR 与 GCWR 核查——这正是最容易在不知不觉中超标的两条限值。"
    ],
    fields: [
      H("Vehicle", "牵引车"),
      F("gvwr", "GVWR (vehicle rating)", "GVWR（整备总质量限值）", 7000, { u: "mass" }),
      F("gcwr", "GCWR (combined rating)", "GCWR（组合总质量限值）", 15000, { u: "mass" }),
      F("curb", "Curb weight", "整备质量", 5400, { u: "mass" }),
      F("pax", "Passengers", "乘员重量", 400, { u: "mass" }),
      F("cargo", "Cargo in the vehicle", "车内载货", 250, { u: "mass" }),
      H("Trailer", "挂车"),
      F("trailer", "Loaded trailer weight", "满载挂车重量", 6500, { u: "mass" }),
      F("hitch", "Hitch type", "挂接方式", "conv", {
        type: "sel", opts: [
          ["conv", "Conventional / weight-distributing", "常规／均衡式牵引架"],
          ["goose", "Gooseneck / fifth wheel", "鹅颈／五轮式"]
        ]
      }),
      F("tw", "Tongue / pin weight (% of trailer)", "舌重／销重（占挂车比例 %）", 12, { step: 0.5 })
    ],
    calc: function (v, s) {
      var gvwr = v("gvwr"), gcwr = v("gcwr"), curb = v("curb");
      var pax = v("pax"), cargo = v("cargo"), trailer = v("trailer");
      var twPct = v("tw"), goose = s("hitch") === "goose";
      if (!(gvwr > 0 && curb > 0)) return { err: ["GVWR and curb weight are both required.", "必须填写 GVWR 和整备质量。"] };

      var payloadCap = gvwr - curb;
      var tongue = trailer * twPct / 100;
      var payloadUsed = pax + cargo + tongue;
      var payloadLeft = payloadCap - payloadUsed;
      var combined = curb + pax + cargo + trailer;
      var gcwrLeft = gcwr - combined;
      var maxTrailerGcwr = gcwr - (curb + pax + cargo);
      var maxTrailerPayload = twPct > 0 ? (payloadCap - pax - cargo) / (twPct / 100) : Infinity;
      var maxTrailer = Math.min(maxTrailerGcwr, maxTrailerPayload);

      var lo = goose ? 15 : 10, hi = goose ? 25 : 15;
      var flags = [];
      if (payloadLeft < 0) flags.push(["bad", L("Over the payload limit by " + fMass(-payloadLeft) + " — the GVWR is exceeded", "超出载重限值 " + fMass(-payloadLeft) + " —— 已超过 GVWR")]);
      else if (payloadUsed / payloadCap > 0.9) flags.push(["warn", L("Using over 90% of available payload", "已用掉超过 90% 的可用载重")]);
      else flags.push(["ok", L("Within payload", "载重在限值以内")]);
      if (gcwrLeft < 0) flags.push(["bad", L("Over GCWR by " + fMass(-gcwrLeft), "超出 GCWR " + fMass(-gcwrLeft))]);
      else flags.push(["ok", L("Within GCWR", "组合重量在限值以内")]);
      if (twPct < lo) flags.push(["bad", L("Tongue weight below " + lo + "% invites trailer sway", "舌重低于 " + lo + "% 容易引发挂车摆尾")]);
      else if (twPct > hi) flags.push(["warn", L("Tongue weight above " + hi + "% overloads the rear axle", "舌重高于 " + hi + "% 会让后桥过载")]);
      else flags.push(["ok", L("Tongue weight in the " + lo + "–" + hi + "% range", "舌重处于 " + lo + "–" + hi + "% 的合理区间")]);

      return {
        res: [
          { l: ["Payload capacity", "可用载重"], v: fMass(payloadCap), s: "GVWR − " + L("curb weight", "整备质量") },
          { l: ["Tongue / pin weight", "舌重／销重"], v: fMass(tongue), s: num(twPct, 1) + "% " + L("of the trailer", "× 挂车重量"), accent: true },
          { l: ["Payload used", "已用载重"], v: fMass(payloadUsed), s: L("people + cargo + tongue", "乘员 + 载货 + 舌重") },
          { l: ["Payload remaining", "剩余载重"], v: fMass(payloadLeft), s: fMassAlt(payloadLeft), accent: true, good: payloadLeft >= 0, bad: payloadLeft < 0 },
          { l: ["Combined weight", "组合总重"], v: fMass(combined), s: L("vehicle + everything + trailer", "整车 + 载荷 + 挂车") },
          { l: ["GCWR remaining", "GCWR 余量"], v: fMass(gcwrLeft), s: fMassAlt(gcwrLeft), good: gcwrLeft >= 0, bad: gcwrLeft < 0 },
          { l: ["Max trailer by GCWR", "GCWR 允许的最大挂车"], v: fMass(maxTrailerGcwr), s: L("with this load aboard", "在当前载荷下") },
          { l: ["Max trailer by payload", "载重允许的最大挂车"], v: isFinite(maxTrailerPayload) ? fMass(maxTrailerPayload) : "—", s: L("the limit that usually bites first: ", "通常先触顶的是它：") + fMass(maxTrailer), accent: true }
        ],
        flags: flags,
        meters: [
          { lab: L("Payload", "载重") + " " + num(payloadCap > 0 ? payloadUsed / payloadCap * 100 : 0, 0) + "%", pct: clamp(payloadCap > 0 ? payloadUsed / payloadCap * 100 : 0, 0, 100), cls: payloadLeft < 0 ? "over" : (payloadUsed / payloadCap > 0.9 ? "warn" : "ok") },
          { lab: "GCWR " + num(gcwr > 0 ? combined / gcwr * 100 : 0, 0) + "%", pct: clamp(gcwr > 0 ? combined / gcwr * 100 : 0, 0, 100), cls: gcwrLeft < 0 ? "over" : (combined / gcwr > 0.9 ? "warn" : "ok") }
        ],
        formula: [
          "Payload capacity = GVWR − curb weight. Tongue weight is part of the payload, not of the trailer's own rating. Combined = curb + people + cargo + full trailer weight, and must stay under GCWR.",
          "可用载重 = GVWR − 整备质量。舌重要算进牵引车的载重，而不是挂车自己的额定值。组合总重 = 整备质量 + 乘员 + 载货 + 挂车满载重量，必须不超过 GCWR。"
        ],
        note: [
          "Use the numbers from your own vehicle's door-jamb placard and owner's manual: the payload figure printed on the yellow sticker already accounts for factory options, and it is often hundreds of pounds below the brochure figure. The tongue-weight ranges shown here — 10–15% conventional, 15–25% gooseneck — are the ranges published by hitch and trailer manufacturers; the only way to know your real tongue weight is a scale.",
          "请以你自己车辆门框铭牌和车主手册上的数据为准：黄色标签上的载重值已经扣除了选装配置，往往比宣传册上的数字低几百磅。这里用的舌重区间（常规 10–15%、鹅颈 15–25%）是牵引架和挂车厂商公布的推荐范围；真实舌重只能靠地磅称出来。"
        ]
      };
    }
  });

  /* ---------- Tool 9: Tire pressure vs temperature ---------- */
  TOOLS.push({
    id: "tire-pressure",
    slug: "tire-pressure-temperature-calculator",
    name: ["Tire Pressure & Temperature", "胎压与温度换算"],
    tab: ["Tire pressure", "胎压温度"],
    desc: [
      "Why the warning light comes on during the first cold snap: gauge pressure tracks absolute temperature. Includes altitude and the TPMS trigger point.",
      "为什么每年第一次降温胎压灯就亮：表压随绝对温度变化。本工具同时考虑海拔，并给出 TPMS 报警阈值。"
    ],
    fields: [
      F("p1", "Cold pressure you set", "设定时的冷态胎压", 35, { u: "press" }),
      F("t1", "Temperature when you set it", "设定时的气温", 70, { u: "temp" }),
      F("t2", "Temperature now", "当前气温", 40, { u: "temp" }),
      F("alt1", "Altitude when set", "设定时的海拔", 0, { u: "alt" }),
      F("alt2", "Altitude now", "当前海拔", 0, { u: "alt" }),
      F("placard", "Placard pressure (door jamb)", "铭牌标准胎压", 35, { u: "press", hint: ["Used for the 25% TPMS warning threshold", "用于计算 TPMS 低于 25% 的报警阈值"] })
    ],
    calc: function (v) {
      var p1 = v("p1"), t1F = v("t1"), t2F = v("t2");
      var a1 = v("alt1"), a2 = v("alt2"), placard = v("placard");
      if (!(p1 > 0)) return { err: ["Enter the pressure you set the tires to.", "请输入设定时的胎压。"] };
      function atmAt(ft) {
        var m = ft * M_FT;
        return ATM_PSI * Math.pow(1 - 2.25577e-5 * m, 5.25588);
      }
      var atm1 = atmAt(a1), atm2 = atmAt(a2);
      var T1 = t1F + 459.67, T2 = t2F + 459.67;   // Rankine
      if (!(T1 > 0)) return { err: ["That temperature is below absolute zero.", "该温度低于绝对零度。"] };
      var pAbs1 = p1 + atm1;
      var pAbs2 = pAbs1 * (T2 / T1);
      var p2 = pAbs2 - atm2;
      var delta = p2 - p1;
      var perTen = isUS() ? (pAbs1 * (10 / T1)) : (pAbs1 * (10 * 9 / 5 / T1));
      var tpms = placard * 0.75;

      var flags = [];
      if (p2 < tpms) flags.push(["bad", L("Below the 25%-under-placard point — the TPMS light should be on", "已低于铭牌值的 75% —— TPMS 报警灯应该会亮")]);
      else if (p2 < placard - 2) flags.push(["warn", L("Under the placard pressure — top up before driving", "低于铭牌标准胎压 —— 行驶前请补气")]);
      else if (p2 > placard + 4) flags.push(["warn", L("Well above placard — check it cold before releasing air", "明显高于铭牌值 —— 放气前请在冷态下复测")]);
      else flags.push(["ok", L("Close enough to the placard pressure", "与铭牌标准胎压足够接近")]);
      if (Math.abs(a2 - a1) > 1000) flags.push(["warn", L("Big altitude change: gauge pressure rises as you climb because the air outside thins", "海拔变化很大：随着高度上升外界空气变稀，表压会读得更高")]);

      var rows = (isUS() ? [10, 32, 50, 70, 90, 110] : [-10, 0, 10, 20, 30, 40].map(function (c) { return c * 9 / 5 + 32; })).map(function (tf) {
        var p = (p1 + atm1) * ((tf + 459.67) / T1) - atm2;
        return [isUS() ? num(tf, 0) + " °F" : num((tf - 32) * 5 / 9, 0) + " °C", fPress(p), sgn(p - p1, 1) + (isUS() ? " psi" : " psi")];
      });

      return {
        res: [
          { l: ["Pressure now", "当前胎压"], v: fPress(p2), s: fPressAlt(p2), accent: true },
          { l: ["Change", "变化量"], v: sgn(delta, 2) + " psi", s: sgn(delta * KPA_PSI, 1) + " kPa", accent: true },
          { l: ["Rule of thumb", "经验法则"], v: num(perTen, 2) + " psi", s: isUS() ? L("per 10 °F change", "每变化 10 °F") : L("per 10 °C change", "每变化 10 °C") },
          { l: ["TPMS warning point", "TPMS 报警阈值"], v: fPress(tpms), s: L("25% below the placard, per FMVSS 138", "低于铭牌值 25%，依 FMVSS 138") },
          { l: ["Absolute pressure then", "设定时的绝对压力"], v: num(pAbs1, 2) + " psia", s: L("gauge + ", "表压 + ") + num(atm1, 2) + " psi " + L("air", "大气压") },
          { l: ["Absolute pressure now", "当前绝对压力"], v: num(pAbs2, 2) + " psia", s: L("air pressure now ", "当前大气压 ") + num(atm2, 2) + " psi" }
        ],
        flags: flags,
        table: { head: [L("Ambient temperature", "环境温度"), L("Gauge pressure", "表压"), L("Change", "变化")], rows: rows },
        svg: gaugeSvg(p2, placard),
        formula: [
          "Gay-Lussac's law on absolute values: (P<sub>gauge</sub> + P<sub>air</sub>) ÷ T is constant, with T in Rankine or Kelvin. Air pressure itself follows the barometric formula, which is why altitude matters too.",
          "查理定律作用于绝对值：（表压 + 大气压）÷ T 为常数，T 用兰氏度或开尔文。大气压本身遵循气压高度公式，所以海拔同样有影响。"
        ],
        note: [
          "Always set pressure cold — before driving, or at least three hours after. A tire that has been running is 4–6 psi higher simply from flexing, and bleeding that off leaves you underinflated once it cools. The placard on the driver's door jamb, not the number moulded into the sidewall, is the pressure your car was engineered around; the sidewall figure is the tire's maximum.",
          "一定要在冷态下调胎压——上路前，或至少停放三小时后。刚跑完的轮胎因胎体揉搓会高出 4–6 psi，此时放气，等凉下来就变成了亏气。应以驾驶席门框铭牌上的数值为准，而不是胎侧模印的数字；胎侧那个是轮胎的最大允许气压。"
        ]
      };
    }
  });

  /* ---------- Tool 10: Engine displacement & compression ratio ---------- */
  TOOLS.push({
    id: "engine",
    slug: "engine-displacement-compression-calculator",
    name: ["Displacement & Compression Ratio", "排量与压缩比"],
    tab: ["Engine", "排量压缩比"],
    desc: [
      "Bore, stroke and cylinder count into displacement; chamber, gasket, deck and piston volumes into a static compression ratio.",
      "由缸径、行程和缸数算排量；由燃烧室、缸垫、余隙高度和活塞顶容积算静态压缩比。"
    ],
    fields: [
      H("Displacement", "排量"),
      F("bore", "Bore", "缸径", 4.0, { u: "len", step: 0.001 }),
      F("stroke", "Stroke", "行程", 3.48, { u: "len", step: 0.001 }),
      F("cyl", "Number of cylinders", "缸数", 8, { step: 1 }),
      H("Compression ratio", "压缩比"),
      F("chamber", "Combustion chamber volume (cc)", "燃烧室容积（cc）", 64, { step: 0.1 }),
      F("gbore", "Head gasket bore", "缸垫开孔直径", 4.1, { u: "len", step: 0.001 }),
      F("gthk", "Head gasket thickness", "缸垫压缩后厚度", 0.04, { u: "len", step: 0.001 }),
      F("deck", "Deck clearance at TDC", "上止点余隙高度", 0.025, { u: "len", step: 0.001, hint: ["Piston crown below the deck surface at top dead centre", "上止点时活塞顶面低于缸体平面的距离"] }),
      F("dish", "Piston dish (+) or dome (−) (cc)", "活塞凹坑（+）／凸顶（−）（cc）", 0, { step: 0.1 })
    ],
    calc: function (v) {
      var bore = v("bore"), stroke = v("stroke"), n = Math.max(1, Math.round(v("cyl")));
      if (!(bore > 0 && stroke > 0)) return { err: ["Bore and stroke must both be greater than zero.", "缸径和行程都必须大于 0。"] };
      var sweptCi = Math.PI / 4 * bore * bore * stroke;      // cubic inches, per cylinder
      var sweptCc = sweptCi * 16.387064;
      var totalCi = sweptCi * n, totalCc = sweptCc * n;

      var chamber = v("chamber");
      var gbore = v("gbore"), gthk = v("gthk"), deck = v("deck"), dish = v("dish");
      var vGasket = Math.PI / 4 * gbore * gbore * gthk * 16.387064;
      var vDeck = Math.PI / 4 * bore * bore * deck * 16.387064;
      var vClear = chamber + vGasket + vDeck + dish;
      var cr = vClear > 0 ? (sweptCc + vClear) / vClear : NaN;
      var bs = stroke > 0 ? bore / stroke : NaN;

      var flags = [];
      if (isFinite(cr)) {
        if (cr < 8.5) flags.push(["warn", L("Low compression — typical of older or boosted engines", "压缩比偏低 —— 常见于老式发动机或增压机型")]);
        else if (cr <= 10.5) flags.push(["ok", L("Pump-fuel territory for a naturally aspirated engine", "自然吸气发动机加民用汽油的常见区间")]);
        else if (cr <= 12) flags.push(["warn", L("High for pump fuel — needs good chamber design and careful tuning", "对民用汽油偏高 —— 需要良好的燃烧室设计和谨慎标定")]);
        else flags.push(["bad", L("Race-fuel territory on a conventional iron/alloy engine", "常规发动机上属于赛用燃油区间")]);
      }
      if (isFinite(bs)) {
        if (bs > 1.05) flags.push(["ok", L("Oversquare (bore > stroke) — favours high-RPM breathing", "短行程（缸径 > 行程）—— 有利于高转呼吸")]);
        else if (bs < 0.95) flags.push(["ok", L("Undersquare (stroke > bore) — favours low-end torque", "长行程（行程 > 缸径）—— 有利于低扭")]);
        else flags.push(["ok", L("Square engine — bore and stroke are nearly equal", "等径程发动机 —— 缸径与行程接近相等")]);
      }

      return {
        res: [
          { l: ["Total displacement", "总排量"], v: num(totalCc, 0) + " cc", s: num(totalCc / 1000, 2) + " L · " + num(totalCi, 1) + " cu in", accent: true },
          { l: ["Swept volume per cylinder", "单缸工作容积"], v: num(sweptCc, 1) + " cc", s: num(sweptCi, 2) + " cu in" },
          { l: ["Static compression ratio", "静态压缩比"], v: isFinite(cr) ? num(cr, 2) + " : 1" : "—", s: L("swept + clearance ÷ clearance", "（工作容积 + 余隙容积）÷ 余隙容积"), accent: true },
          { l: ["Total clearance volume", "余隙总容积"], v: num(vClear, 2) + " cc", s: L("chamber + gasket + deck + dish", "燃烧室 + 缸垫 + 余隙 + 活塞顶") },
          { l: ["Head gasket volume", "缸垫容积"], v: num(vGasket, 2) + " cc", s: num(gbore, 3) + " in × " + num(gthk, 3) + " in" },
          { l: ["Deck clearance volume", "余隙高度容积"], v: num(vDeck, 2) + " cc", s: num(deck, 3) + " in " + L("above the piston", "（活塞上方）") },
          { l: ["Bore / stroke ratio", "缸径行程比"], v: num(bs, 3), s: bs > 1 ? L("oversquare", "短行程") : (bs < 1 ? L("undersquare", "长行程") : L("square", "等径程")) },
          { l: ["Displacement per cylinder", "单缸排量"], v: num(totalCc / n, 0) + " cc", s: n + " " + L("cylinders", "缸") }
        ],
        flags: flags,
        svg: cylinderSvg(bore, stroke, deck),
        formula: [
          "Displacement = π ÷ 4 × bore² × stroke × cylinders. Static CR = (swept volume + clearance volume) ÷ clearance volume, where clearance volume = chamber + gasket + deck + dish (a dome subtracts).",
          "排量 = π ÷ 4 × 缸径² × 行程 × 缸数。静态压缩比 =（工作容积 + 余隙容积）÷ 余隙容积，其中余隙容积 = 燃烧室 + 缸垫 + 余隙高度 + 活塞凹坑（凸顶则为负）。"
        ],
        note: [
          "This is the static ratio, the one machine shops quote. It is not the dynamic compression ratio, which depends on when the intake valve closes and is what actually decides whether an engine will detonate on a given fuel. Measure chamber volume by cc-ing the head rather than trusting a catalogue number — a valve job or a skim changes it.",
          "这里算的是静态压缩比，也就是机加工厂常说的那个值。它不是动态压缩比——后者取决于进气门关闭时刻，才是真正决定某种燃油会不会爆震的关键。燃烧室容积建议用量筒实测（cc 缸盖），不要照抄样本数据，因为修气门或平面加工都会改变它。"
        ]
      };
    }
  });

  /* ============================================================
   * 6. SVG diagram builders
   * ============================================================ */
  function tireSvg(A, B) {
    var W = 340, H = 250, ground = 226, cx = 170;
    var maxOd = Math.max(A.odIn, B.odIn);
    var k = 196 / maxOd;                       // px per inch of diameter
    var rA = A.odIn * k / 2, rB = B.odIn * k / 2;
    var rimA = A.rimIn * k / 2, rimB = B.rimIn * k / 2;
    var cyA = ground - rA, cyB = ground - rB;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tire size comparison diagram">';
    s += '<line class="ground" x1="14" y1="' + ground + '" x2="' + (W - 14) + '" y2="' + ground + '" />';
    // tire A
    s += '<circle class="outline-a" cx="' + cx + '" cy="' + cyA.toFixed(1) + '" r="' + rA.toFixed(1) + '" />';
    s += '<circle class="outline-a" style="stroke-width:1.2;opacity:.55" cx="' + cx + '" cy="' + cyA.toFixed(1) + '" r="' + rimA.toFixed(1) + '" />';
    // tire B
    s += '<circle class="outline-b" cx="' + cx + '" cy="' + cyB.toFixed(1) + '" r="' + rB.toFixed(1) + '" />';
    s += '<circle class="outline-b" style="stroke-width:1.2;opacity:.55;stroke-dasharray:3 3" cx="' + cx + '" cy="' + cyB.toFixed(1) + '" r="' + rimB.toFixed(1) + '" />';
    // axle marks
    s += '<line class="dim-dash" x1="' + (cx - rA - 8) + '" y1="' + cyA.toFixed(1) + '" x2="' + (cx + rA + 8) + '" y2="' + cyA.toFixed(1) + '" />';
    if (Math.abs(cyA - cyB) > 1.5) {
      s += '<line class="dim-dash" x1="' + (cx - rB - 8) + '" y1="' + cyB.toFixed(1) + '" x2="' + (cx + rB + 8) + '" y2="' + cyB.toFixed(1) + '" />';
      var mid = (cyA + cyB) / 2;
      s += '<text class="redtxt" x="' + (cx + Math.max(rA, rB) + 12) + '" y="' + mid.toFixed(1) + '">' + sgn((B.odIn - A.odIn) / 2, 2) + '"</text>';
    }
    s += '<text class="lbl" x="16" y="20">' + esc(A.label) + '</text>';
    s += '<text class="lbl-sm" x="16" y="35">' + num(A.odIn, 2) + ' in / ' + num(A.odMm, 0) + ' mm</text>';
    s += '<text class="lbl" x="' + (W - 16) + '" y="20" text-anchor="end" style="fill:var(--accent)">' + esc(B.label) + '</text>';
    s += '<text class="lbl-sm" x="' + (W - 16) + '" y="35" text-anchor="end">' + num(B.odIn, 2) + ' in / ' + num(B.odMm, 0) + ' mm</text>';
    s += '<text class="lbl-sm" x="' + cx + '" y="' + (ground + 16) + '" text-anchor="middle">' + L("road surface", "路面") + '</text>';
    s += '</svg>';
    return s;
  }

  function offsetSvg(a, b) {
    var W = 340, H = 236, hub = 168;
    var span = Math.max(a.W / 2 + Math.abs(a.et), b.W / 2 + Math.abs(b.et), a.t / 2, b.t / 2, 120);
    var k = 145 / span;
    function wheel(o, y, cls, name) {
      var out = o.W / 2 - o.et, inn = o.W / 2 + o.et;
      var x1 = hub - inn * k, x2 = hub + out * k;
      var g = '';
      if (o.t > 0) {
        var tOut = o.t / 2 - o.et, tIn = o.t / 2 + o.et;
        g += '<rect x="' + (hub - tIn * k).toFixed(1) + '" y="' + (y - 9) + '" width="' + ((tIn + tOut) * k).toFixed(1) + '" height="' + (44 + 18) + '" rx="6" fill="none" stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="4 3" />';
      }
      g += '<rect class="' + cls + '" x="' + x1.toFixed(1) + '" y="' + y + '" width="' + ((inn + out) * k).toFixed(1) + '" height="44" rx="4" />';
      // centreline of the wheel
      var ctr = hub - o.et * k;
      g += '<line class="centerline" x1="' + ctr.toFixed(1) + '" y1="' + (y - 12) + '" x2="' + ctr.toFixed(1) + '" y2="' + (y + 56) + '" />';
      g += '<text class="lbl-sm" x="' + x1.toFixed(1) + '" y="' + (y - 6) + '">' + name + '</text>';
      g += '<text class="lbl-sm" x="' + x2.toFixed(1) + '" y="' + (y - 6) + '" text-anchor="end">ET' + (o.et >= 0 ? "+" : "\u2212") + num(Math.abs(o.et), 0) + '</text>';
      return g;
    }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Wheel offset cross-section diagram">';
    s += '<text class="lbl-sm" x="10" y="14">← ' + L("inboard (suspension)", "内侧（悬挂）") + '</text>';
    s += '<text class="lbl-sm" x="' + (W - 10) + '" y="14" text-anchor="end">' + L("outboard (fender)", "外侧（翼子板）") + ' →</text>';
    s += '<line class="hub" x1="' + hub + '" y1="24" x2="' + hub + '" y2="' + (H - 24) + '" stroke-width="3" />';
    s += '<text class="lbl-sm" x="' + (hub + 5) + '" y="' + (H - 12) + '">' + L("hub face", "轮毂法兰面") + '</text>';
    s += wheel(a, 44, "part", L("current", "原车"));
    s += wheel(b, 138, "part-b", L("new", "新"));
    s += '</svg>';
    return s;
  }

  function speedoSvg(indicated, actual) {
    var W = 320, H = 200, cx = 160, cy = 168, R = 128;
    var maxV = Math.max(indicated, actual) * 1.35 || 100;
    var step = maxV > 150 ? 40 : maxV > 80 ? 20 : 10;
    var top = Math.ceil(maxV / step) * step;
    function ang(v) { return Math.PI * (1 - clamp(v / top, 0, 1)); }
    function pt(v, r) { var a = ang(v); return [cx + Math.cos(a) * r, cy - Math.sin(a) * r]; }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Speedometer comparison dial">';
    s += '<path d="M ' + (cx - R) + ' ' + cy + ' A ' + R + ' ' + R + ' 0 0 1 ' + (cx + R) + ' ' + cy + '" fill="none" stroke="var(--border)" stroke-width="12" stroke-linecap="round" />';
    for (var v0 = 0; v0 <= top + 0.001; v0 += step) {
      var p1 = pt(v0, R - 12), p2 = pt(v0, R - 22), p3 = pt(v0, R - 36);
      s += '<line x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '" stroke="var(--muted)" stroke-width="2" />';
      s += '<text class="lbl-sm" x="' + p3[0].toFixed(1) + '" y="' + (p3[1] + 4).toFixed(1) + '" text-anchor="middle">' + num(isUS() ? v0 : v0 * KM_MI, 0) + '</text>';
    }
    var ip = pt(indicated, R - 30), ap = pt(actual, R - 46);
    s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ip[0].toFixed(1) + '" y2="' + ip[1].toFixed(1) + '" stroke="var(--muted)" stroke-width="4" stroke-linecap="round" />';
    s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ap[0].toFixed(1) + '" y2="' + ap[1].toFixed(1) + '" stroke="var(--primary)" stroke-width="5" stroke-linecap="round" />';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="var(--text)" />';
    s += '<text class="lbl-sm" x="14" y="' + (cy - 4) + '">' + L("dial", "码表") + ' ' + fSpeed(indicated) + '</text>';
    s += '<text class="redtxt" x="' + (W - 14) + '" y="' + (cy - 4) + '" text-anchor="end">' + L("actual", "实际") + ' ' + fSpeed(actual) + '</text>';
    s += '</svg>';
    return s;
  }

  function gearSvg(totalRatio, dia) {
    var W = 320, H = 210;
    var r1 = 40, r2 = clamp(40 * Math.sqrt(Math.max(totalRatio, 0.2)), 22, 84);
    var c1x = 92, c1y = 100, c2x = c1x + r1 + r2 + 8, c2y = 100;
    function gear(cx, cy, r, cls, teeth) {
      var g = '<circle class="' + cls + '" cx="' + cx + '" cy="' + cy + '" r="' + r.toFixed(1) + '" />';
      for (var i = 0; i < teeth; i++) {
        var a = i / teeth * Math.PI * 2;
        var x1 = cx + Math.cos(a) * r, y1 = cy + Math.sin(a) * r;
        var x2 = cx + Math.cos(a) * (r + 6), y2 = cy + Math.sin(a) * (r + 6);
        g += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".8" />';
      }
      g += '<circle class="hub" cx="' + cx + '" cy="' + cy + '" r="7" />';
      return g;
    }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Gear ratio diagram">';
    s += gear(c1x, c1y, r1, "part", 12);
    s += '<g style="color:var(--accent)">' + gear(c2x, c2y, r2, "part-b", Math.max(10, Math.round(12 * r2 / r1))) + '</g>';
    s += '<text class="lbl" x="' + c1x + '" y="' + (c1y + r1 + 26) + '" text-anchor="middle">' + L("engine side", "发动机端") + '</text>';
    s += '<text class="lbl" x="' + c2x + '" y="' + (c2y + r2 + 26) + '" text-anchor="middle">' + L("wheel side", "车轮端") + '</text>';
    s += '<text class="dimtxt" x="' + W / 2 + '" y="20" text-anchor="middle">' + L("total reduction", "总减速比") + ' ' + num(totalRatio, 2) + ' : 1</text>';
    s += '<text class="lbl-sm" x="' + W / 2 + '" y="' + (H - 10) + '" text-anchor="middle">' + L("tire diameter", "轮胎外径") + ' ' + num(dia, 2) + ' in / ' + num(dia * MM_IN, 0) + ' mm</text>';
    s += '</svg>';
    return s;
  }

  function batterySvg(s1, s2) {
    var W = 320, H = 150, x = 26, y = 40, w = 250, h = 68;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="State of charge diagram">';
    s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="10" fill="var(--surface-2)" stroke="var(--text-soft)" stroke-width="2.5" />';
    s += '<rect x="' + (x + w + 3) + '" y="' + (y + h / 2 - 12) + '" width="9" height="24" rx="3" fill="var(--text-soft)" />';
    s += '<rect x="' + (x + 5) + '" y="' + (y + 5) + '" width="' + ((w - 10) * clamp(s1, 0, 100) / 100).toFixed(1) + '" height="' + (h - 10) + '" rx="6" fill="var(--muted)" opacity=".55" />';
    s += '<rect x="' + (x + 5 + (w - 10) * clamp(s1, 0, 100) / 100).toFixed(1) + '" y="' + (y + 5) + '" width="' + ((w - 10) * clamp(s2 - s1, 0, 100) / 100).toFixed(1) + '" height="' + (h - 10) + '" rx="6" fill="var(--primary)" opacity=".82" />';
    for (var p = 25; p < 100; p += 25) {
      var gx = x + 5 + (w - 10) * p / 100;
      s += '<line x1="' + gx.toFixed(1) + '" y1="' + (y + 5) + '" x2="' + gx.toFixed(1) + '" y2="' + (y + h - 5) + '" stroke="var(--surface)" stroke-width="1.5" opacity=".8" />';
    }
    s += '<text class="lbl" x="' + x + '" y="' + (y - 10) + '">' + num(s1, 0) + '%</text>';
    s += '<text class="redtxt" x="' + (x + w) + '" y="' + (y - 10) + '" text-anchor="end">' + L("target", "目标") + ' ' + num(s2, 0) + '%</text>';
    s += '<text class="lbl-sm" x="' + (x + w / 2) + '" y="' + (y + h + 22) + '" text-anchor="middle">' + L("shaded band is the energy this session adds", "阴影区间为本次充电增加的电量") + '</text>';
    s += '</svg>';
    return s;
  }

  function gaugeSvg(psi, placard) {
    var W = 320, H = 196, cx = 160, cy = 160, R = 122;
    var top = Math.max(50, Math.ceil((Math.max(psi, placard) * 1.4) / 10) * 10);
    function ang(v) { return Math.PI * (1 - clamp(v / top, 0, 1)); }
    function pt(v, r) { var a = ang(v); return [cx + Math.cos(a) * r, cy - Math.sin(a) * r]; }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tire pressure gauge">';
    s += '<path d="M ' + (cx - R) + ' ' + cy + ' A ' + R + ' ' + R + ' 0 0 1 ' + (cx + R) + ' ' + cy + '" fill="none" stroke="var(--border)" stroke-width="13" stroke-linecap="round" />';
    // low-pressure danger arc up to 75% of placard
    var lowEnd = placard * 0.75, la = ang(lowEnd);
    s += '<path d="M ' + (cx - R) + ' ' + cy + ' A ' + R + ' ' + R + ' 0 0 1 ' + (cx + Math.cos(la) * R).toFixed(1) + ' ' + (cy - Math.sin(la) * R).toFixed(1) + '" fill="none" stroke="var(--danger)" stroke-width="13" opacity=".55" stroke-linecap="round" />';
    for (var v0 = 0; v0 <= top + 0.001; v0 += 10) {
      var p1 = pt(v0, R - 13), p2 = pt(v0, R - 23), p3 = pt(v0, R - 37);
      s += '<line x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '" stroke="var(--muted)" stroke-width="2" />';
      s += '<text class="lbl-sm" x="' + p3[0].toFixed(1) + '" y="' + (p3[1] + 4).toFixed(1) + '" text-anchor="middle">' + v0 + '</text>';
    }
    var pp = pt(placard, R - 13), pp2 = pt(placard, R - 30);
    s += '<line x1="' + pp[0].toFixed(1) + '" y1="' + pp[1].toFixed(1) + '" x2="' + pp2[0].toFixed(1) + '" y2="' + pp2[1].toFixed(1) + '" stroke="var(--ok)" stroke-width="3.5" />';
    var np = pt(psi, R - 42);
    s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + np[0].toFixed(1) + '" y2="' + np[1].toFixed(1) + '" stroke="var(--primary)" stroke-width="5" stroke-linecap="round" />';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="var(--text)" />';
    s += '<text class="lbl-sm" x="14" y="' + (cy - 2) + '">psi</text>';
    s += '<text class="redtxt" x="' + (W - 14) + '" y="' + (cy - 2) + '" text-anchor="end">' + num(psi, 1) + ' psi</text>';
    s += '<text class="lbl-sm" x="' + cx + '" y="26" text-anchor="middle" style="fill:var(--ok)">' + L("placard", "铭牌值") + ' ' + num(placard, 0) + ' · ' + L("red = TPMS zone", "红区 = TPMS 报警区") + '</text>';
    s += '</svg>';
    return s;
  }

  function cylinderSvg(bore, stroke, deck) {
    var W = 300, H = 240;
    var k = Math.min(150 / Math.max(bore, 0.1), 150 / Math.max(stroke + 1.2, 0.1));
    var bw = bore * k, sh = stroke * k, dk = Math.max(deck * k, 2);
    var cx = 150, top = 34;
    var x = cx - bw / 2;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Cylinder bore and stroke diagram">';
    // cylinder walls
    s += '<rect class="part" x="' + x.toFixed(1) + '" y="' + top + '" width="' + bw.toFixed(1) + '" height="' + (sh + dk + 26).toFixed(1) + '" rx="3" />';
    // clearance volume band
    s += '<rect x="' + x.toFixed(1) + '" y="' + top + '" width="' + bw.toFixed(1) + '" height="' + dk.toFixed(1) + '" fill="var(--primary)" opacity=".45" />';
    // piston at TDC
    s += '<rect class="hub" x="' + (x + 2).toFixed(1) + '" y="' + (top + dk).toFixed(1) + '" width="' + (bw - 4).toFixed(1) + '" height="26" rx="2" />';
    // piston at BDC (dashed)
    s += '<rect x="' + (x + 2).toFixed(1) + '" y="' + (top + dk + sh).toFixed(1) + '" width="' + (bw - 4).toFixed(1) + '" height="26" rx="2" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5 4" />';
    // stroke dimension
    var dx = x + bw + 18;
    s += '<line class="dim" x1="' + dx + '" y1="' + (top + dk + 13).toFixed(1) + '" x2="' + dx + '" y2="' + (top + dk + sh + 13).toFixed(1) + '" />';
    s += '<text class="dimtxt" x="' + (dx + 6) + '" y="' + (top + dk + sh / 2 + 17).toFixed(1) + '">' + num(stroke, 3) + ' in</text>';
    // bore dimension
    var by = top + dk + sh + 50;
    s += '<line class="dim" x1="' + x.toFixed(1) + '" y1="' + by + '" x2="' + (x + bw).toFixed(1) + '" y2="' + by + '" />';
    s += '<text class="dimtxt" x="' + cx + '" y="' + (by + 16) + '" text-anchor="middle">' + L("bore", "缸径") + ' ' + num(bore, 3) + ' in</text>';
    s += '<text class="lbl-sm" x="' + (x - 6) + '" y="' + (top + 8) + '" text-anchor="end">' + L("clearance", "余隙") + '</text>';
    s += '<text class="lbl-sm" x="' + (x - 6) + '" y="' + (top + dk + 20).toFixed(1) + '" text-anchor="end">TDC</text>';
    s += '<text class="lbl-sm" x="' + (x - 6) + '" y="' + (top + dk + sh + 20).toFixed(1) + '" text-anchor="end">BDC</text>';
    s += '</svg>';
    return s;
  }

  /* ============================================================
   * 7. Rendering
   * ============================================================ */
  function fieldHtml(t, f) {
    if (f.head) return '<div class="sub-head">' + bi(f.head[0], f.head[1]) + '</div>';
    var id = "f_" + t.id + "_" + f.id;
    var unit = f.u ? " (" + unitLabel(f.u) + ")" : "";
    var h = '<div class="field" data-field="' + f.id + '"' + (f.showIf ? ' data-showif="' + esc(JSON.stringify(f.showIf)) + '"' : '') + '>';
    h += '<label for="' + id + '">' + bi(esc(f.lab[0]) + unit, esc(f.lab[1]) + unit) + '</label>';
    if (f.type === "sel") {
      h += '<select id="' + id + '" data-in="' + f.id + '">';
      f.opts.forEach(function (o) {
        h += '<option value="' + esc(o[0]) + '"' + (o[0] === f.def ? " selected" : "") + '>' + esc(state.lang === "zh" ? o[2] : o[1]) + '</option>';
      });
      h += '</select>';
    } else if (f.type === "text") {
      h += '<input id="' + id + '" data-in="' + f.id + '" type="text" value="' + esc(f.def) + '" autocomplete="off" spellcheck="false" />';
    } else {
      var dv = f.u ? UCONV[f.u].from(f.def, state.sys) : f.def;
      h += '<input id="' + id + '" data-in="' + f.id + '"' + (f.u ? ' data-u="' + f.u + '"' : '') + ' type="number" step="' + (f.step || "any") + '" value="' + (Math.round(dv * 1e6) / 1e6) + '" />';
    }
    if (f.hint) h += '<span class="hint">' + bi(esc(f.hint[0]), esc(f.hint[1])) + '</span>';
    h += '</div>';
    return h;
  }

  function toolHtml(t) {
    var h = '<div class="tool-panel" id="panel-' + t.id + '" data-tool="' + t.id + '">';
    h += '<div class="tool-head"><h3>' + bi(t.name[0], t.name[1]) + '</h3><p>' + bi(t.desc[0], t.desc[1]) + '</p></div>';
    h += '<div class="tool-grid">';
    h += '<div class="card tool-inputs">' + t.fields.map(function (f) { return fieldHtml(t, f); }).join("") + '<div class="error-msg" id="err-' + t.id + '"></div></div>';
    h += '<div class="card tool-output" id="out-' + t.id + '"></div>';
    h += '</div></div>';
    return h;
  }

  function renderOutput(t) {
    var panel = document.getElementById("panel-" + t.id);
    if (!panel) return;
    var out = document.getElementById("out-" + t.id);
    var errEl = document.getElementById("err-" + t.id);

    var raws = {};
    panel.querySelectorAll("[data-in]").forEach(function (el) { raws[el.getAttribute("data-in")] = el.value; });

    // conditional fields
    panel.querySelectorAll("[data-showif]").forEach(function (el) {
      var cond = JSON.parse(el.getAttribute("data-showif"));
      var show = Object.keys(cond).every(function (k) { return raws[k] === cond[k]; });
      el.style.display = show ? "" : "none";
    });

    function s(id) { return raws[id] === undefined ? "" : raws[id]; }
    function v(id) {
      var f = null;
      t.fields.forEach(function (x) { if (x.id === id) f = x; });
      var n = parseFloat(String(raws[id]).replace(/,/g, ""));
      if (!isFinite(n)) return NaN;
      return (f && f.u) ? UCONV[f.u].to(n, state.sys) : n;
    }

    var r;
    try { r = t.calc(v, s); }
    catch (e) { r = { err: ["Something in those inputs does not compute. Check the numbers.", "输入的参数无法计算，请检查数值。"] }; }

    if (r && r.err) {
      errEl.innerHTML = bi(esc(r.err[0]), esc(r.err[1]));
      out.innerHTML = '<p class="section-sub" style="margin:0">' + bi("Waiting for valid input…", "等待有效输入…") + '</p>';
      return;
    }
    errEl.innerHTML = "";

    var h = "";
    if (r.svg) {
      h += '<div class="diagram">' + r.svg + '</div>';
      if (r.legend) {
        h += '<div class="legend">' + r.legend.map(function (g) { return '<span class="lg-' + g[0] + '">' + esc(g[1]) + '</span>'; }).join("") + '</div>';
      }
    }
    if (r.res) {
      h += '<div class="results">';
      r.res.forEach(function (x) {
        var cls = "result" + (x.accent ? " accent" : "") + (x.good ? " good" : "") + (x.bad ? " bad" : "") + (x.wide ? " wide" : "");
        h += '<div class="' + cls + '"><span class="rlabel">' + bi(esc(x.l[0]), esc(x.l[1])) + '</span><span class="rval">' + x.v + '</span>' + (x.s ? '<span class="rsub">' + x.s + '</span>' : "") + '</div>';
      });
      h += '</div>';
    }
    if (r.meters) {
      h += '<div class="meter">';
      r.meters.forEach(function (m) {
        h += '<div class="meter-row"><div class="meter-top"><span>' + esc(m.lab) + '</span><span>' + num(m.pct, 0) + '%</span></div>' +
          '<div class="meter-bar"><div class="meter-fill ' + m.cls + '" style="width:' + clamp(m.pct, 0, 100).toFixed(1) + '%"></div></div></div>';
      });
      h += '</div>';
    }
    if (r.flags && r.flags.length) {
      h += '<div>' + r.flags.map(function (f) { return '<span class="code-flag ' + f[0] + '">' + esc(f[1]) + '</span>'; }).join("") + '</div>';
    }
    if (r.table) {
      h += '<table class="dtable"><thead><tr>' + r.table.head.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join("") + '</tr></thead><tbody>';
      r.table.rows.forEach(function (row) {
        h += '<tr>' + row.map(function (c, i) { return '<td' + (i === 1 ? ' class="em"' : '') + '>' + esc(c) + '</td>'; }).join("") + '</tr>';
      });
      h += '</tbody></table>';
    }
    if (r.formula) {
      h += '<div class="formula-box"><span class="f-title">' + bi("The maths", "计算公式") + '</span>' + bi(r.formula[0], r.formula[1]) + '</div>';
    }
    if (r.note) {
      h += '<div class="note-box">' + bi(esc(r.note[0]), esc(r.note[1])) + '</div>';
    }
    out.innerHTML = h;
  }

  function renderAll() {
    var root = document.getElementById("tools-root");
    if (!root) return;
    var list = landingTool ? TOOLS.filter(function (t) { return t.id === landingTool; }) : TOOLS;
    if (!list.length) list = TOOLS;

    var h = '<div class="unit-switch" id="unit-switch">' +
      '<button type="button" data-sys="us"' + (state.sys === "us" ? ' class="active"' : '') + '>' + bi("US units (in, mph, psi, gal)", "英制（in / mph / psi / gal）") + '</button>' +
      '<button type="button" data-sys="metric"' + (state.sys === "metric" ? ' class="active"' : '') + '>' + bi("Metric (mm, km/h, kPa, L)", "公制（mm / km/h / kPa / L）") + '</button>' +
      '</div>';

    if (!landingTool) {
      h += '<div class="tool-tabs" role="tablist">';
      list.forEach(function (t, i) {
        h += '<button class="tool-tab' + (i === 0 ? " active" : "") + '" type="button" data-tab="' + t.id + '" role="tab">' + bi(t.tab[0], t.tab[1]) + '</button>';
      });
      h += '</div>';
    }
    h += list.map(toolHtml).join("");
    root.innerHTML = h;
    var first = root.querySelector(".tool-panel");
    if (first) first.classList.add("active");

    root.querySelectorAll(".tool-tab").forEach(function (b) {
      b.addEventListener("click", function () {
        root.querySelectorAll(".tool-tab").forEach(function (x) { x.classList.remove("active"); });
        root.querySelectorAll(".tool-panel").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        var p = document.getElementById("panel-" + b.getAttribute("data-tab"));
        if (p) p.classList.add("active");
      });
    });

    root.querySelectorAll("#unit-switch button").forEach(function (b) {
      b.addEventListener("click", function () { setSys(b.getAttribute("data-sys")); });
    });

    list.forEach(function (t) {
      var panel = document.getElementById("panel-" + t.id);
      panel.querySelectorAll("[data-in]").forEach(function (el) {
        el.addEventListener("input", function () { renderOutput(t); });
        el.addEventListener("change", function () { renderOutput(t); });
      });
      renderOutput(t);
    });
  }

  function setSys(sys) {
    if (sys === state.sys) return;
    var old = state.sys;
    // convert existing numeric values in place
    document.querySelectorAll("[data-u]").forEach(function (el) {
      var u = el.getAttribute("data-u");
      var n = parseFloat(el.value);
      if (!isFinite(n)) return;
      var canon = UCONV[u].to(n, old);
      var next = UCONV[u].from(canon, sys);
      el.value = Math.round(next * 1e6) / 1e6;
    });
    state.sys = sys;
    try { localStorage.setItem("torquix-sys", sys); } catch (e) { }
    // relabel + recompute without losing typed values
    document.querySelectorAll(".tool-panel").forEach(function (panel) {
      var tid = panel.getAttribute("data-tool");
      var t = TOOLS.filter(function (x) { return x.id === tid; })[0];
      if (!t) return;
      t.fields.forEach(function (f) {
        if (f.head || !f.u) return;
        var lab = panel.querySelector('label[for="f_' + t.id + "_" + f.id + '"]');
        if (lab) lab.innerHTML = bi(esc(f.lab[0]) + " (" + unitLabel(f.u) + ")", esc(f.lab[1]) + " (" + unitLabel(f.u) + ")");
      });
      renderOutput(t);
    });
    document.querySelectorAll("#unit-switch button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-sys") === sys);
    });
  }

  /* ============================================================
   * 8. Chrome: language, theme, boot
   * ============================================================ */
  function applyLang() {
    document.documentElement.setAttribute("data-lang", state.lang);
    document.documentElement.setAttribute("lang", state.lang === "zh" ? "zh-CN" : "en");
    var dict = I18N[state.lang];
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var k = el.getAttribute("data-i18n");
      if (dict[k]) el.textContent = dict[k];
    });
    var btn = document.getElementById("lang-toggle");
    if (btn) btn.textContent = state.lang === "zh" ? "EN" : "中文";
    // select option labels are language-specific
    document.querySelectorAll(".tool-panel select[data-in]").forEach(function (sel) {
      var tid = sel.closest(".tool-panel").getAttribute("data-tool");
      var t = TOOLS.filter(function (x) { return x.id === tid; })[0];
      if (!t) return;
      var f = t.fields.filter(function (x) { return x.id === sel.getAttribute("data-in"); })[0];
      if (!f || !f.opts) return;
      Array.prototype.forEach.call(sel.options, function (o, i) { o.textContent = state.lang === "zh" ? f.opts[i][2] : f.opts[i][1]; });
    });
    document.querySelectorAll(".tool-panel").forEach(function (panel) {
      var tid = panel.getAttribute("data-tool");
      var t = TOOLS.filter(function (x) { return x.id === tid; })[0];
      if (t) renderOutput(t);
    });
  }
  function setLang(l) {
    state.lang = l;
    try { localStorage.setItem("torquix-lang", l); } catch (e) { }
    applyLang();
  }
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    var btn = document.getElementById("theme-toggle");
    if (btn) btn.textContent = state.theme === "dark" ? "☀" : "☾";
  }
  function setTheme(t) {
    state.theme = t;
    try { localStorage.setItem("torquix-theme", t); } catch (e) { }
    applyTheme();
  }

  function boot() {
    try {
      var l = localStorage.getItem("torquix-lang"); if (l === "en" || l === "zh") state.lang = l;
      var th = localStorage.getItem("torquix-theme"); if (th === "light" || th === "dark") state.theme = th;
      var sy = localStorage.getItem("torquix-sys"); if (sy === "us" || sy === "metric") state.sys = sy;
    } catch (e) { }
    var qp = new URLSearchParams(window.location.search);
    if (qp.get("lang") === "zh") state.lang = "zh";
    if (qp.get("lang") === "en") state.lang = "en";

    applyTheme();
    document.documentElement.setAttribute("data-lang", state.lang);
    renderAll();
    applyLang();

    var lb = document.getElementById("lang-toggle");
    if (lb) lb.addEventListener("click", function () { setLang(state.lang === "zh" ? "en" : "zh"); });
    var tb = document.getElementById("theme-toggle");
    if (tb) tb.addEventListener("click", function () { setTheme(state.theme === "dark" ? "light" : "dark"); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.TORQUIX = { TOOLS: TOOLS, parseTire: parseTire };
})();
