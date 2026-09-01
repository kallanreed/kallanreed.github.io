(function () {
  'use strict';

  /* ====== Constants ====== */
  var SETTINGS_KEY = 'st-settings';
  var LASTGPX_KEY = 'st-last-gpx';
  var MAX_CACHE_CHARS = 4500000; // guard localStorage's ~5MB quota
  var DECIMATE_THRESHOLD = 2000;
  var MIN_POINT_GAP = 1; // minimum index gap enforced between handles

  var DEFAULT_SETTINGS = {
    windowSize: 5,
    maxKn: 20,
    rejectOutliers: true,
    outlierFactor: 3,
    baseLayer: 'osm',
    seamark: true,
    trackWidth: 3,
    scaleMinKn: null, // null = auto (full-track minimum)
    scaleMaxKn: null  // null = auto (full-track maximum)
  };

  /* ====== Helpers ====== */
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ====== State ====== */
  var state = {
    settings: loadSettings(),
    points: null,
    legs: null,
    cumNm: null,
    rawKn: null,
    smoothedAll: null,
    fullTrackLo: 0,
    fullTrackHi: 0,
    iStart: 0,
    iEnd: 0,
    map: null,
    baseLayers: {},
    seamarkLayer: null,
    trackLayerGroup: null,
    markerStart: null,
    markerEnd: null,
    tapMarker: null,
    dragging: null, // 'start' | 'end' | null
    rebuildQueued: false
  };

  /* ====== Settings persistence ====== */
  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return Object.assign({}, DEFAULT_SETTINGS);
      var parsed = JSON.parse(raw);
      return Object.assign({}, DEFAULT_SETTINGS, parsed);
    } catch (e) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    } catch (e) { /* ignore quota errors */ }
  }

  /* ====== Toast ====== */
  var toastTimer = null;
  function showToast(msg) {
    var t = $('#toast');
    t.innerHTML = '';
    var span = document.createElement('span');
    span.textContent = msg;
    var closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', hideToast);
    t.appendChild(span);
    t.appendChild(closeBtn);
    t.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  }
  function hideToast() {
    $('#toast').classList.add('hidden');
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  }

  /* ====== Map setup ====== */
  function initMap() {
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView([37.8, -122.4], 10);

    // Keep attribution out of the bottom-right corner, which is reserved for the speed legend.
    map.attributionControl.setPosition('bottomleft');

    var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });
    var topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '&copy; OpenTopoMap, OpenStreetMap contributors'
    });
    var seamark = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenSeaMap contributors'
    });

    state.baseLayers = { osm: osm, topo: topo };
    state.seamarkLayer = seamark;

    var initialBase = state.baseLayers[state.settings.baseLayer] || osm;
    initialBase.addTo(map);
    if (state.settings.seamark) seamark.addTo(map);

    state.trackLayerGroup = L.layerGroup().addTo(map);

    map.on('click', onMapClick);

    state.map = map;

    setTimeout(function () { map.invalidateSize(); }, 0);
  }

  function applyBaseLayer(name) {
    Object.keys(state.baseLayers).forEach(function (key) {
      var layer = state.baseLayers[key];
      if (state.map.hasLayer(layer)) state.map.removeLayer(layer);
    });
    var layer = state.baseLayers[name] || state.baseLayers.osm;
    layer.addTo(state.map);
  }

  function applySeamark(on) {
    if (!state.seamarkLayer) return;
    if (on && !state.map.hasLayer(state.seamarkLayer)) state.seamarkLayer.addTo(state.map);
    if (!on && state.map.hasLayer(state.seamarkLayer)) state.map.removeLayer(state.seamarkLayer);
  }

  /* ====== GPX loading ====== */
  function loadGpxText(text) {
    var parsed;
    try {
      parsed = window.GPX.parse(text);
    } catch (err) {
      showToast(err.message || 'Could not load this GPX file.');
      return;
    }

    var points = parsed.points;
    var speeds = window.GPX.computeSpeeds(points);

    state.points = points;
    state.legs = speeds.legs;
    state.cumNm = speeds.cumNm;
    state.rawKn = speeds.legs.map(function (l) { return l.rawKn; });
    recomputeSmoothed();

    state.iStart = 0;
    state.iEnd = points.length - 1;

    cacheGpxText(text);

    fitToTrack();
    rebuildStripChart();
    positionHandles();
    scheduleTrackRebuild();
    updateStats();
    hideReadout();
    hideToast();
  }

  function cacheGpxText(text) {
    try {
      if (text.length > MAX_CACHE_CHARS) {
        localStorage.removeItem(LASTGPX_KEY);
        return;
      }
      localStorage.setItem(LASTGPX_KEY, text);
    } catch (e) { /* quota exceeded — skip caching silently */ }
  }

  function restoreCachedGpx() {
    try {
      var text = localStorage.getItem(LASTGPX_KEY);
      if (text) loadGpxText(text);
    } catch (e) { /* ignore */ }
  }

  function recomputeSmoothed() {
    state.smoothedAll = window.GPX.smooth(state.rawKn, {
      rejectOutliers: state.settings.rejectOutliers,
      outlierFactor: state.settings.outlierFactor,
      windowSize: state.settings.windowSize,
      maxKn: state.settings.maxKn
    });
    // Recompute full-track speed range for the fixed color scale
    var lo = Infinity, hi = -Infinity;
    for (var k = 0; k < state.smoothedAll.length; k++) {
      var v = state.smoothedAll[k];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    state.fullTrackLo = lo === Infinity ? 0 : lo;
    state.fullTrackHi = hi === -Infinity ? 0 : hi;
  }

  function fitToTrack() {
    if (!state.points || !state.points.length) return;
    var latlngs = state.points.map(function (p) { return [p.lat, p.lon]; });
    var bounds = L.latLngBounds(latlngs);
    state.map.fitBounds(bounds, { padding: [20, 20] });
  }

  /* ====== File input / drag & drop ====== */
  $('#open-btn').addEventListener('click', function () {
    $('#file-input').click();
  });

  $('#file-input').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) { loadGpxText(ev.target.result); };
    reader.onerror = function () { showToast('Could not read the selected file.'); };
    reader.readAsText(file);
  });

  ['dragover', 'dragenter'].forEach(function (evtName) {
    document.addEventListener(evtName, function (e) {
      e.preventDefault();
    });
  });
  document.addEventListener('drop', function (e) {
    e.preventDefault();
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) { loadGpxText(ev.target.result); };
    reader.onerror = function () { showToast('Could not read the dropped file.'); };
    reader.readAsText(file);
  });

  /* ====== Color scale for the current selection ====== */
  function colorScaleRange() {
    var s = state.settings;
    var lo = (s.scaleMinKn !== null && s.scaleMinKn !== undefined) ? s.scaleMinKn : state.fullTrackLo;
    var hi = (s.scaleMaxKn !== null && s.scaleMaxKn !== undefined) ? s.scaleMaxKn : state.fullTrackHi;
    if (hi <= lo) hi = lo + 1;
    return { lo: lo, hi: hi };
  }

  /* ====== Track rendering ====== */
  function scheduleTrackRebuild() {
    if (state.rebuildQueued) return;
    state.rebuildQueued = true;
    requestAnimationFrame(function () {
      state.rebuildQueued = false;
      renderTrack();
    });
  }

  function renderTrack() {
    state.trackLayerGroup.clearLayers();
    if (!state.points || state.iEnd <= state.iStart) return;

    var range = colorScaleRange();
    var lo = range.lo, hi = range.hi;

    var legCount = state.iEnd - state.iStart;
    var stride = legCount > DECIMATE_THRESHOLD ? Math.ceil(legCount / DECIMATE_THRESHOLD) : 1;

    var width = state.settings.trackWidth;

    for (var k = state.iStart; k < state.iEnd; k += stride) {
      var kEnd = Math.min(k + stride, state.iEnd);
      var a = state.points[k];
      var b = state.points[kEnd];
      var speed = state.smoothedAll[k]; // representative speed for this drawn segment
      var color = window.GPX.speedToColor(speed, lo, hi);
      L.polyline([[a.lat, a.lon], [b.lat, b.lon]], {
        color: color,
        weight: width,
        opacity: 0.95,
        lineCap: 'round'
      }).addTo(state.trackLayerGroup);
    }

    var startP = state.points[state.iStart];
    var endP = state.points[state.iEnd];
    if (state.markerStart) state.trackLayerGroup.removeLayer(state.markerStart);
    if (state.markerEnd) state.trackLayerGroup.removeLayer(state.markerEnd);
    state.markerStart = L.circleMarker([startP.lat, startP.lon], {
      radius: 6, color: '#fff', weight: 2, fillColor: '#4caf50', fillOpacity: 1
    }).addTo(state.trackLayerGroup);
    state.markerEnd = L.circleMarker([endP.lat, endP.lon], {
      radius: 6, color: '#fff', weight: 2, fillColor: '#e94560', fillOpacity: 1
    }).addTo(state.trackLayerGroup);

    updateLegend(lo, hi);
  }

  function updateLegend(lo, hi) {
    var legend = $('#legend');
    legend.classList.remove('hidden');
    $('#legend-hi').textContent = hi.toFixed(1);
    $('#legend-lo').textContent = lo.toFixed(1);
  }

  /* ====== Stats ====== */
  function updateStats() {
    if (!state.points) return;
    var summary = window.GPX.summarize(state.points, state.cumNm, state.smoothedAll, state.iStart, state.iEnd);
    $('#stat-dist').textContent = summary.distNm.toFixed(2);
    $('#stat-dur').textContent = formatDuration(summary.durationSec);
    $('#stat-sog').textContent = summary.sogKn.toFixed(1);
    $('#stat-cmg').textContent = formatCourse(summary.cmgDeg);
    $('#stat-max').textContent = summary.maxKn.toFixed(1);
  }

  function formatDuration(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
  }

  function formatCourse(deg) {
    if (deg == null) return '—';
    return Math.round(deg) + '°';
  }

  /* ====== Strip chart + double-ended slider ====== */
  var stripCanvas = $('#strip-canvas');
  var stripCtx = stripCanvas.getContext('2d');
  var rangeWrap = $('#range-wrap');
  var HANDLE_INSET = 22; // px, matches CSS padding on .range / #range-track inset

  function stripInnerWidth(cssWidth) {
    return Math.max(1, cssWidth - HANDLE_INSET * 2);
  }

  function resizeStripCanvas() {
    var rect = rangeWrap.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    stripCanvas.width = Math.max(1, Math.round(rect.width * dpr));
    stripCanvas.height = Math.max(1, Math.round(rect.height * dpr));
    stripCanvas.style.width = rect.width + 'px';
    stripCanvas.style.height = rect.height + 'px';
    stripCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function indexToX(idx, cssWidth) {
    var n = state.points ? state.points.length - 1 : 1;
    if (n <= 0) n = 1;
    var innerW = stripInnerWidth(cssWidth);
    return HANDLE_INSET + (idx / n) * innerW;
  }

  function xToIndex(clientX) {
    var rect = rangeWrap.getBoundingClientRect();
    var x = clamp(clientX - rect.left, HANDLE_INSET, rect.width - HANDLE_INSET);
    var innerW = stripInnerWidth(rect.width);
    var n = state.points ? state.points.length - 1 : 1;
    var frac = (x - HANDLE_INSET) / innerW;
    return Math.round(clamp(frac, 0, 1) * n);
  }

  function rebuildStripChart() {
    resizeStripCanvas();
    drawStripChart();
  }

  function drawStripChart() {
    var rect = rangeWrap.getBoundingClientRect();
    var w = rect.width, h = rect.height;
    stripCtx.clearRect(0, 0, w, h);

    if (!state.smoothedAll || !state.smoothedAll.length) return;

    var maxV = 0;
    for (var i = 0; i < state.smoothedAll.length; i++) {
      if (state.smoothedAll[i] > maxV) maxV = state.smoothedAll[i];
    }
    if (maxV <= 0) maxV = 1;

    var pad = 6;
    function yFor(v) {
      var t = v / maxV;
      return h - pad - t * (h - pad * 2);
    }

    // Whole-track profile, dim gray
    stripCtx.beginPath();
    stripCtx.strokeStyle = 'rgba(240,240,240,0.25)';
    stripCtx.lineWidth = 1.5;
    for (var k = 0; k < state.smoothedAll.length; k++) {
      var x = indexToX(k, w);
      var y = yFor(state.smoothedAll[k]);
      if (k === 0) stripCtx.moveTo(x, y); else stripCtx.lineTo(x, y);
    }
    stripCtx.stroke();

    // Selected span, gradient colors
    var range = colorScaleRange();
    var lo = range.lo, hi = range.hi;
    for (var m = state.iStart; m < state.iEnd; m++) {
      var x1 = indexToX(m, w);
      var x2 = indexToX(m + 1, w);
      var y1 = yFor(state.smoothedAll[m]);
      var y2 = m + 1 < state.smoothedAll.length ? yFor(state.smoothedAll[m + 1]) : y1;
      stripCtx.beginPath();
      stripCtx.strokeStyle = window.GPX.speedToColor(state.smoothedAll[m], lo, hi);
      stripCtx.lineWidth = 2;
      stripCtx.moveTo(x1, y1);
      stripCtx.lineTo(x2, y2);
      stripCtx.stroke();
    }
  }

  function positionHandles() {
    var rect = rangeWrap.getBoundingClientRect();
    var xStart = indexToX(state.iStart, rect.width);
    var xEnd = indexToX(state.iEnd, rect.width);
    $('#handle-start').style.left = xStart + 'px';
    $('#handle-end').style.left = xEnd + 'px';
  }

  function setupHandleDrag(handleEl, which) {
    handleEl.addEventListener('pointerdown', function (e) {
      handleEl.setPointerCapture(e.pointerId);
      state.dragging = which;
    });
    handleEl.addEventListener('pointermove', function (e) {
      if (state.dragging !== which) return;
      var idx = xToIndex(e.clientX);
      if (which === 'start') {
        state.iStart = clamp(idx, 0, state.iEnd - MIN_POINT_GAP);
      } else {
        state.iEnd = clamp(idx, state.iStart + MIN_POINT_GAP, state.points.length - 1);
      }
      positionHandles();
      drawStripChart();
      scheduleTrackRebuild();
      updateStats();
    });
    var endDrag = function (e) {
      if (state.dragging !== which) return;
      state.dragging = null;
      try { handleEl.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    };
    handleEl.addEventListener('pointerup', endDrag);
    handleEl.addEventListener('pointercancel', endDrag);

    // Double-tap to nudge one point at a time
    var lastTap = 0;
    handleEl.addEventListener('click', function () {
      var now = Date.now();
      if (now - lastTap < 350) {
        // handled via keyboard/dblclick fallback below; no-op for pointer double tap here
      }
      lastTap = now;
    });
  }
  setupHandleDrag($('#handle-start'), 'start');
  setupHandleDrag($('#handle-end'), 'end');

  var resizeObserver = new ResizeObserver(function () {
    rebuildStripChart();
    positionHandles();
  });
  resizeObserver.observe(rangeWrap);

  /* ====== Tap-a-point readout ====== */
  function onMapClick(e) {
    if (!state.points || !state.points.length) return;
    var clickLatLng = e.latlng;
    var best = -1, bestDist = Infinity;
    for (var i = state.iStart; i <= state.iEnd; i++) {
      var p = state.points[i];
      var dLat = p.lat - clickLatLng.lat;
      var dLon = p.lon - clickLatLng.lng;
      var d2 = dLat * dLat + dLon * dLon;
      if (d2 < bestDist) { bestDist = d2; best = i; }
    }
    if (best < 0) return;

    // Dismiss if click is far from the track (empty water)
    var threshold = 0.02; // degrees^2, roughly generous for tap tolerance
    if (bestDist > threshold) { hideReadout(); return; }

    showReadout(best);
  }

  function showReadout(idx) {
    var p = state.points[idx];
    var startT = state.points[state.iStart].t;
    var elapsedSec = (p.t - startT) / 1000;
    var cumFromStart = state.cumNm[idx] - state.cumNm[state.iStart];
    var speedKn = 0;
    if (idx > 0 && idx - 1 < state.smoothedAll.length) speedKn = state.smoothedAll[idx - 1];

    var chip = $('#readout-chip');
    chip.innerHTML =
      '<div>Time: <b>' + formatDuration(Math.max(0, elapsedSec)) + '</b></div>' +
      '<div>Speed: <b>' + speedKn.toFixed(1) + ' kn</b></div>' +
      '<div>Dist: <b>' + cumFromStart.toFixed(2) + ' Nm</b></div>';
    chip.classList.remove('hidden');

    if (state.tapMarker) state.map.removeLayer(state.tapMarker);
    state.tapMarker = L.circleMarker([p.lat, p.lon], {
      radius: 7, color: '#fff', weight: 2, fillColor: '#ffd93d', fillOpacity: 1
    }).addTo(state.map);
  }

  function hideReadout() {
    $('#readout-chip').classList.add('hidden');
    if (state.tapMarker) { state.map.removeLayer(state.tapMarker); state.tapMarker = null; }
  }

  /* ====== Settings sheet ====== */
  function openSheet() {
    $('#settings-sheet').classList.add('open');
    $('#sheet-scrim').classList.remove('hidden');
  }
  function closeSheet() {
    $('#settings-sheet').classList.remove('open');
    $('#sheet-scrim').classList.add('hidden');
  }
  $('#settings-btn').addEventListener('click', openSheet);
  $('#settings-close-btn').addEventListener('click', closeSheet);
  $('#sheet-scrim').addEventListener('click', closeSheet);

  function syncSettingsUI() {
    var s = state.settings;
    $('#opt-window').value = s.windowSize;
    $('#lbl-window').textContent = s.windowSize;
    $('#opt-maxkn').value = s.maxKn;
    $('#lbl-maxkn').textContent = s.maxKn;
    $('#opt-outlier').checked = s.rejectOutliers;
    $('#opt-outlier-factor').value = s.outlierFactor;
    $('#lbl-outlier-factor').textContent = s.outlierFactor;
    $('#opt-baselayer').value = s.baseLayer;
    $('#opt-seamark').checked = s.seamark;
    $('#opt-trackwidth').value = s.trackWidth;
    $('#lbl-trackwidth').textContent = s.trackWidth;
    $('#opt-scale-min').value = s.scaleMinKn !== null && s.scaleMinKn !== undefined ? s.scaleMinKn : '';
    $('#opt-scale-max').value = s.scaleMaxKn !== null && s.scaleMaxKn !== undefined ? s.scaleMaxKn : '';
  }

  function onSettingChange() {
    var s = state.settings;
    s.windowSize = parseInt($('#opt-window').value, 10);
    if (s.windowSize % 2 === 0) s.windowSize += 1; // enforce odd
    s.maxKn = parseInt($('#opt-maxkn').value, 10);
    s.rejectOutliers = $('#opt-outlier').checked;
    s.outlierFactor = parseFloat($('#opt-outlier-factor').value);
    s.baseLayer = $('#opt-baselayer').value;
    s.seamark = $('#opt-seamark').checked;
    s.trackWidth = parseInt($('#opt-trackwidth').value, 10);
    var minVal = $('#opt-scale-min').value.trim();
    var maxVal = $('#opt-scale-max').value.trim();
    var parsedMin = minVal === '' ? NaN : parseFloat(minVal);
    var parsedMax = maxVal === '' ? NaN : parseFloat(maxVal);
    s.scaleMinKn = (!isNaN(parsedMin) && isFinite(parsedMin)) ? parsedMin : null;
    s.scaleMaxKn = (!isNaN(parsedMax) && isFinite(parsedMax)) ? parsedMax : null;

    $('#lbl-window').textContent = s.windowSize;
    $('#lbl-maxkn').textContent = s.maxKn;
    $('#lbl-outlier-factor').textContent = s.outlierFactor;
    $('#lbl-trackwidth').textContent = s.trackWidth;

    saveSettings();
    applyBaseLayer(s.baseLayer);
    applySeamark(s.seamark);

    if (state.points) {
      recomputeSmoothed();
      drawStripChart();
      scheduleTrackRebuild();
      updateStats();
    }
  }

  ['opt-window', 'opt-maxkn', 'opt-outlier', 'opt-outlier-factor', 'opt-baselayer', 'opt-seamark', 'opt-trackwidth', 'opt-scale-min', 'opt-scale-max']
    .forEach(function (id) {
      $('#' + id).addEventListener('input', onSettingChange);
      $('#' + id).addEventListener('change', onSettingChange);
    });

  $('#reset-defaults-btn').addEventListener('click', function () {
    state.settings = Object.assign({}, DEFAULT_SETTINGS);
    saveSettings();
    syncSettingsUI();
    applyBaseLayer(state.settings.baseLayer);
    applySeamark(state.settings.seamark);
    if (state.points) {
      recomputeSmoothed();
      drawStripChart();
      scheduleTrackRebuild();
      updateStats();
    }
  });

  /* ====== Init ====== */
  initMap();
  syncSettingsUI();
  resizeStripCanvas();
  restoreCachedGpx();

})();
