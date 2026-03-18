document.addEventListener("DOMContentLoaded", () => {
  const data = window.AI_BUSINESS_DATASET;
  if (!data) {
    document.body.innerHTML = "<main style='padding:24px;color:#fff'>Dataset bundle failed to load.</main>";
    return;
  }

  const PALETTES = {
    aurora: ["#7ed7ff", "#b08cff", "#ff7ab6", "#7ef0a9", "#ffd166", "#ff9f43"],
    sunset: ["#ff7a7a", "#ffb86b", "#ffd166", "#b08cff", "#7ed7ff", "#7ef0a9"],
    prism: ["#7ed7ff", "#7ef0a9", "#ffd166", "#ff9f43", "#ff7ab6", "#b08cff"],
    candy: ["#fb7185", "#f59e0b", "#22c55e", "#38bdf8", "#a78bfa", "#f472b6"],
    neon: ["#00f5d4", "#00bbf9", "#fee440", "#f15bb5", "#9b5de5", "#ff9f1c"],
    accessible: ["#56B4E9", "#E69F00", "#009E73", "#CC79A7", "#F0E442", "#0072B2", "#D55E00", "#999999"],
  };

  const PALETTE_CHOICES = ["aurora", "sunset", "prism", "candy", "neon"];

  const CHARTS = [
    ["scatter", "Scatter"],
    ["bar", "Bar"],
    ["box", "Box"],
    ["heatmap", "Heatmap"],
  ];

  const state = {
    scope: "runs",
    chartType: "scatter",
    stat: "mean",
    xField: "performance_1_tokens_total (add all tokens throughout the simulation)",
    yField: "duration_seconds",
    groupField: "agent_model",
    sizeField: "moves_total (API Call Count)",
    zField: "reasoning_tokens_total",
    palette: "aurora",
    colorMode: "standard",
    topN: 20,
    modelFilter: "all",
    feedbackFilter: "all",
    gridFilter: "all",
    varietyFilter: "all",
    densityFilter: "all",
    searchQuery: "",
    controlOnly: false,
    selectedKey: null,
    selectedRecord: null,
  };

  const els = {
    summaryRuns: document.getElementById("summaryRuns"),
    summaryConfigs: document.getElementById("summaryConfigs"),
    summaryModels: document.getElementById("summaryModels"),
    scopeSelect: document.getElementById("scopeSelect"),
    chartTypeSelect: document.getElementById("chartTypeSelect"),
    statSelect: document.getElementById("statSelect"),
    xFieldSelect: document.getElementById("xFieldSelect"),
    yFieldSelect: document.getElementById("yFieldSelect"),
    groupFieldSelect: document.getElementById("groupFieldSelect"),
    sizeFieldSelect: document.getElementById("sizeFieldSelect"),
    paletteSelect: document.getElementById("paletteSelect"),
    a11yModeToggle: document.getElementById("a11yModeToggle"),
    insightViewSelect: document.getElementById("insightViewSelect"),
    topNInput: document.getElementById("topNInput"),
    modelFilter: document.getElementById("modelFilter"),
    feedbackFilter: document.getElementById("feedbackFilter"),
    gridFilter: document.getElementById("gridFilter"),
    varietyFilter: document.getElementById("varietyFilter"),
    densityFilter: document.getElementById("densityFilter"),
    searchInput: document.getElementById("searchInput"),
    controlOnlyToggle: document.getElementById("controlOnlyToggle"),
    sideViewSelect: document.getElementById("sideViewSelect"),
    randomPaletteBtn: document.getElementById("randomPaletteBtn"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    resetBtn: document.getElementById("resetBtn"),
    vizMeta: document.getElementById("vizMeta"),
    chartHint: document.getElementById("chartHint"),
    legend: document.getElementById("legend"),
    chartSvg: document.getElementById("chartSvg"),
    tooltip: document.getElementById("tooltip"),
    kpiRow: document.getElementById("kpiRow"),
    tableMeta: document.getElementById("tableMeta"),
    tableHead: document.getElementById("tableHead"),
    tableBody: document.getElementById("tableBody"),
    modelSummaryTable: document.getElementById("modelSummaryTable"),
    controlFamilyTable: document.getElementById("controlFamilyTable"),
    tokenRankTable: document.getElementById("tokenRankTable"),
    corrGrid: document.getElementById("corrGrid"),
    overviewPanel: document.getElementById("overviewPanel"),
    modelPanel: document.getElementById("modelPanel"),
    controlPanel: document.getElementById("controlPanel"),
    tokenPanel: document.getElementById("tokenPanel"),
    correlationPanel: document.getElementById("correlationPanel"),
    selectionPanel: document.getElementById("selectionPanel"),
    selectionShell: document.querySelector(".selection-shell"),
  };

  function numeric(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function fmt(value) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "number") {
      if (Number.isInteger(value)) return String(value);
      return value.toFixed(Math.abs(value) >= 100 ? 1 : 3).replace(/\.0+$/, "");
    }
    return String(value);
  }

  function titleCase(value) {
    return String(value)
      .replace(/\s*\((.*?)\)\s*/g, " ($1)")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeCsv(value) {
    const str = String(value ?? "");
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  }

  function csvFromRows(rows, fields) {
    return [fields.join(","), ...rows.map((row) => fields.map((f) => escapeCsv(row[f])).join(","))].join("\n");
  }

  function makeSvg(tag, attrs = {}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function sourceRowsForScope(scope = state.scope) {
    if (scope === "configs") return data.configs;
    if (scope === "control") {
      return data.runs.filter((row) =>
        Number(row["job_complexity (maze size)"]) === 6 &&
        Number(row["task_variety (subtask_variety)"]) === 2 &&
        Number(row.density ?? densityFromKey(row.config_key)) === 100
      );
    }
    return data.runs;
  }

  function densityFromKey(configKey) {
    const match = String(configKey ?? "").match(/dens(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function currentRows() {
    let rows = sourceRowsForScope().slice();

    if (state.controlOnly && state.scope !== "configs") {
      rows = rows.filter((row) =>
        Number(row["job_complexity (maze size)"] ?? row.grid) === 6 &&
        Number(row["task_variety (subtask_variety)"] ?? row.variety) === 2 &&
        Number(row.density ?? densityFromKey(row.config_key) ?? 100) === 100
      );
    }

    if (state.modelFilter !== "all") {
      rows = rows.filter((row) => String(row.agent_model ?? row.model ?? "") === state.modelFilter);
    }
    if (state.feedbackFilter !== "all") {
      rows = rows.filter((row) => String(row["feedback (memory count)"] ?? row.feedback ?? "") === state.feedbackFilter);
    }
    if (state.gridFilter !== "all") {
      rows = rows.filter((row) => String(row.grid ?? row["job_complexity (maze size)"] ?? "") === state.gridFilter);
    }
    if (state.varietyFilter !== "all") {
      rows = rows.filter((row) => String(row.variety ?? row["task_variety (subtask_variety)"] ?? "") === state.varietyFilter);
    }
    if (state.densityFilter !== "all") {
      rows = rows.filter((row) => String(row.density ?? "") === state.densityFilter);
    }
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.trim().toLowerCase();
      rows = rows.filter((row) => Object.values(row).some((v) => String(v).toLowerCase().includes(q)));
    }
    return rows;
  }

  function currentFields() {
    const sampleRows = sourceRowsForScope();
    const keys = [...new Set(sampleRows.flatMap((row) => Object.keys(row)))];
    const important = keys.filter((key) => !key.startsWith("_"));
    const numericKeys = important.filter((key) => isNumericField(sampleRows, key));
    const categoricalKeys = important.filter((key) => !numericKeys.includes(key));
    return { fields: important, numericFields: numericKeys, categoricalFields: categoricalKeys };
  }

  function isNumericField(rows, field) {
    const sample = rows.slice(0, 24);
    let count = 0;
    for (const row of sample) {
      if (numeric(row[field]) !== null) count += 1;
    }
    return sample.length > 0 && count / sample.length >= 0.7;
  }

  function statValue(values, stat) {
    const nums = values.map((v) => numeric(v)).filter((v) => v !== null);
    if (!nums.length) return 0;
    if (stat === "count") return nums.length;
    if (stat === "sum") return nums.reduce((a, b) => a + b, 0);
    const sorted = nums.slice().sort((a, b) => a - b);
    if (stat === "median") {
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  function quartiles(values) {
    const nums = values.map((v) => numeric(v)).filter((v) => v !== null).sort((a, b) => a - b);
    if (!nums.length) return null;
    const q = (p) => {
      const idx = (nums.length - 1) * p;
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      return lo === hi ? nums[lo] : nums[lo] * (hi - idx) + nums[hi] * (idx - lo);
    };
    return {
      min: nums[0],
      q1: q(0.25),
      median: q(0.5),
      q3: q(0.75),
      max: nums[nums.length - 1],
    };
  }

  function mean(values) {
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  function pearson(xs, ys) {
    const pairs = xs.map((x, i) => [numeric(x), numeric(ys[i])]).filter(([x, y]) => x !== null && y !== null);
    if (pairs.length < 2) return 0;
    const xVals = pairs.map(([x]) => x);
    const yVals = pairs.map(([, y]) => y);
    const mx = mean(xVals);
    const my = mean(yVals);
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < pairs.length; i += 1) {
      const a = xVals[i] - mx;
      const b = yVals[i] - my;
      num += a * b;
      dx += a * a;
      dy += b * b;
    }
    return num / Math.sqrt((dx || 1) * (dy || 1));
  }

  function correlations(rows, fields) {
    const matrix = [];
    for (const a of fields) {
      for (const b of fields) {
        matrix.push({ a, b, value: a === b ? 1 : pearson(rows.map((r) => r[a]), rows.map((r) => r[b])) });
      }
    }
    return matrix;
  }

  function bandScale(categories, start, end, padding = 0.16) {
    const n = Math.max(categories.length, 1);
    const span = end - start;
    const step = span / n;
    const band = step * (1 - padding);
    const offset = (step - band) / 2;
    const map = new Map();
    categories.forEach((cat, i) => map.set(cat, start + i * step + offset));
    return { map, band, step };
  }

  function linearScale(min, max, start, end) {
    const span = (max - min) || 1;
    return (value) => start + ((value - min) / span) * (end - start);
  }

  function niceTicks(min, max, count = 5) {
    if (min === max) return [min];
    const step = (max - min) / (count - 1);
    return Array.from({ length: count }, (_, i) => min + step * i);
  }

  function paletteForGroup(categories) {
    const paletteName = state.colorMode === "accessible" ? "accessible" : state.palette;
    const palette = PALETTES[paletteName] ?? PALETTES.aurora;
    return categories.map((cat, i) => {
      if (typeof cat === "number" && Number.isFinite(cat)) {
        const t = categories.length <= 1 ? 0 : i / (categories.length - 1);
        if (state.colorMode === "accessible") {
          return `hsl(${208 + t * 12} 84% ${72 - t * 26}%)`;
        }
        return `hsl(${194 + t * 120} 74% ${58 - t * 10}%)`;
      }
      return palette[i % palette.length];
    });
  }

  function heatColor(t) {
    const clamped = Math.max(0, Math.min(1, t));
    if (state.colorMode === "accessible") {
      const light = 84 - clamped * 54;
      return `hsl(208 86% ${light}%)`;
    }
    const hue = 200 + clamped * 90;
    const light = 18 + clamped * 36;
    return `hsl(${hue} 80% ${light}%)`;
  }

  function fillSelect(select, values, current) {
    const existing = current ?? select.value;
    clearNode(select);
    values.forEach((value) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value === "None" ? "None" : titleCase(value);
      select.appendChild(opt);
    });
    if (values.includes(existing)) {
      select.value = existing;
    } else if (values.length) {
      select.value = values[0];
    }
  }

  function fillFilterSelect(select, values) {
    const current = select.value || "all";
    clearNode(select);
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "All";
    select.appendChild(all);
    values.forEach((value) => {
      const opt = document.createElement("option");
      opt.value = String(value);
      opt.textContent = String(value);
      select.appendChild(opt);
    });
    if ([...select.options].some((o) => o.value === current)) select.value = current;
  }

  function updateHero() {
    els.summaryRuns.textContent = fmt(data.summary.runs);
    els.summaryConfigs.textContent = fmt(data.summary.config_archives);
    els.summaryModels.textContent = fmt(Object.keys(data.summary.models).length);
  }

  function updateSelectors() {
    const { fields } = currentFields();
    const numericFields = fields.filter((field) => isNumericField(sourceRowsForScope(), field));
    const categoricalFields = fields.filter((field) => !numericFields.includes(field));

    fillSelect(els.scopeSelect, ["runs", "configs", "control"], state.scope);
    els.scopeSelect.options[0].textContent = "Run-level";
    els.scopeSelect.options[1].textContent = "Config-level";
    els.scopeSelect.options[2].textContent = "Control family";

    fillSelect(els.chartTypeSelect, CHARTS.map((d) => d[0]), state.chartType);
    for (const opt of els.chartTypeSelect.options) opt.textContent = CHARTS.find((d) => d[0] === opt.value)?.[1] ?? opt.value;

    fillSelect(els.paletteSelect, PALETTE_CHOICES, state.palette);

    const yDefault = numericFields.includes(state.yField) ? state.yField : (numericFields[0] ?? fields[0]);
    const xDefault = fields.includes(state.xField) ? state.xField : (categoricalFields[0] ?? fields[0]);
    const gDefault = fields.includes(state.groupField) ? state.groupField : (state.scope === "configs" ? "model" : "agent_model");
    const sizeDefault = state.sizeField === "None" ? "None" : (fields.includes(state.sizeField) ? state.sizeField : yDefault);
    const zDefault = fields.includes(state.zField) ? state.zField : yDefault;

    fillSelect(els.xFieldSelect, fields, xDefault);
    fillSelect(els.yFieldSelect, fields, yDefault);
    fillSelect(els.groupFieldSelect, [state.scope === "configs" ? "model" : "agent_model", ...fields.filter((f) => f !== "agent_model" && f !== "model")], gDefault);
    fillSelect(els.sizeFieldSelect, ["None", ...fields], sizeDefault);

    state.xField = els.xFieldSelect.value;
    state.yField = els.yFieldSelect.value;
    state.groupField = els.groupFieldSelect.value;
    state.sizeField = els.sizeFieldSelect.value;
    state.zField = zDefault;
  }

  function applyColorMode() {
    const accessible = state.colorMode === "accessible";
    document.body.classList.toggle("a11y-mode", accessible);
    els.paletteSelect.disabled = accessible;
    els.randomPaletteBtn.disabled = accessible;
    if (!accessible && !PALETTE_CHOICES.includes(state.palette)) {
      state.palette = "aurora";
    }
  }

  function updateFilters() {
    const rows = sourceRowsForScope();
    const models = [...new Set(rows.map((row) => row.agent_model ?? row.model).filter(Boolean))].sort();
    const feedbacks = [...new Set(rows.map((row) => row["feedback (memory count)"] ?? row.feedback).filter((v) => v !== undefined && v !== null))].sort((a, b) => Number(a) - Number(b));
    const grids = [...new Set(rows.map((row) => row.grid ?? row["job_complexity (maze size)"]).filter((v) => v !== undefined && v !== null))].sort((a, b) => Number(a) - Number(b));
    const varieties = [...new Set(rows.map((row) => row.variety ?? row["task_variety (subtask_variety)"]).filter((v) => v !== undefined && v !== null))].sort((a, b) => Number(a) - Number(b));
    const densities = [...new Set(rows.map((row) => row.density ?? densityFromKey(row.config_key)).filter((v) => v !== undefined && v !== null))].sort((a, b) => Number(a) - Number(b));

    fillFilterSelect(els.modelFilter, models);
    fillFilterSelect(els.feedbackFilter, feedbacks);
    fillFilterSelect(els.gridFilter, grids);
    fillFilterSelect(els.varietyFilter, varieties);
    fillFilterSelect(els.densityFilter, densities);
  }

  function renderKpis(rows) {
    const models = [...new Set(rows.map((row) => row.agent_model ?? row.model).filter(Boolean))];
    const totalTokens = rows.reduce((sum, row) => sum + (numeric(row["performance_1_tokens_total (add all tokens throughout the simulation)"]) ?? numeric(row.mean_total_tokens) ?? 0), 0);
    const avgDuration = rows.reduce((sum, row) => sum + (numeric(row.duration_seconds) ?? numeric(row.mean_duration_seconds) ?? 0), 0) / (rows.length || 1);
    const avgMoves = rows.reduce((sum, row) => sum + (numeric(row["moves_total (API Call Count)"]) ?? numeric(row.mean_moves_total) ?? 0), 0) / (rows.length || 1);
    const controlRows = rows.filter((row) => Number(row["feedback (memory count)"] ?? row.feedback) === 2);
    const stats = [
      ["Rows", rows.length, `scope: ${state.scope}`],
      ["Models", models.length, models.join(", ") || "none"],
      ["Tokens", totalTokens, state.scope === "configs" ? "sum over config rows" : "sum over filtered runs"],
      ["Avg duration", avgDuration, `${controlRows.length} fb2 rows`],
    ];

    clearNode(els.kpiRow);
    stats.forEach(([label, value, note]) => {
      const card = document.createElement("div");
      card.className = "kpi";
      card.innerHTML = `<div class="klabel">${label}</div><div class="kvalue">${fmt(value)}<small>${note}</small></div>`;
      els.kpiRow.appendChild(card);
    });
  }

  function setLegend(entries) {
    clearNode(els.legend);
    entries.slice(0, 8).forEach(([label, color]) => {
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `<span class="legend-swatch" style="background:${color};color:${color}"></span><span>${label}</span>`;
      els.legend.appendChild(item);
    });
  }

  function showTooltip(event, title, pairs) {
    const rect = els.chartSvg.getBoundingClientRect();
    els.tooltip.hidden = false;
    els.tooltip.style.left = `${event.clientX - rect.left + 14}px`;
    els.tooltip.style.top = `${event.clientY - rect.top + 14}px`;
    els.tooltip.innerHTML = `<div class="title">${title}</div>${pairs.map(([k, v]) => `<div class="row"><span class="key">${k}</span><span>${v}</span></div>`).join("")}`;
  }

  function hideTooltip() {
    els.tooltip.hidden = true;
  }

  function rowKey(row) {
    return row.run_id ?? row.config_key ?? `${row.agent_model ?? row.model}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function setSelection(row) {
    state.selectedRecord = row;
    state.selectedKey = rowKey(row);
    renderSelection();
  }

  function renderSelection() {
    if (!state.selectedRecord) {
      els.selectionPanel.textContent = "Click a mark in the chart to inspect the row.";
      return;
    }
    const row = state.selectedRecord;
    const keys = [
      "run_id",
      "config_key",
      "agent_model",
      "feedback (memory count)",
      "job_complexity (maze size)",
      "task_variety (subtask_variety)",
      "moves_total (API Call Count)",
      "reasoning_tokens_total",
      "performance_1_tokens_total (add all tokens throughout the simulation)",
      "duration_seconds",
      "mean_total_tokens",
      "mean_moves_total",
      "run_count",
      "subtask_family_breakdown",
    ];
    const rows = keys
      .filter((key) => row[key] !== undefined)
      .map((key) => `<div class="row"><span class="key">${titleCase(key)}</span><span>${fmt(row[key])}</span></div>`)
      .join("");
    els.selectionPanel.innerHTML = `<div class="selection-title">${fmt(row.run_id ?? row.config_key ?? "Selection")}</div>${rows}`;
  }

  function groupBy(rows, field) {
    const map = new Map();
    rows.forEach((row) => {
      const key = String(row[field] ?? "Unknown");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  }

  function renderScatter(rows) {
    const svg = els.chartSvg;
    clearNode(svg);
    const W = 980, H = 560, m = { top: 36, right: 28, bottom: 68, left: 84 };
    const innerW = W - m.left - m.right;
    const innerH = H - m.top - m.bottom;
    const xField = state.xField;
    const yField = state.yField;
    const sizeField = state.sizeField === "None" ? null : state.sizeField;
    const groupField = state.groupField;

    const pts = rows.map((row) => ({
      row,
      x: numeric(row[xField]),
      y: numeric(row[yField]),
      size: sizeField ? numeric(row[sizeField]) : null,
      group: String(row[groupField] ?? "Unknown"),
    })).filter((p) => p.x !== null && p.y !== null);

    if (!pts.length) {
      svg.appendChild(textNode("Choose numeric x and y fields for scatter.", W / 2, H / 2));
      els.chartHint.textContent = "Scatter plot needs two numeric fields.";
      return;
    }

    const xMin = Math.min(...pts.map((p) => p.x));
    const xMax = Math.max(...pts.map((p) => p.x));
    const yMin = Math.min(...pts.map((p) => p.y));
    const yMax = Math.max(...pts.map((p) => p.y));
    const xScale = linearScale(xMin, xMax, m.left, m.left + innerW);
    const yScale = linearScale(yMin, yMax, m.top + innerH, m.top);

    const groups = [...new Set(pts.map((p) => p.group))];
    const colors = paletteForGroup(groups);
    const colorMap = new Map(groups.map((g, i) => [g, colors[i]]));
    const sizes = pts.map((p) => p.size).filter((v) => v !== null);
    const sMin = sizes.length ? Math.min(...sizes) : 0;
    const sMax = sizes.length ? Math.max(...sizes) : 1;
    const sizeScale = linearScale(sMin, sMax, 4.5, 14);

    drawGrid(svg, m, innerW, innerH, 5, 5);
    renderAxesNumeric(svg, m, innerW, innerH, xScale, yScale, xField, yField, xMin, xMax, yMin, yMax);

    const trend = linearRegression(pts.map((p) => p.x), pts.map((p) => p.y));
    if (trend) {
      svg.appendChild(makeSvg("line", {
        x1: xScale(xMin),
        y1: yScale(trend.slope * xMin + trend.intercept),
        x2: xScale(xMax),
        y2: yScale(trend.slope * xMax + trend.intercept),
        stroke: "rgba(255,255,255,0.45)",
        "stroke-width": 2,
        "stroke-dasharray": "8 8",
      }));
    }

    pts.forEach((p, i) => {
      const circle = makeSvg("circle", {
        cx: xScale(p.x),
        cy: yScale(p.y),
        r: sizeField ? sizeScale(p.size ?? sMin) : 7,
        fill: colorMap.get(p.group) ?? colors[i % colors.length],
        opacity: 0.92,
        stroke: "rgba(4,10,18,0.9)",
        "stroke-width": 1.2,
        cursor: "pointer",
      });
      circle.addEventListener("mouseenter", (event) => {
        showTooltip(event, p.row.run_id ?? p.row.config_key ?? "Row", [
          [titleCase(xField), fmt(p.row[xField])],
          [titleCase(yField), fmt(p.row[yField])],
          [titleCase(groupField), fmt(p.row[groupField] ?? p.group)],
          [titleCase(sizeField ?? ""), fmt(sizeField ? p.row[sizeField] : "")],
        ].filter(([k, v]) => k && v !== ""));
      });
      circle.addEventListener("mouseleave", hideTooltip);
      circle.addEventListener("click", () => setSelection(p.row));
      svg.appendChild(circle);
    });

    setLegend(groups.map((g, i) => [g, colors[i]]));
    els.chartHint.textContent = `Scatter of ${titleCase(xField)} vs ${titleCase(yField)} colored by ${titleCase(groupField)}.`;
  }

  function drawGrid(svg, m, innerW, innerH, xTicks, yTicks) {
    const xCount = Math.max(1, xTicks);
    const yCount = Math.max(1, yTicks);
    for (let i = 0; i <= xCount; i += 1) {
      const x = m.left + (innerW / xCount) * i;
      svg.appendChild(makeSvg("line", { x1: x, y1: m.top, x2: x, y2: m.top + innerH, class: "gridline" }));
    }
    for (let i = 0; i <= yCount; i += 1) {
      const y = m.top + (innerH / yCount) * i;
      svg.appendChild(makeSvg("line", { x1: m.left, y1: y, x2: m.left + innerW, y2: y, class: "gridline" }));
    }
  }

  function textNode(text, x, y, attrs = {}) {
    const el = makeSvg("text", { x, y, fill: "#fff", "text-anchor": "middle", "dominant-baseline": "middle", ...attrs });
    el.textContent = text;
    return el;
  }

  function renderAxesNumeric(svg, m, innerW, innerH, xScale, yScale, xField, yField, xMin, xMax, yMin, yMax) {
    const axisX = makeSvg("g", { class: "axis" });
    const axisY = makeSvg("g", { class: "axis" });

    axisX.appendChild(makeSvg("line", {
      x1: m.left,
      y1: m.top + innerH,
      x2: m.left + innerW,
      y2: m.top + innerH,
      stroke: "rgba(255,255,255,0.24)",
    }));
    axisY.appendChild(makeSvg("line", {
      x1: m.left,
      y1: m.top,
      x2: m.left,
      y2: m.top + innerH,
      stroke: "rgba(255,255,255,0.24)",
    }));

    niceTicks(xMin, xMax, 5).forEach((tick) => {
      const x = xScale(tick);
      axisX.appendChild(makeSvg("line", { x1: x, y1: m.top + innerH, x2: x, y2: m.top + innerH + 6, stroke: "rgba(255,255,255,0.32)" }));
      const label = makeSvg("text", { x, y: m.top + innerH + 22, "text-anchor": "middle" });
      label.textContent = fmt(tick);
      axisX.appendChild(label);
    });
    niceTicks(yMin, yMax, 5).forEach((tick) => {
      const y = yScale(tick);
      axisY.appendChild(makeSvg("line", { x1: m.left - 6, y1: y, x2: m.left, y2: y, stroke: "rgba(255,255,255,0.32)" }));
      const label = makeSvg("text", { x: m.left - 12, y: y + 4, "text-anchor": "end" });
      label.textContent = fmt(tick);
      axisY.appendChild(label);
    });

    const xl = makeSvg("text", { x: m.left + innerW / 2, y: m.top + innerH + 46, "text-anchor": "middle", fill: "#abc0d8" });
    xl.textContent = titleCase(xField);
    const yl = makeSvg("text", { x: 20, y: m.top + innerH / 2, transform: `rotate(-90 20 ${m.top + innerH / 2})`, "text-anchor": "middle", fill: "#abc0d8" });
    yl.textContent = titleCase(yField);

    svg.appendChild(axisX);
    svg.appendChild(axisY);
    svg.appendChild(xl);
    svg.appendChild(yl);
  }

  function renderBar(rows) {
    const svg = els.chartSvg;
    clearNode(svg);
    const W = 980, H = 560, m = { top: 36, right: 26, bottom: 100, left: 84 };
    const innerW = W - m.left - m.right;
    const innerH = H - m.top - m.bottom;
    const xField = state.xField;
    const yField = state.yField;

    const groups = [...groupBy(rows, xField).entries()]
      .map(([group, items]) => ({ group, items, value: statValue(items.map((r) => r[yField]), state.stat) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, state.topN);

    if (!groups.length) {
      svg.appendChild(textNode("No grouped rows available.", W / 2, H / 2));
      return;
    }

    const categories = groups.map((g) => g.group);
    const values = groups.map((g) => g.value);
    const maxV = Math.max(...values, 1);
    const band = bandScale(categories, m.left, m.left + innerW, 0.28);
    const colors = paletteForGroup(categories);

    drawGrid(svg, m, innerW, innerH, 0, 5);
    renderYAxis(svg, m, innerH, maxV, yField);

    groups.forEach((g, i) => {
      const x = band.map.get(g.group);
      const h = (g.value / maxV) * innerH;
      const y = m.top + innerH - h;
      const rect = makeSvg("rect", {
        x,
        y,
        width: band.band,
        height: h,
        rx: 12,
        fill: colors[i],
        opacity: 0.94,
        cursor: "pointer",
      });
      rect.addEventListener("mouseenter", (event) => showTooltip(event, String(g.group), [
        [titleCase(yField), fmt(g.value)],
        ["Rows", fmt(g.items.length)],
        ["Stat", state.stat],
      ]));
      rect.addEventListener("mouseleave", hideTooltip);
      rect.addEventListener("click", () => setSelection(g.items[0]));
      svg.appendChild(rect);

      const label = makeSvg("text", {
        x: x + band.band / 2,
        y: m.top + innerH + 22,
        "text-anchor": "end",
        transform: `rotate(-30 ${x + band.band / 2} ${m.top + innerH + 22})`,
        fill: "#abc0d8",
        "font-size": "11",
      });
      label.textContent = String(g.group);
      svg.appendChild(label);
    });

    setLegend(categories.map((cat, i) => [cat, colors[i]]));
    els.chartHint.textContent = `Bar chart of ${state.stat} ${titleCase(yField)} by ${titleCase(xField)}.`;
  }

  function renderYAxis(svg, m, innerH, maxV, label) {
    const axis = makeSvg("g", { class: "axis" });
    axis.appendChild(makeSvg("line", {
      x1: m.left,
      y1: m.top,
      x2: m.left,
      y2: m.top + innerH,
      stroke: "rgba(255,255,255,0.24)",
    }));
    niceTicks(0, maxV, 5).forEach((tick) => {
      const y = m.top + innerH - (tick / (maxV || 1)) * innerH;
      axis.appendChild(makeSvg("line", { x1: m.left - 6, y1: y, x2: m.left, y2: y, stroke: "rgba(255,255,255,0.32)" }));
      const labelEl = makeSvg("text", { x: m.left - 12, y: y + 4, "text-anchor": "end" });
      labelEl.textContent = fmt(tick);
      axis.appendChild(labelEl);
    });
    const yl = makeSvg("text", { x: 20, y: m.top + innerH / 2, transform: `rotate(-90 20 ${m.top + innerH / 2})`, "text-anchor": "middle", fill: "#abc0d8" });
    yl.textContent = titleCase(label);
    svg.appendChild(axis);
    svg.appendChild(yl);
  }

  function renderBox(rows) {
    const svg = els.chartSvg;
    clearNode(svg);
    const W = 980, H = 560, m = { top: 36, right: 26, bottom: 94, left: 84 };
    const innerW = W - m.left - m.right;
    const innerH = H - m.top - m.bottom;
    const xField = state.xField;
    const yField = state.yField;

    const groups = [...groupBy(rows, xField).entries()]
      .map(([group, items]) => ({ group, items, q: quartiles(items.map((r) => r[yField])) }))
      .filter((g) => g.q)
      .sort((a, b) => b.q.median - a.q.median)
      .slice(0, state.topN);

    if (!groups.length) {
      svg.appendChild(textNode("No boxplot data available.", W / 2, H / 2));
      return;
    }

    const minV = Math.min(...groups.map((g) => g.q.min));
    const maxV = Math.max(...groups.map((g) => g.q.max));
    const yScale = linearScale(minV, maxV, m.top + innerH, m.top);
    const band = bandScale(groups.map((g) => g.group), m.left, m.left + innerW, 0.34);
    const colors = paletteForGroup(groups.map((g) => g.group));

    drawGrid(svg, m, innerW, innerH, 0, 5);
    renderBoxYAxis(svg, m, innerH, minV, maxV, yField);

    groups.forEach((g, i) => {
      const x = band.map.get(g.group);
      const boxX = x + band.band * 0.18;
      const boxW = band.band * 0.64;
      const q = g.q;
      const minY = yScale(q.min);
      const q1Y = yScale(q.q1);
      const medY = yScale(q.median);
      const q3Y = yScale(q.q3);
      const maxY = yScale(q.max);
      const color = colors[i];

      svg.appendChild(makeSvg("line", {
        x1: x + band.band / 2,
        y1: minY,
        x2: x + band.band / 2,
        y2: maxY,
        stroke: color,
        "stroke-width": 2,
      }));
      svg.appendChild(makeSvg("rect", {
        x: boxX,
        y: q3Y,
        width: boxW,
        height: Math.max(1, q1Y - q3Y),
        rx: 12,
        fill: color,
        opacity: 0.92,
        cursor: "pointer",
      }));
      svg.appendChild(makeSvg("line", {
        x1: boxX,
        y1: medY,
        x2: boxX + boxW,
        y2: medY,
        stroke: "rgba(4,10,18,0.9)",
        "stroke-width": 3,
      }));
      svg.appendChild(makeSvg("line", {
        x1: boxX + boxW * 0.24,
        y1: minY,
        x2: boxX + boxW * 0.76,
        y2: minY,
        stroke: color,
        "stroke-width": 2,
      }));
      svg.appendChild(makeSvg("line", {
        x1: boxX + boxW * 0.24,
        y1: maxY,
        x2: boxX + boxW * 0.76,
        y2: maxY,
        stroke: color,
        "stroke-width": 2,
      }));

      const hit = makeSvg("rect", {
        x: boxX,
        y: maxY,
        width: boxW,
        height: Math.max(1, minY - maxY),
        fill: "transparent",
        cursor: "pointer",
      });
      hit.addEventListener("mouseenter", (event) => showTooltip(event, String(g.group), [
        ["Median", fmt(q.median)],
        ["Q1", fmt(q.q1)],
        ["Q3", fmt(q.q3)],
        ["Min", fmt(q.min)],
        ["Max", fmt(q.max)],
        ["Rows", fmt(g.items.length)],
      ]));
      hit.addEventListener("mouseleave", hideTooltip);
      hit.addEventListener("click", () => setSelection(g.items[0]));
      svg.appendChild(hit);

      const label = makeSvg("text", {
        x: x + band.band / 2,
        y: m.top + innerH + 22,
        "text-anchor": "end",
        transform: `rotate(-30 ${x + band.band / 2} ${m.top + innerH + 22})`,
        fill: "#abc0d8",
        "font-size": "11",
      });
      label.textContent = String(g.group);
      svg.appendChild(label);
    });

    setLegend(groups.map((g, i) => [g.group, colors[i]]));
    els.chartHint.textContent = `Box plot of ${titleCase(yField)} grouped by ${titleCase(xField)}.`;
  }

  function renderBoxYAxis(svg, m, innerH, minV, maxV, label) {
    const axis = makeSvg("g", { class: "axis" });
    const scale = linearScale(minV, maxV, m.top + innerH, m.top);
    axis.appendChild(makeSvg("line", {
      x1: m.left,
      y1: m.top,
      x2: m.left,
      y2: m.top + innerH,
      stroke: "rgba(255,255,255,0.24)",
    }));
    niceTicks(minV, maxV, 5).forEach((tick) => {
      const y = scale(tick);
      axis.appendChild(makeSvg("line", { x1: m.left - 6, y1: y, x2: m.left, y2: y, stroke: "rgba(255,255,255,0.32)" }));
      const text = makeSvg("text", { x: m.left - 12, y: y + 4, "text-anchor": "end" });
      text.textContent = fmt(tick);
      axis.appendChild(text);
    });
    const yl = makeSvg("text", { x: 20, y: m.top + innerH / 2, transform: `rotate(-90 20 ${m.top + innerH / 2})`, "text-anchor": "middle", fill: "#abc0d8" });
    yl.textContent = titleCase(label);
    svg.appendChild(axis);
    svg.appendChild(yl);
  }

  function renderHeatmap(rows) {
    const svg = els.chartSvg;
    clearNode(svg);
    const W = 980, H = 560, m = { top: 52, right: 28, bottom: 90, left: 128 };
    const innerW = W - m.left - m.right;
    const innerH = H - m.top - m.bottom;
    const xField = state.xField;
    const yField = state.yField;
    const zField = state.zField;

    const xCats = [...new Set(rows.map((r) => String(r[xField] ?? "Unknown")))].slice(0, 18);
    const yCats = [...new Set(rows.map((r) => String(r[yField] ?? "Unknown")))].slice(0, 18);
    if (!xCats.length || !yCats.length) {
      svg.appendChild(textNode("Choose categorical axes for heatmap.", W / 2, H / 2));
      return;
    }

    const xBand = bandScale(xCats, m.left, m.left + innerW, 0.08);
    const yBand = bandScale(yCats, m.top, m.top + innerH, 0.08);
    const cells = [];
    let minVal = Infinity;
    let maxVal = -Infinity;

    yCats.forEach((yCat) => {
      xCats.forEach((xCat) => {
        const cellRows = rows.filter((r) => String(r[xField] ?? "Unknown") === xCat && String(r[yField] ?? "Unknown") === yCat);
        const value = cellRows.length ? statValue(cellRows.map((r) => r[zField]), state.stat === "count" ? "count" : "mean") : 0;
        cells.push({ xCat, yCat, value, rows: cellRows });
        minVal = Math.min(minVal, value);
        maxVal = Math.max(maxVal, value);
      });
    });

    cells.forEach((cell) => {
      const x = xBand.map.get(cell.xCat);
      const y = yBand.map.get(cell.yCat);
      const t = (cell.value - minVal) / ((maxVal - minVal) || 1);
      const rect = makeSvg("rect", {
        x,
        y,
        width: xBand.band,
        height: yBand.band,
        rx: 10,
        fill: heatColor(t),
        opacity: 0.96,
        cursor: "pointer",
      });
      rect.addEventListener("mouseenter", (event) => showTooltip(event, `${cell.xCat} / ${cell.yCat}`, [
        [titleCase(zField), fmt(cell.value)],
        ["Rows", fmt(cell.rows.length)],
        ["Stat", state.stat],
      ]));
      rect.addEventListener("mouseleave", hideTooltip);
      rect.addEventListener("click", () => setSelection(cell.rows[0] ?? rows[0]));
      svg.appendChild(rect);

      if (xBand.band > 30 && yBand.band > 28) {
        const text = makeSvg("text", {
          x: x + xBand.band / 2,
          y: y + yBand.band / 2 + 4,
          "text-anchor": "middle",
          fill: cell.value > (maxVal + minVal) / 2 ? "#031019" : "#f8fbff",
          "font-size": "11",
          "font-weight": "700",
        });
        text.textContent = fmt(cell.value);
        svg.appendChild(text);
      }
    });

    renderHeatLabels(svg, m, xCats, yCats, xBand, yBand, xField, yField);
    setLegend([["Low", heatColor(0)], ["Mid", heatColor(0.5)], ["High", heatColor(1)]]);
    els.chartHint.textContent = `Heatmap of ${titleCase(zField)} across ${titleCase(xField)} and ${titleCase(yField)}.`;
  }

  function renderHeatLabels(svg, m, xCats, yCats, xBand, yBand, xField, yField) {
    const xAxis = makeSvg("g", { class: "axis" });
    const yAxis = makeSvg("g", { class: "axis" });
    xCats.forEach((cat) => {
      const x = xBand.map.get(cat) + xBand.band / 2;
      const label = makeSvg("text", {
        x,
        y: m.top + yBand.band * yCats.length + 26,
        "text-anchor": "end",
        transform: `rotate(-28 ${x} ${m.top + yBand.band * yCats.length + 26})`,
        fill: "#abc0d8",
        "font-size": "11",
      });
      label.textContent = String(cat);
      xAxis.appendChild(label);
    });
    yCats.forEach((cat) => {
      const y = yBand.map.get(cat) + yBand.band / 2 + 4;
      const label = makeSvg("text", {
        x: m.left - 10,
        y,
        "text-anchor": "end",
        fill: "#abc0d8",
        "font-size": "11",
      });
      label.textContent = String(cat);
      yAxis.appendChild(label);
    });
    const xl = makeSvg("text", { x: m.left + (xBand.band * xCats.length) / 2, y: 540, "text-anchor": "middle", fill: "#abc0d8" });
    xl.textContent = titleCase(xField);
    const yl = makeSvg("text", { x: 18, y: m.top + (yBand.band * yCats.length) / 2, transform: `rotate(-90 18 ${m.top + (yBand.band * yCats.length) / 2})`, "text-anchor": "middle", fill: "#abc0d8" });
    yl.textContent = titleCase(yField);
    svg.appendChild(xAxis);
    svg.appendChild(yAxis);
    svg.appendChild(xl);
    svg.appendChild(yl);
  }

  function linearRegression(xs, ys) {
    const pts = xs.map((x, i) => [numeric(x), numeric(ys[i])]).filter(([x, y]) => x !== null && y !== null);
    if (pts.length < 2) return null;
    const n = pts.length;
    const sumX = pts.reduce((s, [x]) => s + x, 0);
    const sumY = pts.reduce((s, [, y]) => s + y, 0);
    const sumXY = pts.reduce((s, [x, y]) => s + x * y, 0);
    const sumXX = pts.reduce((s, [x]) => s + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / ((n * sumXX - sumX * sumX) || 1);
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
  }

  function renderChart(rows) {
    if (!rows.length) {
      clearNode(els.chartSvg);
      els.chartSvg.appendChild(textNode("No rows match the current filters.", 490, 280));
      setLegend([]);
      els.chartHint.textContent = "Loosen the filters to view data.";
      return;
    }

    if (state.chartType === "scatter") renderScatter(rows);
    else if (state.chartType === "bar") renderBar(rows);
    else if (state.chartType === "box") renderBox(rows);
    else renderHeatmap(rows);
  }

  function renderTables(rows) {
    const fields = state.scope === "configs"
      ? ["config_key", "model", "grid", "variety", "feedback", "run_count", "mean_total_tokens", "mean_moves_total", "mean_duration_seconds"]
      : ["run_id", "agent_model", "feedback (memory count)", "moves_total (API Call Count)", "reasoning_tokens_total", "duration_seconds", "config_key"];

    clearNode(els.tableHead);
    clearNode(els.tableBody);
    const head = document.createElement("tr");
    fields.forEach((field) => {
      const th = document.createElement("th");
      th.textContent = titleCase(field);
      head.appendChild(th);
    });
    els.tableHead.appendChild(head);

    const sorted = rows.slice().sort((a, b) => {
      const av = numeric(a[state.yField] ?? a.mean_total_tokens ?? a.mean_moves_total ?? a.run_count) ?? 0;
      const bv = numeric(b[state.yField] ?? b.mean_total_tokens ?? b.mean_moves_total ?? b.run_count) ?? 0;
      return bv - av;
    });

    sorted.slice(0, state.topN).forEach((row) => {
      const tr = document.createElement("tr");
      if (state.selectedKey === rowKey(row)) tr.style.background = "rgba(126, 215, 255, 0.08)";
      tr.addEventListener("click", () => setSelection(row));
      fields.forEach((field) => {
        const td = document.createElement("td");
        td.textContent = fmt(row[field]);
        tr.appendChild(td);
      });
      els.tableBody.appendChild(tr);
    });
    els.tableMeta.textContent = `Showing ${Math.min(state.topN, rows.length)} of ${rows.length} rows`;
  }

  function renderModelSummary() {
    clearNode(els.modelSummaryTable);
    const header = document.createElement("tr");
    ["Model", "Runs", "Avg Moves", "Avg Thoughts", "Avg Tokens", "Avg Duration"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      header.appendChild(th);
    });
    els.modelSummaryTable.appendChild(header);
    data.derived.by_model.forEach((row) => {
      const tr = document.createElement("tr");
      [row.agent_model, row.runs, row.avg_moves, row.avg_thoughts, row.avg_tokens, row.avg_duration].forEach((value) => {
        const td = document.createElement("td");
        td.textContent = fmt(value);
        tr.appendChild(td);
      });
      els.modelSummaryTable.appendChild(tr);
    });
  }

  function renderControlFamily() {
    clearNode(els.controlFamilyTable);
    const header = document.createElement("tr");
    ["Model", "Feedback", "Median Reasoning", "Median Moves", "Median Duration"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      header.appendChild(th);
    });
    els.controlFamilyTable.appendChild(header);
    Object.entries(data.derived.control_family).forEach(([model, fbMap]) => {
      Object.entries(fbMap).forEach(([fb, stats]) => {
        const tr = document.createElement("tr");
        [model, `fb${fb}`, stats.median_reasoning_tokens, stats.median_moves, stats.median_duration].forEach((value) => {
          const td = document.createElement("td");
          td.textContent = fmt(value);
          tr.appendChild(td);
        });
        els.controlFamilyTable.appendChild(tr);
      });
    });
  }

  function renderTokenRank() {
    clearNode(els.tokenRankTable);
    const header = document.createElement("tr");
    ["Config", "Mean Tokens", "Mean Moves", "Runs"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      header.appendChild(th);
    });
    els.tokenRankTable.appendChild(header);
    data.derived.config_rank_tokens.slice(0, 5).forEach((row) => {
      const tr = document.createElement("tr");
      [row.config_key, row.mean_total_tokens, row.mean_moves_total, row.run_count].forEach((value) => {
        const td = document.createElement("td");
        td.textContent = fmt(value);
        tr.appendChild(td);
      });
      els.tokenRankTable.appendChild(tr);
    });
  }

  function renderCorrelationGrid() {
    clearNode(els.corrGrid);
    const rows = data.runs;
    const fields = [
      "moves_total (API Call Count)",
      "reasoning_tokens_total",
      "thoughts_total",
      "duration_seconds",
      "subtasks_total",
      "performance_1_tokens_total (add all tokens throughout the simulation)",
    ];
    const cells = correlations(rows, fields);
    els.corrGrid.style.gridTemplateColumns = `minmax(160px, 1.35fr) repeat(${fields.length}, minmax(0, 1fr))`;

    const corner = document.createElement("div");
    corner.className = "corr-cell corr-head";
    corner.textContent = "Correlation";
    els.corrGrid.appendChild(corner);

    fields.forEach((field) => {
      const head = document.createElement("div");
      head.className = "corr-cell corr-head";
      head.textContent = titleCase(field);
      els.corrGrid.appendChild(head);
    });

    fields.forEach((rowField) => {
      const rowLabel = document.createElement("div");
      rowLabel.className = "corr-cell corr-label-cell";
      rowLabel.textContent = titleCase(rowField);
      els.corrGrid.appendChild(rowLabel);

      fields.forEach((colField) => {
        const value = cells.find((cell) => cell.a === rowField && cell.b === colField)?.value ?? 0;
        const cell = document.createElement("div");
        cell.className = "corr-cell";
        const strength = Math.min(1, Math.abs(value));
        const bg = value >= 0
          ? `linear-gradient(180deg, rgba(126,215,255,${0.08 + strength * 0.35}), rgba(176,140,255,${0.05 + strength * 0.24}))`
          : `linear-gradient(180deg, rgba(255,122,182,${0.08 + strength * 0.35}), rgba(255,159,67,${0.05 + strength * 0.24}))`;
        cell.style.background = bg;
        cell.innerHTML = `<strong>${value >= 0 ? "+" : ""}${value.toFixed(2)}</strong><div class="corr-label">${Math.abs(value) > 0.7 ? "strong" : Math.abs(value) > 0.35 ? "moderate" : "light"}</div>`;
        els.corrGrid.appendChild(cell);
      });
    });
  }

  function renderInsightsBelow() {
    renderModelSummary();
    renderControlFamily();
    renderTokenRank();
    renderCorrelationGrid();
    renderInsightDisplay();
  }

  function renderInsightDisplay() {
    const mode = els.insightViewSelect.value;
    const map = {
      overview: els.overviewPanel,
      model: els.modelPanel,
      control: els.controlPanel,
      tokens: els.tokenPanel,
    };
    Object.entries(map).forEach(([key, panel]) => {
      panel.classList.toggle("is-panel-hidden", key !== mode);
    });
    els.correlationPanel.classList.remove("is-panel-hidden");
  }

  function renderFocusPanel() {
    const mode = els.sideViewSelect.value;
    if (mode === "hidden") {
      els.selectionShell.classList.add("is-hidden");
      return;
    }
    els.selectionShell.classList.remove("is-hidden");
    renderSelection();
  }

  function syncUI() {
    const rows = currentRows();
    updateSelectors();
    renderKpis(rows);
    renderChart(rows);
    renderTables(rows);
    renderInsightsBelow();
    renderFocusPanel();
    els.vizMeta.textContent = `${state.scope === "runs" ? "Run-level" : state.scope === "configs" ? "Config-level" : "Control family"} view · ${rows.length} rows after filters · palette ${state.palette}`;
  }

  function preset(name) {
    if (name === "overview") {
      state.scope = "runs";
      state.chartType = "scatter";
      state.xField = "performance_1_tokens_total (add all tokens throughout the simulation)";
      state.yField = "duration_seconds";
      state.groupField = "agent_model";
      state.sizeField = "moves_total (API Call Count)";
      state.zField = "reasoning_tokens_total";
      state.controlOnly = false;
      state.modelFilter = "all";
      state.feedbackFilter = "all";
      state.gridFilter = "all";
      state.varietyFilter = "all";
      state.densityFilter = "all";
      state.searchQuery = "";
    } else if (name === "feedback") {
      state.scope = "control";
      state.chartType = "box";
      state.xField = "feedback (memory count)";
      state.yField = "reasoning_tokens_total";
      state.groupField = "agent_model";
      state.sizeField = "None";
      state.controlOnly = true;
      state.modelFilter = "all";
      state.feedbackFilter = "all";
      state.gridFilter = "all";
      state.varietyFilter = "all";
      state.densityFilter = "all";
      state.searchQuery = "";
    } else if (name === "control") {
      state.scope = "control";
      state.chartType = "scatter";
      state.xField = "moves_total (API Call Count)";
      state.yField = "reasoning_tokens_total";
      state.groupField = "feedback (memory count)";
      state.sizeField = "thoughts_total";
      state.controlOnly = true;
      state.modelFilter = "all";
      state.feedbackFilter = "all";
      state.gridFilter = "all";
      state.varietyFilter = "all";
      state.densityFilter = "all";
      state.searchQuery = "";
    } else if (name === "configs") {
      state.scope = "configs";
      state.chartType = "bar";
      state.xField = "config_key";
      state.yField = "mean_total_tokens";
      state.groupField = "model";
      state.sizeField = "run_count";
      state.controlOnly = false;
      state.modelFilter = "all";
      state.feedbackFilter = "all";
      state.gridFilter = "all";
      state.varietyFilter = "all";
      state.densityFilter = "all";
      state.searchQuery = "";
    }
    state.stat = "mean";
    syncStateToUI();
  }

  function syncStateToUI() {
    els.scopeSelect.value = state.scope;
    els.chartTypeSelect.value = state.chartType;
    els.statSelect.value = state.stat;
    els.paletteSelect.value = state.palette;
    els.a11yModeToggle.checked = state.colorMode === "accessible";
    els.topNInput.value = String(state.topN);
    els.modelFilter.value = state.modelFilter;
    els.feedbackFilter.value = state.feedbackFilter;
    els.gridFilter.value = state.gridFilter;
    els.varietyFilter.value = state.varietyFilter;
    els.densityFilter.value = state.densityFilter;
    els.searchInput.value = state.searchQuery;
    els.controlOnlyToggle.checked = state.controlOnly;
    els.sideViewSelect.value = els.sideViewSelect.value || "selection";
    els.insightViewSelect.value = els.insightViewSelect.value || "overview";
    applyColorMode();
    syncUI();
  }

  function resetFilters() {
    state.scope = "runs";
    state.chartType = "scatter";
    state.stat = "mean";
    state.xField = "performance_1_tokens_total (add all tokens throughout the simulation)";
    state.yField = "duration_seconds";
    state.groupField = "agent_model";
    state.sizeField = "moves_total (API Call Count)";
    state.zField = "reasoning_tokens_total";
    state.palette = "aurora";
    state.topN = 20;
    state.modelFilter = "all";
    state.feedbackFilter = "all";
    state.gridFilter = "all";
    state.varietyFilter = "all";
    state.densityFilter = "all";
    state.searchQuery = "";
    state.controlOnly = false;
    state.selectedKey = null;
    state.selectedRecord = null;
    state.colorMode = "standard";
    state.palette = "aurora";
    syncStateToUI();
  }

  function renderSelectionFallback() {
    if (!state.selectedRecord) {
      els.selectionPanel.textContent = "Click a mark in the chart to inspect the row.";
    }
  }

  function renderSelectionWrapper() {
    renderSelectionFallback();
  }

  function currentExportFields() {
    return state.scope === "configs"
      ? ["config_key", "model", "grid", "variety", "feedback", "run_count", "mean_total_tokens", "mean_moves_total", "mean_duration_seconds"]
      : ["run_id", "agent_model", "feedback (memory count)", "moves_total (API Call Count)", "reasoning_tokens_total", "duration_seconds", "config_key"];
  }

  function initialize() {
    updateHero();
    els.scopeSelect.innerHTML = "";
    els.chartTypeSelect.innerHTML = "";
    els.paletteSelect.innerHTML = "";
    updateFilters();
    syncStateToUI();
    renderSelectionWrapper();
  }

  function setPresetFromButton(name) {
    preset(name);
  }

  els.scopeSelect.addEventListener("change", () => {
    state.scope = els.scopeSelect.value;
    updateFilters();
    syncStateToUI();
  });
  els.chartTypeSelect.addEventListener("change", () => {
    state.chartType = els.chartTypeSelect.value;
    syncUI();
  });
  els.statSelect.addEventListener("change", () => {
    state.stat = els.statSelect.value;
    syncUI();
  });
  els.xFieldSelect.addEventListener("change", () => {
    state.xField = els.xFieldSelect.value;
    syncUI();
  });
  els.yFieldSelect.addEventListener("change", () => {
    state.yField = els.yFieldSelect.value;
    syncUI();
  });
  els.groupFieldSelect.addEventListener("change", () => {
    state.groupField = els.groupFieldSelect.value;
    syncUI();
  });
  els.sizeFieldSelect.addEventListener("change", () => {
    state.sizeField = els.sizeFieldSelect.value;
    syncUI();
  });
  els.paletteSelect.addEventListener("change", () => {
    state.palette = els.paletteSelect.value;
    syncUI();
  });
  els.a11yModeToggle.addEventListener("change", () => {
    state.colorMode = els.a11yModeToggle.checked ? "accessible" : "standard";
    if (state.colorMode !== "accessible" && !PALETTE_CHOICES.includes(state.palette)) {
      state.palette = "aurora";
    }
    applyColorMode();
    syncUI();
  });
  els.topNInput.addEventListener("input", () => {
    state.topN = Number(els.topNInput.value);
    syncUI();
  });
  els.modelFilter.addEventListener("change", () => {
    state.modelFilter = els.modelFilter.value;
    syncUI();
  });
  els.feedbackFilter.addEventListener("change", () => {
    state.feedbackFilter = els.feedbackFilter.value;
    syncUI();
  });
  els.gridFilter.addEventListener("change", () => {
    state.gridFilter = els.gridFilter.value;
    syncUI();
  });
  els.varietyFilter.addEventListener("change", () => {
    state.varietyFilter = els.varietyFilter.value;
    syncUI();
  });
  els.densityFilter.addEventListener("change", () => {
    state.densityFilter = els.densityFilter.value;
    syncUI();
  });
  els.searchInput.addEventListener("input", () => {
    state.searchQuery = els.searchInput.value;
    syncUI();
  });
  els.controlOnlyToggle.addEventListener("change", () => {
    state.controlOnly = els.controlOnlyToggle.checked;
    syncUI();
  });
  els.sideViewSelect.addEventListener("change", () => {
    renderFocusPanel();
  });
  els.insightViewSelect.addEventListener("change", () => {
    renderInsightDisplay();
  });
  els.randomPaletteBtn.addEventListener("click", () => {
    if (state.colorMode === "accessible") return;
    const palette = PALETTE_CHOICES[Math.floor(Math.random() * PALETTE_CHOICES.length)];
    state.palette = palette;
    syncUI();
  });
  els.exportCsvBtn.addEventListener("click", () => {
    const rows = currentRows();
    const blob = new Blob([csvFromRows(rows.slice(0, state.topN), currentExportFields())], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai_business_${state.scope}_${Date.now()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  });
  els.resetBtn.addEventListener("click", resetFilters);

  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => setPresetFromButton(btn.dataset.preset));
  });

  initialize();
});
