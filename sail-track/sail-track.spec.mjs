import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = 'http://localhost:3847/sail-track/';
const SAMPLE_GPX = path.join(__dirname, 'test', 'sample.gpx');

test.use({
  channel: 'msedge',
  viewport: { width: 1024, height: 768 },
});

test.beforeEach(async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test.describe('GPX math (window.GPX)', () => {

  test('haversineNm: 1 arc-minute of latitude is ~1.00 Nm', async ({ page }) => {
    const nm = await page.evaluate(() => {
      const a = { lat: 45.0, lon: -70.0 };
      const b = { lat: 45.0 + 1 / 60, lon: -70.0 }; // 1 arc-minute north
      return window.GPX.haversineNm(a, b);
    });
    expect(nm).toBeGreaterThan(0.99);
    expect(nm).toBeLessThan(1.01);
  });

  test('computeSpeeds: constant-speed synthetic track reports the known speed', async ({ page }) => {
    const result = await page.evaluate(() => {
      // 10 points, 30s apart, each leg covering exactly 0.05 nm => 6.0 kn
      const R = 3440.065;
      const lat = 45.0;
      const speedKn = 6.0;
      const stepSec = 30;
      const distPerLeg = speedKn * stepSec / 3600;
      const deltaLonDeg = (distPerLeg / (R * Math.cos(lat * Math.PI / 180))) * 180 / Math.PI;
      const points = [];
      const t0 = Date.UTC(2026, 5, 1, 12, 0, 0);
      for (let i = 0; i < 10; i++) {
        points.push({ lat, lon: -70 + i * deltaLonDeg, ele: 0, t: t0 + i * stepSec * 1000 });
      }
      const { legs, cumNm } = window.GPX.computeSpeeds(points);
      return {
        legCount: legs.length,
        speeds: legs.map(l => l.rawKn),
        totalDist: cumNm[cumNm.length - 1]
      };
    });
    expect(result.legCount).toBe(9);
    for (const kn of result.speeds) {
      expect(kn).toBeGreaterThan(5.95);
      expect(kn).toBeLessThan(6.05);
    }
    expect(result.totalDist).toBeGreaterThan(0.44);
    expect(result.totalDist).toBeLessThan(0.46);
  });

  test('smooth: removes an injected 60 kn spike; window=1 is a no-op', async ({ page }) => {
    const result = await page.evaluate(() => {
      const raw = [6, 6, 6, 60, 6, 6, 6];
      const smoothedWindow1 = window.GPX.smooth(raw, { windowSize: 1, rejectOutliers: false, maxKn: 100 });
      const smoothedDefault = window.GPX.smooth(raw, { windowSize: 5, rejectOutliers: true, outlierFactor: 3, maxKn: 100 });
      return { smoothedWindow1, smoothedDefault };
    });
    // window=1, no outlier rejection => passthrough
    expect(result.smoothedWindow1).toEqual([6, 6, 6, 60, 6, 6, 6]);
    // default settings should knock the spike down well below 60
    expect(Math.max(...result.smoothedDefault)).toBeLessThan(15);
  });

  test('summarize: avg = distance/time, and a range subset yields expected subtotals', async ({ page }) => {
    const result = await page.evaluate(() => {
      const R = 3440.065;
      const lat = 45.0;
      const speedKn = 6.0;
      const stepSec = 30;
      const distPerLeg = speedKn * stepSec / 3600;
      const deltaLonDeg = (distPerLeg / (R * Math.cos(lat * Math.PI / 180))) * 180 / Math.PI;
      const points = [];
      const t0 = Date.UTC(2026, 5, 1, 12, 0, 0);
      for (let i = 0; i < 21; i++) {
        points.push({ lat, lon: -70 + i * deltaLonDeg, ele: 0, t: t0 + i * stepSec * 1000 });
      }
      const { legs, cumNm } = window.GPX.computeSpeeds(points);
      const rawKn = legs.map(l => l.rawKn);
      const smoothed = window.GPX.smooth(rawKn, { windowSize: 1, rejectOutliers: false, maxKn: 100 });
      const full = window.GPX.summarize(points, cumNm, smoothed, 0, 20);
      const half = window.GPX.summarize(points, cumNm, smoothed, 0, 10);
      return { full, half };
    });
    expect(result.full.distNm).toBeCloseTo(1.0, 1);
    expect(result.full.durationSec).toBe(600);
    expect(result.full.sogKn).toBeCloseTo(6.0, 1);
    expect(result.full.cmgDeg).toBeCloseTo(90, 0);
    expect(result.half.distNm).toBeCloseTo(0.5, 1);
    expect(result.half.durationSec).toBe(300);
    expect(result.half.sogKn).toBeCloseTo(6.0, 1);
    expect(result.half.cmgDeg).toBeCloseTo(90, 0);
  });

  test('summarize: CMG is blank for a closed loop even when SOG is non-zero', async ({ page }) => {
    const result = await page.evaluate(() => {
      const points = [
        { lat: 45.0, lon: -70.0, ele: 0, t: Date.UTC(2026, 5, 1, 12, 0, 0) },
        { lat: 45.0, lon: -69.99, ele: 0, t: Date.UTC(2026, 5, 1, 12, 1, 0) },
        { lat: 45.0, lon: -70.0, ele: 0, t: Date.UTC(2026, 5, 1, 12, 2, 0) }
      ];
      const { legs, cumNm } = window.GPX.computeSpeeds(points);
      const smoothed = window.GPX.smooth(legs.map(l => l.rawKn), { windowSize: 1, rejectOutliers: false, maxKn: 100 });
      return window.GPX.summarize(points, cumNm, smoothed, 0, 2);
    });
    expect(result.sogKn).toBeGreaterThan(0);
    expect(result.cmgDeg).toBeNull();
  });

  test('speedToColor: red at lo, green at hi, orange-ish mid-scale', async ({ page }) => {
    const result = await page.evaluate(() => {
      return {
        atLo: window.GPX.speedToColor(0, 0, 10),
        atHi: window.GPX.speedToColor(10, 0, 10),
        atMid: window.GPX.speedToColor(3.3, 0, 10) // ~t=0.33 -> orange
      };
    });
    expect(result.atLo).toBe('rgb(233,69,96)');
    expect(result.atHi).toBe('rgb(78,205,196)');
    // orange-ish: high red, moderate green, low blue
    const m = result.atMid.match(/rgb\((\d+),(\d+),(\d+)\)/);
    const [r, g, b] = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
    expect(r).toBeGreaterThan(200);
    expect(b).toBeLessThan(100);
  });
});

test.describe('UI', () => {

  test('loads with empty stats and PWA meta present', async ({ page }) => {
    await expect(page.locator('.hdr h1')).toContainText('Sail Track');
    const capable = await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content');
    expect(capable).toBe('yes');
    const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifest).toBe('manifest.json');
  });

  test('loading sample GPX populates the stats bar', async ({ page }) => {
    await page.setInputFiles('#file-input', SAMPLE_GPX);
    await expect(page.locator('#stat-dist')).toHaveText('1.00', { timeout: 10000 });
    await expect(page.locator('#stat-sog')).toContainText('6.0');
    await expect(page.locator('#stat-cmg')).toHaveText('90°');
  });

  test('dragging the right handle to the midpoint reduces the reported distance', async ({ page }) => {
    await page.setInputFiles('#file-input', SAMPLE_GPX);
    await expect(page.locator('#stat-dist')).toHaveText('1.00', { timeout: 10000 });

    const endHandle = page.locator('#handle-end');
    const startHandle = page.locator('#handle-start');
    const endBox = await endHandle.boundingBox();
    const startBox = await startHandle.boundingBox();

    const targetX = (startBox.x + endBox.x) / 2 + startBox.width / 2;
    const targetY = endBox.y + endBox.height / 2;

    await endHandle.hover();
    await page.mouse.down();
    await page.mouse.move(targetX, targetY, { steps: 10 });
    await page.mouse.up();

    const distText = await page.locator('#stat-dist').textContent();
    const dist = parseFloat(distText);
    expect(dist).toBeLessThan(1.0);
    await expect(page.locator('#stat-sog')).toContainText('6.0');
    await expect(page.locator('#stat-cmg')).toHaveText('90°');
  });
});
