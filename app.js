/* Pacific Islands KBDI research viewer. Data: data/site_data.js (window.KBDI), written by scripts/kbdi_pacific_site.py. */
(function () {
  "use strict";
  var D = window.KBDI || { domains: [] };
  var KCOL = ["#1a9850", "#66bd63", "#a6d96a", "#fee08b", "#fdae61", "#f46d43", "#d73027", "#7f0000"];
  var SER = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(v, nd) { return v == null || isNaN(v) ? "—" : Number(v).toFixed(nd || 0); }
  function sgn(v, nd) { return v == null || isNaN(v) ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(Number(v)).toFixed(nd || 0); }
  function addDays(iso, n) { var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d; }
  function isoOf(d) { return d.toISOString().slice(0, 10); }
  function niceDate(iso) { return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" }); }

  function theme() {
    var b = $("theme"); if (!b) return;
    b.onclick = function () {
      var cur = document.documentElement.dataset.theme ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var nxt = cur === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = nxt;
      try { localStorage.setItem("kbdi-theme", nxt); } catch (e) { /* storage off */ }
    };
  }

  /* ---------- line chart (SVG, crosshair + tooltip) ----------
     series: [{name, color, values:[number|null], dash}], start ISO date, opts {ymax, refs:[{v,label}], unit} */
  function lineChart(el, start, series, opts) {
    opts = opts || {};
    el.innerHTML = "";
    var W = 1000, H = 300, L = 46, R = 14, T = 12, B = 30;
    var n = Math.max.apply(null, series.map(function (s) { return s.values.length; }));
    if (!n) { el.innerHTML = '<p class="note">No history yet.</p>'; return; }
    var ymax = opts.ymax || 800;
    var x = function (i) { return L + (W - L - R) * (n === 1 ? 0 : i / (n - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - v / ymax); };
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", opts.label || "time series");
    function mk(tag, a) { var e = document.createElementNS(ns, tag); for (var k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; }
    var step = ymax <= 100 ? 25 : 100;
    for (var g = 0; g <= ymax; g += step) {
      mk("line", { x1: L, x2: W - R, y1: y(g), y2: y(g), stroke: "var(--grid)", "stroke-width": 1 });
      var t = mk("text", { x: L - 6, y: y(g) + 4, "text-anchor": "end" }); t.textContent = g;
    }
    (opts.refs || []).forEach(function (r) {
      mk("line", { x1: L, x2: W - R, y1: y(r.v), y2: y(r.v), stroke: "var(--ink-2)", "stroke-width": 1, "stroke-dasharray": "5 4" });
      var t = mk("text", { x: W - R - 4, y: y(r.v) - 5, "text-anchor": "end" }); t.textContent = r.label;
    });
    // month / year ticks
    var lastLab = -1e9;
    for (var i = 0; i < n; i++) {
      var d = addDays(start, i);
      var yearTick = d.getUTCMonth() === 0 && d.getUTCDate() === 1;
      var monthTick = d.getUTCDate() === 1 && n <= 800;
      if ((yearTick || monthTick) && x(i) - lastLab > 46) {
        var lab = n <= 800 ? d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short" }) + (yearTick || i < 5 ? " " + d.getUTCFullYear() : "") : String(d.getUTCFullYear());
        if (n > 800 && !yearTick) continue;
        var tt = mk("text", { x: x(i), y: H - 10, "text-anchor": "middle" }); tt.textContent = lab; lastLab = x(i);
        mk("line", { x1: x(i), x2: x(i), y1: H - B, y2: H - B + 4, stroke: "var(--axis)" });
      }
    }
    mk("line", { x1: L, x2: W - R, y1: H - B, y2: H - B, stroke: "var(--axis)", "stroke-width": 1 });
    series.forEach(function (s) {
      var d = "", pen = false;
      s.values.forEach(function (v, i) {
        if (v == null || isNaN(v)) { pen = false; return; }
        d += (pen ? "L" : "M") + x(i).toFixed(1) + "," + y(Math.min(v, ymax)).toFixed(1); pen = true;
      });
      var p = mk("path", { d: d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" });
      if (s.dash) p.setAttribute("stroke-dasharray", "6 4");
    });
    var cross = mk("line", { x1: 0, x2: 0, y1: T, y2: H - B, stroke: "var(--ink-2)", "stroke-width": 1, visibility: "hidden" });
    el.appendChild(svg);
    var tip = document.createElement("div"); tip.className = "tip"; el.appendChild(tip);
    function move(ev) {
      var r = svg.getBoundingClientRect();
      var px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      var sx = px * W / r.width;
      var i = Math.round((sx - L) / (W - L - R) * (n - 1));
      if (i < 0 || i >= n) { leave(); return; }
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
      var html = "<b>" + niceDate(isoOf(addDays(start, i))) + "</b>";
      series.forEach(function (s) {
        var v = s.values[i];
        html += '<br><span style="color:' + s.color + '">■</span> ' + esc(s.name) + ": " + (v == null ? "—" : fmt(v, opts.nd || 0) + (opts.unit || ""));
      });
      tip.innerHTML = html; tip.style.display = "block";
      var left = px + 14; if (left + tip.offsetWidth > r.width) left = px - tip.offsetWidth - 14;
      tip.style.left = Math.max(0, left) + "px"; tip.style.top = "8px";
    }
    function leave() { cross.setAttribute("visibility", "hidden"); tip.style.display = "none"; }
    svg.addEventListener("mousemove", move); svg.addEventListener("touchmove", move, { passive: true });
    svg.addEventListener("mouseleave", leave); svg.addEventListener("touchend", leave);
  }

  /* ---------- Maps page ---------- */
  function index() {
    theme();
    if (!D.domains.length) { $("about").innerHTML = "<p>No data built yet.</p>"; return; }
    var cur = D.domains[0], view = "today", range = 365, metric = "mean";
    var hashKey = (location.hash || "").slice(1).toUpperCase();
    D.domains.forEach(function (d) { if (d.key === hashKey) cur = d; });
    $("gen").textContent = "Site built " + D.generated_utc + ".";
    $("tabs").innerHTML = D.domains.map(function (d) {
      return '<button type="button" role="tab" data-k="' + d.key + '">' + esc(d.name) + "</button>";
    }).join("");
    $("tabs").onclick = function (e) {
      var k = e.target.getAttribute("data-k"); if (!k) return;
      D.domains.forEach(function (d) { if (d.key === k) cur = d; });
      history.replaceState(null, "", "#" + k.toLowerCase()); draw();
    };
    $("range").onclick = function (e) { var v = e.target.getAttribute("data-r"); if (v != null) { range = +v; seg("range", "data-r", v); drawZoneChart(); drawStation(); } };
    $("metric").onclick = function (e) { var v = e.target.getAttribute("data-m"); if (v) { metric = v; seg("metric", "data-m", v); drawZoneChart(); } };
    $("date").onchange = function () { drawMap(false); };
    $("stsel").onchange = drawStation;
    ["scale", "mscale"].forEach(function (id) { $(id).innerHTML = KCOL.map(function (c) { return '<div style="background:' + c + '"></div>'; }).join(""); });
    ["scalel", "mscalel"].forEach(function (id) { $(id).innerHTML = ["0", "100", "200", "300", "400", "500", "600", "700"].map(function (v) { return "<span>" + v + "</span>"; }).join(""); });
    $("base").onchange = function () { setBase($("base").value); };
    $("opacity").oninput = function () { if (MAP.ov) MAP.ov.setOpacity(+$("opacity").value); };
    $("rawsOn").onchange = function () { if (!MAP.map) return; if ($("rawsOn").checked) MAP.raws.addTo(MAP.map); else MAP.map.removeLayer(MAP.raws); };
    function seg(id, attr, v) { [].forEach.call($(id).querySelectorAll("button"), function (b) { b.classList.toggle("on", b.getAttribute(attr) === String(v)); }); }

    /* ---- interactive map (Leaflet over Esri basemaps, as in the CA Fire Weather Viewer) ---- */
    var MAP = { map: null, ov: null, base: [], raws: null, info: null, data: null, dataKey: null, frame: null };
    window.KBDIapp._map = MAP;     // for console inspection
    var BASEMAPS = {
      gray: { tiles: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
              labels: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
              native: 16, attr: "Basemap &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors" },
      dark: { tiles: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
              labels: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
              native: 16, attr: "Basemap &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors" },
      topo: { tiles: "https://services.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
              native: 18, attr: "Basemap &copy; Esri, HERE, Garmin, USGS, NGA, EPA, USDA, NPS" },
      imagery: { tiles: "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                 labels: "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
                 native: 18, attr: "Imagery &copy; Esri, Maxar, Earthstar Geographics" }
    };
    var BANDS = ["0–99: deep fuels moist", "100–199: deep fuels moist", "200–299: fuels beginning to dry", "300–399: fuels beginning to dry",
                 "400–499: lower litter and duff burn actively", "500–599: lower litter and duff burn actively",
                 "600–699: severe drought, deep-burning fire", "700–800: severe drought, deep-burning fire"];
    function setBase(key) {
      var b = BASEMAPS[key] || BASEMAPS.gray;
      if (!MAP.map) return;
      MAP.base.forEach(function (l) { MAP.map.removeLayer(l); });
      MAP.base = [L.tileLayer(b.tiles, { maxNativeZoom: b.native, maxZoom: 18, attribution: b.attr }).addTo(MAP.map)];
      if (b.labels) MAP.base.push(L.tileLayer(b.labels, { pane: "kLabels", maxNativeZoom: b.native, maxZoom: 18 }).addTo(MAP.map));
      try { localStorage.setItem("kbdi-base", key); } catch (e) { /* storage off */ }
    }
    function initMap() {
      if (MAP.map || !window.L) return !!MAP.map;
      var m = MAP.map = L.map("lmap", { zoomSnap: 0.25, zoomDelta: 0.5, minZoom: 5, maxZoom: 16 });
      m.createPane("kLabels").style.zIndex = 420;
      m.getPane("kLabels").style.pointerEvents = "none";
      var saved = null; try { saved = localStorage.getItem("kbdi-base"); } catch (e) { /* */ }
      if (!saved && document.documentElement.dataset.theme === "dark") saved = "dark";
      $("base").value = BASEMAPS[saved] ? saved : "gray";
      setBase($("base").value);
      var Info = L.Control.extend({ onAdd: function () { var d = L.DomUtil.create("div", "kinfo"); L.DomEvent.disableClickPropagation(d); return d; } });
      MAP.info = new Info({ position: "bottomleft" }).addTo(m).getContainer();
      L.control.scale({ position: "bottomright", imperial: true, metric: true }).addTo(m);
      MAP.raws = L.layerGroup();
      if ($("rawsOn").checked) MAP.raws.addTo(m);
      m.on("mousemove", function (e) { MAP.info.innerHTML = readout(e.latlng); });
      m.on("mouseout", function () { MAP.info.innerHTML = idleText(); });
      m.on("click", function (e) {
        var v = valueAt(e.latlng);
        if (v == null) return;
        L.popup().setLatLng(e.latlng).setContent("<b>KBDI " + v + "</b><br>" + esc(BANDS[Math.min(7, Math.floor(v / 100))]) +
          "<br>" + fmtLL(e.latlng) + '<br><span class="muted">' + niceDate($("date").value) + "</span>").openOn(m);
      });
      return true;
    }
    function merc(lat) { return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); }
    function fmtLL(ll) { return Math.abs(ll.lat).toFixed(3) + "°" + (ll.lat >= 0 ? "N" : "S") + " " + Math.abs(ll.lng).toFixed(3) + "°" + (ll.lng >= 0 ? "E" : "W"); }
    function valueAt(ll) {
      var f = MAP.frame, d = MAP.data;
      if (!f || !d) return null;
      var col = Math.floor((ll.lng - f.west) / (f.east - f.west) * f.ncol);
      var row = Math.floor((merc(f.north) - merc(ll.lat)) / (merc(f.north) - merc(f.south)) * f.nrow);
      if (col < 0 || col >= f.ncol || row < 0 || row >= f.nrow) return null;
      var i = (row * f.ncol + col) * 4;
      return d.data[i + 3] ? d.data[i] * 256 + d.data[i + 1] : null;
    }
    function idleText() { return "<span class='muted'>Hover the map for KBDI; click for details.</span>"; }
    function readout(ll) {
      var v = valueAt(ll);
      return v == null ? "<span class='muted'>" + fmtLL(ll) + " · no data (sea or outside the grid)</span>"
        : "<b>KBDI " + v + "</b> <span class='muted'>" + fmtLL(ll) + "</span><br><span class='muted'>" + esc(BANDS[Math.min(7, Math.floor(v / 100))]) + "</span>";
    }
    function loadData(url) {
      MAP.data = null; MAP.dataKey = url;
      var im = new Image();
      im.onload = function () {
        if (MAP.dataKey !== url) return;
        var cv = document.createElement("canvas"); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
        var cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(im, 0, 0);
        MAP.data = cx.getImageData(0, 0, cv.width, cv.height);
      };
      im.src = url;
    }
    function drawRaws() {
      if (!MAP.raws) return;
      MAP.raws.clearLayers();
      (cur.raws || []).forEach(function (r) {
        var c = r.fems == null ? "#9a9a9a" : KCOL[Math.min(7, Math.floor(r.fems / 100))];
        var mk = L.circleMarker([r.lat, r.lon], { radius: 6.5, weight: 2, color: "#111", fillColor: c, fillOpacity: 1 });
        mk.bindTooltip("<b>" + esc(r.name) + "</b> (RAWS)<br>FEMS KBDI: " + fmt(r.fems) + "<br>Map cell: " + fmt(r.map) +
          '<br><span class="muted">' + r.fems_days + " days of FEMS KBDI in the record</span>", { direction: "top", offset: [0, -6] });
        mk.on("click", function () {
          var sel = $("stsel");
          if ([].some.call(sel.options, function (o) { return o.value === r.name; })) { sel.value = r.name; drawStation(); }
        });
        mk.addTo(MAP.raws);
      });
    }
    function drawMap(refit) {
      var sel = $("date").value, day = null;
      cur.days.forEach(function (x) { if (x.date === sel) day = x; });
      if (!day) return;
      $("figlink").href = day.fig || "#";
      $("mapcap").textContent = "KBDI on the morning of " + niceDate(sel) + " (rain through 08:00 local), at the grid's own resolution. " +
        "RAWS dots are coloured by FEMS's own KBDI for the station, on the same scale; grey where FEMS has no recent value. Click a RAWS for its history below.";
      if (!initMap()) { $("nomap").style.display = ""; $("lmap").style.display = "none"; return; }
      var f = MAP.frame = cur.overlay;
      if (MAP.ov) MAP.map.removeLayer(MAP.ov);
      MAP.ov = L.imageOverlay(day.map, [[f.south, f.west], [f.north, f.east]], { opacity: +$("opacity").value, className: "kbdi-ov", interactive: false }).addTo(MAP.map);
      loadData(day.data);
      if (refit) { MAP.map.fitBounds(f.fit); drawRaws(); }
      MAP.info.innerHTML = idleText();
      MAP.valueAt = valueAt;
    }

    function drawZoneChart() {
      var s = cur.series;
      if (!s) { $("zchart").innerHTML = '<p class="note">No history.</p>'; return; }
      var rf = cur.red_flag, key = metric === "mean" ? "mean" : "pct_ge_" + rf.kbdi;
      var names = Object.keys(s.zones);
      if (!s.zones[names[0]][key]) { $("zchart").innerHTML = '<p class="note">History for this measure starts with the next daily run.</p>'; $("zlegend").innerHTML = ""; return; }
      var n = s.zones[names[0]][key].length;
      var k0 = range ? Math.max(0, n - range) : 0;
      var ser = names.map(function (z, i) { return { name: z, color: SER[i % SER.length], values: s.zones[z][key].slice(k0) }; });
      var start = isoOf(addDays(s.start, k0));
      if (metric === "mean") {
        var refs = rf.refs.map(function (v) { return { v: v, label: v + ": " + (rf.refs.length > 1 ? (v === 500 ? "NWS Honolulu" : "NWS Guam") + " Red Flag KBDI (reference)" : rf.office + " Red Flag KBDI" + (cur.key === "MP" ? " (Guam's, for reference)" : "")) }; });
        lineChart($("zchart"), start, ser, { ymax: 800, refs: refs, label: "Zone mean KBDI" });
        $("zchartnote").textContent = "Daily mean KBDI over each zone's land cells. Dashed: the Red Flag KBDI value (see the criteria card).";
      } else {
        lineChart($("zchart"), start, ser, { ymax: 100, unit: "%", nd: 1, label: "Share of land at KBDI " + rf.kbdi + " or above" });
        $("zchartnote").textContent = "Share of each zone's land cells at or above KBDI " + rf.kbdi + " (" + rf.office + " Red Flag KBDI value" +
          (cur.key === "GU" || cur.key === "HI" ? "" : ", shown for reference") + ").";
      }
      $("zlegend").innerHTML = ser.map(function (x) { return '<span style="--c:' + x.color + '">' + esc(x.name) + "</span>"; }).join("");
    }

    function drawStation() {
      var s = cur.series, name = $("stsel").value;
      if (!s || !name || !s.stations[name]) { $("schart").innerHTML = '<p class="note">No station history for this domain.</p>'; return; }
      var st = s.stations[name], n = st.grid.length, k0 = range ? Math.max(0, n - range) : 0;
      lineChart($("schart"), isoOf(addDays(s.start, k0)), [
        { name: "Map cell", color: "var(--s1)", values: st.grid.slice(k0) },
        { name: "FEMS " + name, color: "var(--s2)", values: st.fems.slice(k0) }],
        { ymax: 800, label: "Map KBDI vs FEMS station KBDI at " + name });
    }

    function drawRedFlag() {
      var rf = cur.red_flag, h = "<h2>NWS fire-weather criteria</h2>" +
        '<p><b>' + esc(rf.office) + ".</b> " + esc(rf.text) + ' <a href="' + rf.url + '">Source →</a></p>';
      if (cur.hfo_check && cur.hfo_check.length) {
        h += '<p class="note">KBDI today at the stations HFO uses for each island, map cell and FEMS, against 500. This is the KBDI ' +
          "part only: HFO's eligibility also weighs fire-agency input, and a warning needs the wind and humidity criteria too.</p>" +
          "<div class='scroll'><table><tr><th>Island</th><th>HFO KBDI station</th><th class='n'>Map today</th><th class='n'>FEMS today</th><th>Map ≥ 500?</th></tr>" +
          cur.hfo_check.map(function (r) {
            return "<tr><td>" + esc(r.island) + "</td><td>" + esc(r.station) + "</td><td class='n'>" + fmt(r.map) + "</td><td class='n'>" + fmt(r.fems) +
              "</td><td>" + (r.map == null ? "—" : r.map >= 500 ? "<b>Yes</b>" : "No") + "</td></tr>";
          }).join("") + "</table></div>";
      }
      if (rf.tiers) {
        h += "<h3>NWS Guam fire danger rating</h3><div class='scroll'><table><tr><th>Category</th><th>KBDI and wind</th><th>Meaning</th></tr>" +
          rf.tiers.map(function (t) { return "<tr><td><b>" + esc(t[0]) + "</b></td><td>" + esc(t[1]) + "</td><td>" + esc(t[2]) + "</td></tr>"; }).join("") +
          '</table></div><p class="note">' + esc(rf.tiers_source) + ". The rating adds wind to KBDI: above 600, the category depends on wind, which this map does not include.</p>";
      }
      $("rf").innerHTML = h;
    }

    function draw() {
      [].forEach.call($("tabs").querySelectorAll("button"), function (b) { b.classList.toggle("on", b.getAttribute("data-k") === cur.key); });
      $("updated").textContent = cur.title + " · analysis for " + niceDate(cur.date) + " · archive back to " + cur.start;
      $("date").innerHTML = cur.days.map(function (x) { return '<option value="' + x.date + '">' + niceDate(x.date) + "</option>"; }).join("");
      drawMap(true);
      $("pctbtn").textContent = "% of land ≥ " + cur.red_flag.kbdi;
      drawRedFlag();
      var lvl = cur.confidence.split(" ")[0];
      var v = cur.validation || {};
      $("about").innerHTML = "<h2>" + esc(cur.title) + "</h2>" +
        '<p><span class="badge ' + lvl + '">Confidence: ' + esc(cur.confidence) + "</span></p>" +
        '<p class="note">' + esc(cur.confidence_note) + "</p>" +
        '<dl class="inputs">' + cur.inputs.map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("") + "</dl>" +
        '<p class="note">Method: Keetch &amp; Byram (1968) daily water balance, using a method similar to the KBDI product the Texas A&amp;M Forest Service produces daily for the State of Texas. Every grid cell ' +
        "steps forward each day from " + esc(cur.start) + ", with the first year treated as spin-up. " + cur.land_cells.toLocaleString() + " land cells." +
        (v.stations ? " Checked at " + v.stations + " RAWS (" + esc(v.period) + "): median r " + fmt(v.median_map_r, 2) + ", bias " + sgn(v.median_map_bias) + ", MAE " + fmt(v.median_map_mae) + "." : "") +
        '</p><p><a href="methods.html#' + cur.anchor + '">Full method, data and references for this map →</a></p>';
      $("zones").innerHTML = "<tr><th>Zone</th><th class='n'>Land cells</th><th class='n'>Mean</th><th class='n'>Min</th><th class='n'>Max</th><th class='n'>% ≥ 575</th></tr>" +
        cur.zones.map(function (z) {
          return "<tr><td>" + esc(z.zone) + "</td><td class='n'>" + z.cells.toLocaleString() + "</td><td class='n'>" + z.mean + "</td><td class='n'>" + z.min +
            "</td><td class='n'>" + z.max + "</td><td class='n'>" + fmt(z.pct_ge_575, 1) + "</td></tr>";
        }).join("");
      var sts = cur.stations.slice().sort(function (a, b) { return String(a.station).localeCompare(String(b.station)); });
      $("stations").innerHTML = "<tr><th>RAWS</th><th class='n'>FEMS today</th><th class='n'>Map today</th><th class='n'>Days compared</th><th class='n'>r</th><th class='n'>Bias</th><th class='n'>MAE</th><th class='n'>Cell offset (km)</th></tr>" +
        sts.map(function (r) {
          return "<tr><td>" + esc(r.station) + "</td><td class='n'>" + fmt(r.fems_last) + "</td><td class='n'>" + fmt(r.grid_last) + "</td><td class='n'>" + fmt(r.n) +
            "</td><td class='n'>" + fmt(r.r, 2) + "</td><td class='n'>" + sgn(r.bias) + "</td><td class='n'>" + fmt(r.mae) + "</td><td class='n'>" + fmt(r.cell_km, 2) + "</td></tr>";
        }).join("");
      // stations with the longest FEMS record first (many Hawaiʻi RAWS joined FEMS only in late 2026)
      var cnt = {};
      var names = cur.series ? Object.keys(cur.series.stations).filter(function (k) {
        cnt[k] = cur.series.stations[k].fems.filter(function (x) { return x != null; }).length; return cnt[k] > 0;
      }).sort(function (a, b) { return cnt[b] - cnt[a] || a.localeCompare(b); }) : [];
      $("stsel").innerHTML = names.map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + " (" + cnt[k] + " days)</option>"; }).join("");
      drawZoneChart(); drawStation();
    }
    draw();
  }

  /* ---------- Validation page ---------- */
  function validation() {
    theme();
    var el = $("vtables"); if (!el) return;
    el.innerHTML = D.domains.map(function (d) {
      var rows = d.validation_rows || [];
      if (!rows.length) return "";
      rows = rows.slice().sort(function (a, b) { return (b.map_r || 0) - (a.map_r || 0); });
      var v = d.validation || {};
      return '<div class="card"><h2 id="v-' + d.anchor + '">' + esc(d.title) + "</h2>" +
        '<p class="note">' + (v.period ? "Period " + esc(v.period) + ". " : "") + rows.length + " RAWS. Median: r " + fmt(v.median_map_r, 2) + ", bias " + sgn(v.median_map_bias) +
        ", MAE " + fmt(v.median_map_mae) + ", same-or-adjacent 100-unit class " + fmt(100 * (v.median_map_class_within1 || 0)) + "%, hit ≥ 400 " + fmt(100 * (v.median_map_hit400 || 0)) +
        "%, false ≥ 400 " + fmt(100 * (v.median_map_false400 || 0)) + "%.</p>" +
        "<div class='scroll'><table><tr><th>RAWS</th><th class='n'>Days</th><th class='n'>FEMS R (in)</th><th class='n'>Map R (in)</th><th class='n'>FEMS mean</th><th class='n'>r</th><th class='n'>Bias</th><th class='n'>MAE</th><th class='n'>Within 1 class</th><th class='n'>Hit ≥ 400</th><th class='n'>False ≥ 400</th></tr>" +
        rows.map(function (r) {
          return "<tr><td>" + esc(r.station) + "</td><td class='n'>" + fmt(r.n_days) + "</td><td class='n'>" + fmt(r.R_fems_in, 1) + "</td><td class='n'>" + fmt(r.R_mrms_in, 1) +
            "</td><td class='n'>" + fmt(r.fems_mean) + "</td><td class='n'>" + fmt(r.map_r, 2) + "</td><td class='n'>" + sgn(r.map_bias) + "</td><td class='n'>" + fmt(r.map_mae) +
            "</td><td class='n'>" + fmt(100 * r.map_class_within1) + "%</td><td class='n'>" + (r.map_hit400 == null ? "—" : fmt(100 * r.map_hit400) + "%") +
            "</td><td class='n'>" + (r.map_false400 == null ? "—" : fmt(100 * r.map_false400) + "%") + "</td></tr>";
        }).join("") + "</table></div></div>";
    }).join("");
    var f = D.fires_hi || [], fs = D.fires_hi_summary;
    if (f.length && $("ftable")) {
      $("ftable").innerHTML = "<tr><th>Fire set</th><th>Subset</th><th class='n'>n</th><th>Annual-rain normal</th><th class='n'>AUC</th><th class='n'>Median fire-day KBDI</th>" +
        "<th class='n'>POD ≥ 500</th><th class='n'>Land ≥ 500</th><th class='n'>Lift 500</th><th class='n'>POD ≥ 600</th><th class='n'>Land ≥ 600</th></tr>" +
        f.map(function (r) {
          return "<tr><td>" + (r.fires === "firms" ? "VIIRS fire cell-days" : "FOD / InFORM fire starts") + "</td><td>" + esc(r.subset) + "</td><td class='n'>" + fmt(r.n) +
            "</td><td>" + (r.R === "atlas" ? "Rainfall Atlas 1978–2007 (used)" : "HCDP 1991–2020") + "</td><td class='n'>" + fmt(r.AUC, 3) + "</td><td class='n'>" + fmt(r.median_fire_kbdi) +
            "</td><td class='n'>" + fmt(100 * r.POD500) + "%</td><td class='n'>" + fmt(100 * r.alert500) + "%</td><td class='n'>" + fmt(r.lift500, 2) +
            "</td><td class='n'>" + fmt(100 * r.POD600) + "%</td><td class='n'>" + fmt(100 * r.alert600) + "%</td></tr>";
        }).join("");
    }
    if (fs && $("fsum")) {
      var e = fs.equal_alert_pod, a = fs.auc_diff;
      $("fsum").innerHTML = "At the same share of land flagged (" + fmt(100 * fs.equal_alert_share, 1) + "% of land-days: HCDP normal ≥ " + fs.red_flag_kbdi +
        ", Atlas normal ≥ " + fs.atlas_equal_alert_threshold + "), the Atlas normal catches " + fmt(100 * e.firms.atlas, 1) + "% of satellite fire days against " +
        fmt(100 * e.firms.hcdp, 1) + "%, and " + fmt(100 * e.fod.atlas, 1) + "% of reported starts against " + fmt(100 * e.fod.hcdp, 1) + "%. AUC difference (Atlas − HCDP), " +
        "resampling whole fire days or fires 1,000 times: satellite " + sgn(a.firms.mean, 3) + " (95% interval " + sgn(a.firms.lo95, 3) + " to " + sgn(a.firms.hi95, 3) +
        "), reported starts " + sgn(a.fod.mean, 3) + " (" + sgn(a.fod.lo95, 3) + " to " + sgn(a.fod.hi95, 3) + ").";
    }
  }

  window.KBDIapp = { index: index, validation: validation, theme: theme };
})();
