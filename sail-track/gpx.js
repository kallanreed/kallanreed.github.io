(function (global) {
  'use strict';

  var EARTH_RADIUS_NM = 3440.065;
  var MIN_CMG_DISTANCE_NM = 0.001;

  /* ====== parse ====== */
  function parse(xmlString) {
    var doc = new DOMParser().parseFromString(xmlString, 'application/xml');
    var perr = doc.querySelector('parsererror');
    if (perr) {
      throw new Error('Could not parse file as XML/GPX.');
    }

    var name = '';
    var nameEl = doc.querySelector('trk > name, metadata > name');
    if (nameEl) name = nameEl.textContent.trim();

    var rawPoints = Array.prototype.slice.call(doc.querySelectorAll('trkpt'));
    if (!rawPoints.length) {
      rawPoints = Array.prototype.slice.call(doc.querySelectorAll('rtept'));
    }
    if (!rawPoints.length) {
      rawPoints = Array.prototype.slice.call(doc.querySelectorAll('wpt'));
    }

    if (!rawPoints.length) {
      throw new Error('No track points (<trkpt>/<rtept>/<wpt>) found in this GPX file.');
    }

    var points = [];
    var sawTimeTag = false;
    for (var i = 0; i < rawPoints.length; i++) {
      var node = rawPoints[i];
      var lat = parseFloat(node.getAttribute('lat'));
      var lon = parseFloat(node.getAttribute('lon'));
      var timeEl = node.querySelector('time');
      var t = NaN;
      if (timeEl) {
        sawTimeTag = true;
        t = Date.parse(timeEl.textContent.trim());
      }
      var eleEl = node.querySelector('ele');
      var ele = eleEl ? parseFloat(eleEl.textContent.trim()) : null;

      if (isNaN(lat) || isNaN(lon)) continue;

      points.push({ lat: lat, lon: lon, ele: ele, t: t });
    }

    if (!sawTimeTag) {
      throw new Error('This GPX file has no <time> elements — speed cannot be computed without timestamps.');
    }

    // Drop points with NaN time or non-increasing time vs. previous kept point.
    var cleaned = [];
    var lastT = -Infinity;
    for (var j = 0; j < points.length; j++) {
      var p = points[j];
      if (isNaN(p.t)) continue;
      if (p.t <= lastT) continue;
      cleaned.push(p);
      lastT = p.t;
    }

    if (cleaned.length < 2) {
      throw new Error('Track has fewer than 2 usable points after cleaning.');
    }

    return { name: name, points: cleaned };
  }

  /* ====== haversineNm ====== */
  function haversineNm(a, b) {
    var lat1 = a.lat * Math.PI / 180;
    var lat2 = b.lat * Math.PI / 180;
    var dLat = (b.lat - a.lat) * Math.PI / 180;
    var dLon = (b.lon - a.lon) * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return EARTH_RADIUS_NM * c;
  }

  function bearingDeg(a, b) {
    var lat1 = a.lat * Math.PI / 180;
    var lat2 = b.lat * Math.PI / 180;
    var dLon = (b.lon - a.lon) * Math.PI / 180;
    var y = Math.sin(dLon) * Math.cos(lat2);
    var x = Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    var deg = Math.atan2(y, x) * 180 / Math.PI;
    return (deg + 360) % 360;
  }

  /* ====== computeSpeeds ====== */
  function computeSpeeds(points) {
    var legs = [];
    var cumNm = new Array(points.length);
    cumNm[0] = 0;
    for (var i = 1; i < points.length; i++) {
      var a = points[i - 1];
      var b = points[i];
      var distNm = haversineNm(a, b);
      var dtSec = (b.t - a.t) / 1000;
      cumNm[i] = cumNm[i - 1] + distNm;
      if (dtSec <= 0) continue; // skip degenerate leg, do not emit Infinity
      var rawKn = distNm / (dtSec / 3600);
      legs.push({ i: i, distNm: distNm, dtSec: dtSec, rawKn: rawKn });
    }
    return { legs: legs, cumNm: cumNm };
  }

  /* ====== smooth ====== */
  function median(arr) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  function smooth(rawKnArray, opts) {
    opts = opts || {};
    var rejectOutliers = opts.rejectOutliers !== false;
    var outlierFactor = opts.outlierFactor || 3;
    var windowSize = opts.windowSize || 5;
    var maxKn = opts.maxKn != null ? opts.maxKn : 20;

    var n = rawKnArray.length;
    var work = rawKnArray.slice();

    // 1. Outlier rejection
    if (rejectOutliers && n > 0) {
      var med = median(work);
      var threshold = med * outlierFactor;
      var rejected = work.slice();
      for (var i = 0; i < n; i++) {
        if (threshold > 0 && work[i] > threshold) {
          // replace with local median (small window around i)
          var lo = Math.max(0, i - 2);
          var hi = Math.min(n - 1, i + 2);
          var local = [];
          for (var k = lo; k <= hi; k++) {
            if (k !== i) local.push(work[k]);
          }
          rejected[i] = local.length ? median(local) : med;
        }
      }
      work = rejected;
    }

    // 2. Centered moving average, clamped at ends
    var w = Math.max(1, windowSize | 0);
    var smoothed;
    if (w <= 1) {
      smoothed = work.slice();
    } else {
      smoothed = new Array(n);
      var half = Math.floor(w / 2);
      for (var idx = 0; idx < n; idx++) {
        var from = Math.max(0, idx - half);
        var to = Math.min(n - 1, idx + half);
        var sum = 0, cnt = 0;
        for (var m = from; m <= to; m++) { sum += work[m]; cnt++; }
        smoothed[idx] = cnt ? sum / cnt : work[idx];
      }
    }

    // Max-speed clamp, applied after smoothing
    var out = new Array(n);
    for (var z = 0; z < n; z++) {
      out[z] = Math.min(smoothed[z], maxKn);
    }
    return out;
  }

  /* ====== summarize ====== */
  function summarize(points, cumNm, speedsKn, iStart, iEnd) {
    var startPoint = points[iStart];
    var endPoint = points[iEnd];
    var distNm = cumNm[iEnd] - cumNm[iStart];
    var durationSec = (endPoint.t - startPoint.t) / 1000;
    // Selected-range SOG is reported as average speed over the covered track distance.
    var sogKn = durationSec > 0 ? distNm / (durationSec / 3600) : 0;
    var madeGoodNm = haversineNm(startPoint, endPoint);
    var cmgDeg = madeGoodNm >= MIN_CMG_DISTANCE_NM ? bearingDeg(startPoint, endPoint) : null;

    // speedsKn is indexed per-leg (legs run from point i-1 -> i, stored at index i-1
    // relative to the *filtered* legs array — but for summarize we expect an array
    // aligned with points 1..n-1, i.e. speedsKn[k] corresponds to the leg ending at
    // point k+1). We take the max over legs whose ending point index is within
    // (iStart, iEnd].
    var maxKn = 0;
    var any = false;
    for (var k = 0; k < speedsKn.length; k++) {
      var endPointIndex = k + 1;
      if (endPointIndex > iStart && endPointIndex <= iEnd) {
        any = true;
        if (speedsKn[k] > maxKn) maxKn = speedsKn[k];
      }
    }
    if (!any) maxKn = 0;

    return {
      distNm: distNm,
      durationSec: durationSec,
      sogKn: sogKn,
      cmgDeg: cmgDeg,
      maxKn: maxKn
    };
  }

  /* ====== speedToColor ====== */
  var COLOR_STOPS = [
    { t: 0, rgb: [233, 69, 96] },    // red   #e94560
    { t: 0.33, rgb: [255, 140, 0] }, // orange #ff8c00
    { t: 0.66, rgb: [255, 217, 61] },// yellow #ffd93d
    { t: 1, rgb: [78, 205, 196] }    // green #4ecdc4
  ];

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function speedToColor(kn, lo, hi) {
    var t;
    if (hi - lo < 0.1) {
      t = 0.5;
    } else {
      t = clamp01((kn - lo) / (hi - lo));
    }
    // find bracketing pair
    var a = COLOR_STOPS[0], b = COLOR_STOPS[COLOR_STOPS.length - 1];
    for (var i = 0; i < COLOR_STOPS.length - 1; i++) {
      if (t >= COLOR_STOPS[i].t && t <= COLOR_STOPS[i + 1].t) {
        a = COLOR_STOPS[i];
        b = COLOR_STOPS[i + 1];
        break;
      }
    }
    var span = b.t - a.t;
    var localT = span > 0 ? (t - a.t) / span : 0;
    var r = Math.round(a.rgb[0] + localT * (b.rgb[0] - a.rgb[0]));
    var g = Math.round(a.rgb[1] + localT * (b.rgb[1] - a.rgb[1]));
    var bl = Math.round(a.rgb[2] + localT * (b.rgb[2] - a.rgb[2]));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  global.GPX = {
    parse: parse,
    haversineNm: haversineNm,
    bearingDeg: bearingDeg,
    computeSpeeds: computeSpeeds,
    smooth: smooth,
    summarize: summarize,
    speedToColor: speedToColor
  };

})(typeof window !== 'undefined' ? window : this);
