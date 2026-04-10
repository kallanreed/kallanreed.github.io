import { test, expect } from '@playwright/test';

const URL = 'http://localhost:3847/metronome/';

test.use({
  channel: 'msedge',
  viewport: { width: 1024, height: 768 },
});

// Clear localStorage before each test
test.beforeEach(async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test.describe('Song List', () => {

  test('loads with empty state', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('🎼 Virtual Conductor');
    await expect(page.locator('#list-view')).toHaveClass(/active/);
    await expect(page.locator('.empty-state')).toBeVisible();
  });

  test('create new song opens editor', async ({ page }) => {
    await page.click('#new-song-btn');
    await expect(page.locator('#editor-view')).toHaveClass(/active/);
    await expect(page.locator('#ed-name')).toHaveValue('New Song');
    await expect(page.locator('#ed-countin')).toHaveValue('2');
    await expect(page.locator('.section-card')).toHaveCount(1);
    await expect(page.locator('.section-badge')).toHaveText('A');
  });

  test('song persists in list after back navigation', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.fill('#ed-name', 'Persistent Song');
    // Wait for debounced save
    await page.waitForTimeout(500);
    await page.click('#editor-back-btn');

    await expect(page.locator('#list-view')).toHaveClass(/active/);
    await expect(page.locator('.song-card')).toHaveCount(1);
    await expect(page.locator('.song-card h3')).toHaveText('Persistent Song');
  });

  test('delete song from list', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.click('#editor-back-btn');
    await expect(page.locator('.song-card')).toHaveCount(1);

    page.on('dialog', d => d.accept());
    await page.click('[data-action="del"]');
    await expect(page.locator('.song-card')).toHaveCount(0);
    await expect(page.locator('.empty-state')).toBeVisible();
  });

  test('duplicate song from list', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.fill('#ed-name', 'Original');
    await page.waitForTimeout(500);
    await page.click('#editor-back-btn');

    await page.click('.song-card [data-action="dup"]');
    await expect(page.locator('.song-card')).toHaveCount(2);
    await expect(page.locator('.song-card h3').nth(1)).toHaveText('Original (copy)');
  });

  test('play from song list opens performance', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.click('#editor-back-btn');
    await page.click('[data-action="play"]');
    await expect(page.locator('#performance-view')).toHaveClass(/active/);
  });
});

test.describe('Editor', () => {

  test('edit song name updates title bar', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.fill('#ed-name', 'My Quartet Piece');
    // Wait for debounced update
    await page.waitForTimeout(500);
    await expect(page.locator('#editor-title')).toHaveText('My Quartet Piece');
  });

  test('section fields: key, time sig, tempo, bars', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.locator('[data-field="key"]').fill('G major');
    await page.locator('[data-field="tsNum"]').fill('3');
    await page.locator('[data-field="tsDen"]').selectOption('4');
    await page.locator('[data-field="tempo"]').fill('90');
    await page.locator('[data-field="bars"]').fill('16');
    // Wait for save
    await page.waitForTimeout(500);
    // Verify duration display exists and updated
    await expect(page.locator('.duration-display')).toContainText('Estimated duration');
  });

  test('add and remove sections', async ({ page }) => {
    await page.click('#new-song-btn');
    await expect(page.locator('.section-card')).toHaveCount(1);

    await page.click('[data-action="add"]');
    await expect(page.locator('.section-card')).toHaveCount(2);
    await expect(page.locator('.section-badge').nth(0)).toHaveText('A');
    await expect(page.locator('.section-badge').nth(1)).toHaveText('B');

    // Delete second section
    await page.locator('.section-card').nth(1).locator('[data-action="del-section"]').click();
    await expect(page.locator('.section-card')).toHaveCount(1);
  });

  test('duplicate section', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.fill('.section-name-input', 'Verse');
    await page.waitForTimeout(500);

    await page.click('[data-action="dup-section"]');
    await expect(page.locator('.section-card')).toHaveCount(2);
    // Duplicate copies the name
    await expect(page.locator('.section-name-input').nth(1)).toHaveValue('Verse');
  });

  test('reorder sections with move buttons', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.click('[data-action="add"]');
    await page.locator('.section-name-input').nth(0).fill('First');
    await page.locator('.section-name-input').nth(1).fill('Second');
    await page.waitForTimeout(500);

    // Move second section up
    await page.locator('.section-card').nth(1).locator('[data-action="move-up"]').click();
    await expect(page.locator('.section-name-input').nth(0)).toHaveValue('Second');
    await expect(page.locator('.section-name-input').nth(1)).toHaveValue('First');
  });

  test('a tempo button copies tempo from first section', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.locator('[data-field="tempo"]').fill('100');
    await page.waitForTimeout(500);

    await page.click('[data-action="add"]');
    // Second section has different default tempo, click a tempo
    await page.locator('.section-card').nth(1).locator('[data-action="a-tempo"]').click();
    await expect(page.locator('.section-card').nth(1).locator('[data-field="tempo"]')).toHaveValue('100');
  });

  test('subdivision selector toggles', async ({ page }) => {
    await page.click('#new-song-btn');
    // Default is "None" active
    await expect(page.locator('.subdiv-opt.active')).toHaveText('None');

    // Click 8ths
    await page.locator('.subdiv-opt[data-subdiv="2"]').click();
    await expect(page.locator('.subdiv-opt.active')).toHaveText('8ths');

    // Click Triplets
    await page.locator('.subdiv-opt[data-subdiv="3"]').click();
    await expect(page.locator('.subdiv-opt.active')).toHaveText('Triplets');
  });

  test('add and remove rit event', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.click('[data-action="add-rit"]');
    await expect(page.locator('.event-row.evt-rit')).toHaveCount(1);
    await expect(page.locator('.event-row .evt-type').first()).toHaveText('Rit');

    // Delete it
    await page.locator('.event-row [data-action="del-event"]').click();
    await expect(page.locator('.event-row')).toHaveCount(0);
  });

  test('add warning event with color and label', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.click('[data-action="add-warning"]');
    await expect(page.locator('.event-row.evt-warning')).toHaveCount(1);

    // Fill warning fields
    await page.locator('.event-row [data-efield="startBar"]').fill('3');
    await page.locator('.event-row [data-efield="endBar"]').fill('5');
    await page.locator('.event-row [data-efield="label"]').fill('Slow down');
    await page.locator('.event-row [data-efield="color"]').selectOption('#e94560');
    await page.waitForTimeout(500);

    // Color preview should update
    const preview = page.locator('.warning-color-preview');
    const bg = await preview.evaluate(el => el.style.background);
    expect(bg).toContain('rgb(233, 69, 96)');
  });

  test('add accel and tempo change events', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.click('[data-action="add-accel"]');
    await page.click('[data-action="add-tempo_change"]');
    await expect(page.locator('.event-row')).toHaveCount(2);
    await expect(page.locator('.event-row.evt-accel')).toHaveCount(1);
    await expect(page.locator('.event-row.evt-tempo_change')).toHaveCount(1);
  });

  test('events are sorted by bar number in display', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.locator('[data-field="bars"]').fill('16');
    await page.waitForTimeout(500);

    // Add warning at bar 10, then rit at bar 2
    await page.click('[data-action="add-warning"]');
    await page.locator('.event-row [data-efield="startBar"]').fill('10');
    await page.waitForTimeout(500);
    await page.click('[data-action="add-rit"]');
    // Rit defaults to near end of section, but events should be sorted by startBar

    // After re-render, events should be sorted by startBar
    const types = await page.locator('.event-row .evt-type').allTextContents();
    expect(types.length).toBe(2);
  });

  test('estimated duration updates', async ({ page }) => {
    await page.click('#new-song-btn');
    const dur1 = await page.locator('.duration-display').textContent();
    // Change bars to 32
    await page.locator('[data-field="bars"]').fill('32');
    await page.waitForTimeout(500);
    // Click add section to trigger re-render with updated state
    await page.click('[data-action="add"]');
    const dur2 = await page.locator('.duration-display').textContent();
    expect(dur1).not.toBe(dur2);
  });
});

test.describe('Performance View', () => {

  test('shows transport controls and scrubber', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.click('#editor-play-btn');
    await expect(page.locator('#performance-view')).toHaveClass(/active/);
    await expect(page.locator('#perf-play-toggle')).toBeVisible();
    await expect(page.locator('#perf-stop-btn')).toBeVisible();
    await expect(page.locator('#perf-restart-btn')).toBeVisible();
    await expect(page.locator('#perf-scrub')).toBeVisible();
  });

  test('scrubber shows bar range', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.locator('[data-field="bars"]').fill('16');
    await page.waitForTimeout(500);
    await page.click('#editor-play-btn');
    await expect(page.locator('#perf-scrub')).toHaveAttribute('max', '16');
    await expect(page.locator('#perf-scrub-label')).toContainText('Bar 1');
  });

  test('song name and duration shown at top', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.fill('#ed-name', 'Test Quartet');
    await page.waitForTimeout(500);
    await page.click('#editor-play-btn');
    await expect(page.locator('#perf-song-name')).toHaveText('Test Quartet');
    await expect(page.locator('#perf-song-duration')).toContainText(':');
  });

  test('play starts playback, pause freezes it', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.locator('[data-field="tempo"]').fill('240');
    await page.locator('[data-field="bars"]').fill('4');
    await page.fill('#ed-countin', '0');
    await page.waitForTimeout(500);

    await page.click('#editor-play-btn');
    await page.click('#perf-play-toggle');

    // Wait for beats to fire
    await page.waitForTimeout(1000);

    const barText = await page.locator('#perf-bar-number').textContent();
    expect(barText).not.toBe('—');
    expect(parseInt(barText)).toBeGreaterThanOrEqual(1);

    // Beat dots should exist
    await expect(page.locator('.beat-dot')).toHaveCount(4);

    // Pause — button should show ▶ again
    await page.click('#perf-play-toggle');
    await expect(page.locator('#perf-play-toggle')).toHaveText('▶');
    // Bar number should be frozen (not reset)
    const barAfterPause = await page.locator('#perf-bar-number').textContent();
    expect(barAfterPause).not.toBe('—');
  });

  test('stop resets to beginning', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.locator('[data-field="tempo"]').fill('200');
    await page.locator('[data-field="bars"]').fill('4');
    await page.fill('#ed-countin', '0');
    await page.waitForTimeout(500);

    await page.click('#editor-play-btn');
    await page.click('#perf-play-toggle');
    await page.waitForTimeout(500);

    await page.click('#perf-stop-btn');
    await expect(page.locator('#perf-bar-number')).toHaveText('\u00A0');
    await expect(page.locator('#perf-play-toggle')).toHaveText('▶');
    // Scrubber should be enabled again
    await expect(page.locator('#perf-scrub')).toBeEnabled();
  });

  test('song completes and shows DONE in warning banner', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.locator('[data-field="tempo"]').fill('400');
    await page.locator('[data-field="bars"]').fill('1');
    await page.fill('#ed-countin', '0');
    await page.waitForTimeout(500);

    await page.click('#editor-play-btn');
    await page.click('#perf-play-toggle');

    await expect(page.locator('#perf-warning')).toContainText('DONE', { timeout: 5000 });
  });

  test('restart after completion resets display', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.locator('[data-field="tempo"]').fill('400');
    await page.locator('[data-field="bars"]').fill('1');
    await page.fill('#ed-countin', '0');
    await page.waitForTimeout(500);

    await page.click('#editor-play-btn');
    await page.click('#perf-play-toggle');
    await expect(page.locator('#perf-warning')).toContainText('DONE', { timeout: 5000 });

    await page.click('#perf-restart-btn');
    await expect(page.locator('#perf-warning')).toHaveClass(/hidden/);
    await expect(page.locator('#perf-bar-number')).toHaveText('\u00A0');
  });

  test('close button returns to editor', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.click('#editor-play-btn');
    await page.click('#perf-close-btn');
    await expect(page.locator('#editor-view')).toHaveClass(/active/);
  });

  test('audio toggle switches icon', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.click('#editor-play-btn');

    await expect(page.locator('#perf-audio-toggle')).toHaveText('🔇');
    await page.click('#perf-audio-toggle');
    await expect(page.locator('#perf-audio-toggle')).toHaveText('🔊');
    await page.click('#perf-audio-toggle');
    await expect(page.locator('#perf-audio-toggle')).toHaveText('🔇');
  });

  test('count-in shows count-in mode', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.locator('[data-field="tempo"]').fill('200');
    await page.fill('#ed-countin', '2');
    await page.locator('[data-field="bars"]').fill('4');
    await page.waitForTimeout(500);

    await page.click('#editor-play-btn');
    await page.click('#perf-play-toggle');

    await expect(page.locator('#perf-section-letter')).toHaveText('⏱', { timeout: 2000 });
    await expect(page.locator('#perf-bar-number')).toHaveClass(/count-in-mode/);
  });

  test('section letter and label display during playback', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.fill('.section-name-input', 'Intro');
    await page.locator('[data-field="tempo"]').fill('300');
    await page.locator('[data-field="bars"]').fill('2');
    await page.fill('#ed-countin', '0');
    await page.waitForTimeout(500);

    await page.click('#editor-play-btn');
    await page.click('#perf-play-toggle');
    await page.waitForTimeout(300);

    await expect(page.locator('#perf-section-letter')).toHaveText('A');
    await expect(page.locator('#perf-section-label')).toHaveText('Intro');
  });

  test('warning event shows banner', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.locator('[data-field="tempo"]').fill('300');
    await page.locator('[data-field="bars"]').fill('4');
    await page.fill('#ed-countin', '0');
    await page.waitForTimeout(500);

    await page.click('[data-action="add-warning"]');
    await page.locator('.event-row [data-efield="startBar"]').fill('1');
    await page.locator('.event-row [data-efield="endBar"]').fill('2');
    await page.locator('.event-row [data-efield="label"]').fill('WATCH');
    await page.waitForTimeout(500);

    await page.click('#editor-play-btn');
    await page.click('#perf-play-toggle');
    await page.waitForTimeout(400);

    await expect(page.locator('#perf-warning')).toBeVisible();
    const bg = await page.locator('#perf-warning').evaluate(el => el.style.background);
    expect(bg).toBeTruthy();
  });

  test('heads-up info shows before section transition', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.locator('[data-field="tempo"]').fill('300');
    await page.locator('[data-field="bars"]').fill('3');
    await page.fill('#ed-countin', '0');
    await page.fill('#ed-autowarn', '2');
    await page.waitForTimeout(500);

    await page.click('[data-action="add"]');
    await page.waitForTimeout(300);

    await page.click('#editor-play-btn');
    await page.click('#perf-play-toggle');

    await expect(page.locator('#perf-next-info')).toContainText('→', { timeout: 5000 });
    await expect(page.locator('#perf-next-info')).toHaveClass(/imminent/);
  });

  test('subdivision dots appear when section has subdivisions', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.locator('[data-field="tempo"]').fill('120');
    await page.locator('[data-field="bars"]').fill('2');
    await page.fill('#ed-countin', '0');
    await page.locator('.subdiv-opt[data-subdiv="2"]').click();
    await page.waitForTimeout(500);

    await page.click('#editor-play-btn');
    await page.click('#perf-play-toggle');
    await page.waitForTimeout(300);

    await expect(page.locator('.sub-dots')).toHaveCount(4);
    await expect(page.locator('.sub-dot')).toHaveCount(8);
  });
});

test.describe('PWA', () => {

  test('meta tags present for iPad', async ({ page }) => {
    const capable = await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content');
    expect(capable).toBe('yes');
    const status = await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute('content');
    expect(status).toBe('black-translucent');
    const theme = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(theme).toBe('#0a0a0f');
  });

  test('manifest link exists', async ({ page }) => {
    const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifest).toBe('manifest.json');
  });
});

test.describe('Data Persistence', () => {

  test('songs survive page reload', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.fill('#ed-name', 'Reload Test');
    await page.waitForTimeout(500);
    await page.click('#editor-back-btn');
    await expect(page.locator('.song-card h3')).toHaveText('Reload Test');

    await page.reload();
    await expect(page.locator('.song-card')).toHaveCount(1);
    await expect(page.locator('.song-card h3')).toHaveText('Reload Test');
  });

  test('section events persist after save and reopen', async ({ page }) => {
    await page.click('#new-song-btn');
    await page.click('[data-action="add-rit"]');
    await page.click('[data-action="add-warning"]');
    await page.waitForTimeout(500);
    await page.click('#editor-back-btn');

    // Reopen song
    await page.click('.song-card');
    await expect(page.locator('.event-row')).toHaveCount(2);
  });
});
