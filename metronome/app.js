(function () {
  'use strict';

  /* ====== Constants ====== */
  const STORAGE_KEY = 'vc-songs';
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const WARNING_COLORS = [
    { name: 'Orange', value: '#ff8c00' },
    { name: 'Red', value: '#e94560' },
    { name: 'Yellow', value: '#ffd93d' },
    { name: 'Blue', value: '#4e8cff' },
    { name: 'Green', value: '#4ecdc4' },
    { name: 'Purple', value: '#9b59b6' }
  ];

  /* ====== State ====== */
  const state = {
    songs: [],
    currentSong: null,
    beatMap: [],
    playing: false,
    startTime: 0,
    beatIndex: 0,
    rafId: null,
    audioCtx: null,
    audioOn: false,
    wakeLock: null,
    startBar: 1,
    paused: false,
    pauseElapsed: 0
  };

  /* ====== Helpers ====== */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];
  const el = (tag, attrs, ...children) => {
    const e = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') e.className = v;
      else if (k.startsWith('data')) e.setAttribute(k.replace(/([A-Z])/g, '-$1').toLowerCase(), v);
      else e[k] = v;
    });
    children.flat().forEach(c => {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  };

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ====== Default Data ====== */
  function defaultSection(index) {
    return {
      name: LETTERS[index] || `S${index + 1}`,
      timeSignatureNum: 4,
      timeSignatureDen: 4,
      keySignature: '',
      tempo: 120,
      bars: 8,
      subdivision: 0,
      events: []
    };
  }

  function defaultSong() {
    return { id: uid(), name: 'New Song', countInMeasures: 2, autoWarningBars: 2, sections: [defaultSection(0)] };
  }

  /* ====== Storage ====== */
  function loadSongs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const songs = JSON.parse(raw);
      return songs.map(migrateSong);
    } catch { return []; }
  }

  function migrateSong(song) {
    if (song.countInBeats != null && song.countInMeasures == null) {
      song.countInMeasures = Math.max(1, Math.round(song.countInBeats / (song.sections[0]?.timeSignatureNum || 4)));
      delete song.countInBeats;
    }
    if (!song.autoWarningBars) song.autoWarningBars = 2;
    song.sections = (song.sections || []).forEach ? song.sections : [];
    song.sections.forEach(sec => {
      if (!sec.events) {
        sec.events = [];
        // Migrate old rit/accel via tempoEnd + rampStartBar
        if (sec.tempoEnd != null && sec.tempoEnd !== sec.tempo) {
          const startBar = sec.rampStartBar || 1;
          sec.events.push({
            type: sec.tempoEnd < sec.tempo ? 'rit' : 'accel',
            startBar: startBar,
            endBar: sec.bars,
            targetTempo: sec.tempoEnd,
            color: null, label: null
          });
        }
        // Migrate old warnings
        if (sec.warnings && sec.warnings.length) {
          sec.warnings.forEach(w => {
            sec.events.push({
              type: 'warning',
              startBar: w.startBar,
              endBar: w.endBar,
              targetTempo: null,
              color: w.color || '#ff8c00',
              label: w.label || ''
            });
          });
        }
        delete sec.tempoEnd;
        delete sec.rampStartBar;
        delete sec.warnings;
      }
      if (sec.subdivision == null) sec.subdivision = 0;
    });
    return song;
  }

  function saveSongs() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.songs));
  }

  /* ====== Beat Map Computation ====== */
  function computeBeatMap(song, startBar) {
    const map = [];
    const bpb0 = song.sections[0]?.timeSignatureNum || 4;
    startBar = startBar || 1;

    // Determine effective tempo at the start bar (for count-in)
    let startTempo = song.sections[0]?.tempo || 120;
    if (startBar > 1) {
      startTempo = tempoAtBar(song, startBar);
    }

    // Count-in
    const countInBeats = (song.countInMeasures || 0) * bpb0;
    let time = 0;
    for (let i = 0; i < countInBeats; i++) {
      const beat = (i % bpb0) + 1;
      map.push({
        time, bar: -(song.countInMeasures - Math.floor(i / bpb0)),
        beat, beatsPerBar: bpb0, tempo: startTempo,
        sectionIndex: -1, sectionName: 'Count-in', sectionLetter: '',
        isCountIn: true, isDownbeat: beat === 1,
        subdivision: 0, warningColor: null, warningLabel: null,
        isFermata: false, holdSeconds: 0
      });
      time += 60 / startTempo;
    }

    // Build per-bar tempo map for song from startBar
    let globalBar = 0;
    let skipped = 0;
    for (let si = 0; si < song.sections.length; si++) {
      const sec = song.sections[si];
      const bpb = sec.timeSignatureNum;
      const baseTempo = sec.tempo;

      for (let localBar = 1; localBar <= sec.bars; localBar++) {
        globalBar++;
        if (globalBar < startBar) { skipped++; continue; }

        const warnInfo = resolveWarningAtLocalBar(sec, localBar);
        // Check for fermata in this bar
        const fermata = sec.events.find(e => e.type === 'fermata' && e.startBar === localBar);

        for (let b = 1; b <= bpb; b++) {
          // Skip beats consumed by a fermata on an earlier beat
          if (fermata && b > fermata.fermataBeat && b < fermata.fermataBeat + (fermata.beatsConsumed || bpb)) {
            // This beat is "consumed" — the fermata hold covers it
            continue;
          }

          const tempo = resolveTempoAtBeat(sec, localBar, b, bpb);
          const isFermataBeat = fermata && b === fermata.fermataBeat;
          const holdSeconds = isFermataBeat ? (fermata.holdSeconds || 3) : 0;

          map.push({
            time, bar: globalBar, beat: b, beatsPerBar: bpb, tempo,
            sectionIndex: si, sectionName: sec.name || LETTERS[si],
            sectionLetter: LETTERS[si] || `${si + 1}`,
            isCountIn: false, isDownbeat: b === 1,
            subdivision: sec.subdivision || 0,
            warningColor: warnInfo?.color || null,
            warningLabel: warnInfo?.label || null,
            keySignature: sec.keySignature || '',
            isFermata: isFermataBeat, holdSeconds
          });
          time += isFermataBeat ? holdSeconds : 60 / tempo;
        }
      }
    }
    return map;
  }

  function tempoAtBar(song, globalBar) {
    let bar = 0;
    for (const sec of song.sections) {
      const bpb = sec.timeSignatureNum;
      for (let lb = 1; lb <= sec.bars; lb++) {
        bar++;
        if (bar === globalBar) return resolveTempoAtBeat(sec, lb, 1, bpb);
      }
    }
    return song.sections[0]?.tempo || 120;
  }

  function resolveTempoAtBeat(sec, localBar, beat, bpb) {
    let tempo = sec.tempo;
    for (const evt of sec.events) {
      if (evt.type === 'tempo_change' && localBar >= evt.startBar) {
        tempo = evt.targetTempo;
      }
      if ((evt.type === 'rit' || evt.type === 'accel') && localBar >= evt.startBar && localBar <= evt.endBar) {
        let entryTempo = sec.tempo;
        for (const e2 of sec.events) {
          if (e2 === evt) break;
          if (e2.type === 'tempo_change' && e2.startBar <= evt.startBar) entryTempo = e2.targetTempo;
          if ((e2.type === 'rit' || e2.type === 'accel') && evt.startBar >= e2.startBar && evt.startBar <= e2.endBar) {
            const t = (evt.startBar - e2.startBar) / Math.max(1, e2.endBar - e2.startBar);
            const eEntry = sec.tempo;
            entryTempo = eEntry + t * (e2.targetTempo - eEntry);
          }
        }
        // Interpolate per-beat across the full ramp range
        const totalBars = evt.endBar - evt.startBar + 1;
        const totalBeats = totalBars * bpb;
        const barsInto = localBar - evt.startBar;
        const beatsInto = barsInto * bpb + (beat - 1);
        const progress = totalBeats > 1 ? beatsInto / (totalBeats - 1) : 1;
        tempo = entryTempo + progress * (evt.targetTempo - entryTempo);
      }
    }
    return Math.round(tempo * 10) / 10;
  }

  function resolveWarningAtLocalBar(sec, localBar) {
    for (let i = sec.events.length - 1; i >= 0; i--) {
      const evt = sec.events[i];
      if (evt.type === 'warning' && localBar >= evt.startBar && localBar <= evt.endBar) {
        return { color: evt.color, label: evt.label };
      }
    }
    return null;
  }

  function totalBars(song) {
    return song.sections.reduce((s, sec) => s + sec.bars, 0);
  }

  function estimateDuration(song) {
    const map = computeBeatMap(song, 1);
    if (!map.length) return 0;
    const last = map[map.length - 1];
    return last.time + 60 / last.tempo;
  }

  /* ====== Wake Lock ====== */
  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        state.wakeLock = await navigator.wakeLock.request('screen');
        state.wakeLock.addEventListener('release', () => { state.wakeLock = null; });
      }
    } catch { /* ignore */ }
  }

  function releaseWakeLock() {
    if (state.wakeLock) { state.wakeLock.release(); state.wakeLock = null; }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.playing) acquireWakeLock();
  });

  /* ====== Audio ====== */
  function ensureAudioCtx() {
    if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
  }

  function playClick(freq, dur) {
    if (!state.audioOn || !state.audioCtx) return;
    const ctx = state.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  }

  /* ====== Navigation ====== */
  function showView(id) {
    $$('.view').forEach(v => v.classList.remove('active'));
    $(`#${id}`).classList.add('active');
  }

  /* ====== Song List View ====== */
  function renderSongList() {
    const container = $('#song-list');
    container.innerHTML = '';
    if (!state.songs.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎼</div><p>No songs yet</p><p style="font-size:14px">Tap + to create one</p></div>`;
      return;
    }
    state.songs.forEach(song => {
      const secs = song.sections.length;
      const bars = totalBars(song);
      const dur = estimateDuration(song);
      const mins = Math.floor(dur / 60);
      const secsStr = Math.floor(dur % 60).toString().padStart(2, '0');
      const card = el('div', { className: 'song-card', 'data-id': song.id },
        el('div', { className: 'song-card-main' },
          el('h3', {}, song.name),
          el('div', { className: 'song-meta' }, `${secs} section${secs > 1 ? 's' : ''} · ${bars} bars · ~${mins}:${secsStr}`)
        ),
        el('div', { className: 'song-card-actions' },
          el('button', { className: 'btn-icon play', 'data-action': 'play', title: 'Perform' }, '▶'),
          el('button', { className: 'btn-icon', 'data-action': 'dup', title: 'Duplicate' }, '⧉'),
          el('button', { className: 'btn-icon', 'data-action': 'del', title: 'Delete' }, '🗑')
        )
      );
      container.appendChild(card);
    });
  }

  $('#song-list').addEventListener('click', e => {
    const card = e.target.closest('.song-card');
    if (!card) return;
    const id = card.dataset.id || card.getAttribute('data-id');
    const action = e.target.closest('[data-action]')?.dataset.action || e.target.closest('[data-action]')?.getAttribute('data-action');

    if (action === 'del') {
      if (confirm('Delete this song?')) {
        state.songs = state.songs.filter(s => s.id !== id);
        saveSongs(); renderSongList();
      }
    } else if (action === 'dup') {
      const src = state.songs.find(s => s.id === id);
      if (src) {
        const copy = JSON.parse(JSON.stringify(src));
        copy.id = uid(); copy.name += ' (copy)';
        state.songs.push(copy); saveSongs(); renderSongList();
      }
    } else if (action === 'play') {
      state.currentSong = state.songs.find(s => s.id === id);
      openPerformance();
    } else {
      state.currentSong = state.songs.find(s => s.id === id);
      openEditor();
    }
  });

  $('#new-song-btn').addEventListener('click', () => {
    const song = defaultSong();
    state.songs.push(song); saveSongs();
    state.currentSong = song;
    openEditor();
  });

  /* ====== Editor View ====== */
  function openEditor() {
    showView('editor-view');
    renderEditor();
  }

  function renderEditor() {
    const song = state.currentSong;
    if (!song) return;
    $('#editor-title').textContent = song.name;
    const c = $('#editor-content');
    c.innerHTML = '';

    // Top: name + count-in + auto-warning
    const topDiv = el('div', { className: 'editor-top' });
    topDiv.innerHTML = `
      <div class="field-group wide"><label>Song Name</label>
        <input type="text" id="ed-name" value="${esc(song.name)}"></div>
      <div class="field-group"><label>Count-in (measures)</label>
        <input type="number" id="ed-countin" min="0" max="16" value="${song.countInMeasures}"></div>
      <div class="field-group"><label>Heads-up (bars before section change)</label>
        <input type="number" id="ed-autowarn" min="0" max="8" value="${song.autoWarningBars}"></div>
    `;
    c.appendChild(topDiv);

    // Duration estimate
    const dur = estimateDuration(song);
    const mins = Math.floor(dur / 60);
    const secsStr = Math.floor(dur % 60).toString().padStart(2, '0');
    c.appendChild(el('span', { className: 'duration-display' }, `Estimated duration: ${mins}:${secsStr}`));

    // Section cards
    song.sections.forEach((sec, si) => {
      c.appendChild(renderSectionCard(song, sec, si));
    });

    // Add section button
    const addBtn = el('button', { className: 'btn-add-section', 'data-action': 'add' }, '+ Add Section');
    c.appendChild(addBtn);
  }

  function renderSectionCard(song, sec, si) {
    const letter = LETTERS[si] || `${si + 1}`;
    const card = el('div', { className: 'section-card', 'data-section': si.toString() });

    // Header
    const header = el('div', { className: 'section-card-header' },
      el('div', { className: 'section-badge' }, letter),
      el('input', { className: 'section-name-input', type: 'text', value: sec.name || letter, 'data-field': 'name' }),
      el('div', { className: 'section-actions' },
        el('button', { className: 'btn-sm', 'data-action': 'move-up', title: 'Move up', disabled: si === 0 }, '↑'),
        el('button', { className: 'btn-sm', 'data-action': 'move-down', title: 'Move down', disabled: si === song.sections.length - 1 }, '↓'),
        el('button', { className: 'btn-sm', 'data-action': 'dup-section', title: 'Duplicate' }, '⧉'),
        el('button', { className: 'btn-sm', 'data-action': 'del-section', title: 'Delete', disabled: song.sections.length <= 1 }, '✕')
      )
    );
    card.appendChild(header);

    // Body
    const body = el('div', { className: 'section-card-body' });

    // Row 1: Time sig, Key, Bars
    const row1 = el('div', { className: 'field-row' });
    row1.innerHTML = `
      <div class="field-group"><label>Time Signature</label>
        <div class="time-sig-input">
          <input type="number" data-field="tsNum" min="1" max="12" value="${sec.timeSignatureNum}">
          <span class="ts-slash">/</span>
          <select data-field="tsDen">
            <option value="2" ${sec.timeSignatureDen === 2 ? 'selected' : ''}>2</option>
            <option value="4" ${sec.timeSignatureDen === 4 ? 'selected' : ''}>4</option>
            <option value="8" ${sec.timeSignatureDen === 8 ? 'selected' : ''}>8</option>
          </select>
        </div></div>
      <div class="field-group"><label>Key</label>
        <input type="text" data-field="key" value="${esc(sec.keySignature || '')}" placeholder="e.g. C major"></div>
      <div class="field-group"><label>Bars</label>
        <input type="number" data-field="bars" min="1" max="999" value="${sec.bars}"></div>
    `;
    body.appendChild(row1);

    // Row 2: Tempo + A Tempo btn
    const row2 = el('div', { className: 'field-row' });
    const tempoHtml = `
      <div class="field-group"><label>Tempo (BPM)</label>
        <div class="tempo-input-row">
          <input type="number" data-field="tempo" min="10" max="400" value="${sec.tempo}">
        </div></div>
    `;
    row2.innerHTML = tempoHtml;

    // Subdivision
    row2.innerHTML += `
      <div class="field-group"><label>Subdivision</label>
        <div class="subdiv-selector">
          <button type="button" class="subdiv-opt ${sec.subdivision === 0 ? 'active' : ''}" data-subdiv="0">None</button>
          <button type="button" class="subdiv-opt ${sec.subdivision === 2 ? 'active' : ''}" data-subdiv="2">8ths</button>
          <button type="button" class="subdiv-opt ${sec.subdivision === 3 ? 'active' : ''}" data-subdiv="3">Triplets</button>
          <button type="button" class="subdiv-opt ${sec.subdivision === 4 ? 'active' : ''}" data-subdiv="4">16ths</button>
        </div></div>
    `;
    body.appendChild(row2);

    // Events Timeline
    const evtSection = el('div', { className: 'events-section' });
    const evtHeader = el('div', { className: 'events-header' },
      el('label', {}, 'Events Timeline'),
      el('div', { className: 'add-event-bar' },
        el('button', { className: 'btn-add-event', 'data-action': 'add-rit' }, '+ Rit'),
        el('button', { className: 'btn-add-event', 'data-action': 'add-accel' }, '+ Accel'),
        el('button', { className: 'btn-add-event', 'data-action': 'add-warning' }, '+ Warning'),
        el('button', { className: 'btn-add-event', 'data-action': 'add-tempo_change' }, '+ Tempo Δ'),
        el('button', { className: 'btn-add-event', 'data-action': 'add-fermata' }, '+ Fermata')
      )
    );
    evtSection.appendChild(evtHeader);

    // Events — sorted by startBar
    const sortedEvents = (sec.events || []).slice().sort((a, b) => (a.startBar || 0) - (b.startBar || 0));
    const eventIndexMap = (sec.events || []).map((evt, i) => i);
    sortedEvents.forEach(evt => {
      const origIdx = sec.events.indexOf(evt);
      evtSection.appendChild(renderEventRow(evt, origIdx, sec));
    });

    body.appendChild(evtSection);
    card.appendChild(body);
    return card;
  }

  function renderEventRow(evt, ei, sec) {
    const row = el('div', { className: `event-row evt-${evt.type}`, 'data-event': ei.toString() });
    const typeLabels = { rit: 'Rit', accel: 'Accel', warning: 'Warning', tempo_change: 'Tempo Δ', fermata: '𝄐 Fermata' };
    row.appendChild(el('span', { className: 'evt-type' }, typeLabels[evt.type] || evt.type));

    if (evt.type === 'rit' || evt.type === 'accel') {
      row.innerHTML += `
        <div class="field-inline">bars <input type="number" data-efield="startBar" min="1" max="${sec.bars}" value="${evt.startBar}">
        – <input type="number" data-efield="endBar" min="1" max="${sec.bars}" value="${evt.endBar}"></div>
        <div class="field-inline">→ <input type="number" data-efield="targetTempo" min="10" max="400" value="${evt.targetTempo}"> bpm</div>
      `;
    } else if (evt.type === 'warning') {
      row.innerHTML += `
        <div class="field-inline">bars <input type="number" data-efield="startBar" min="1" max="${sec.bars}" value="${evt.startBar}">
        – <input type="number" data-efield="endBar" min="1" max="${sec.bars}" value="${evt.endBar}"></div>
        <div class="field-inline"><input type="text" data-efield="label" value="${esc(evt.label || '')}" placeholder="Label"></div>
        <div class="field-inline">
          <select data-efield="color">${WARNING_COLORS.map(c => `<option value="${c.value}" ${evt.color === c.value ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
          <div class="warning-color-preview" style="background:${evt.color || '#ff8c00'}"></div>
        </div>
      `;
    } else if (evt.type === 'tempo_change') {
      row.innerHTML += `
        <div class="field-inline">at bar <input type="number" data-efield="startBar" min="1" max="${sec.bars}" value="${evt.startBar}"></div>
        <div class="field-inline">→ <input type="number" data-efield="targetTempo" min="10" max="400" value="${evt.targetTempo}"> bpm</div>
      `;
    } else if (evt.type === 'fermata') {
      row.innerHTML += `
        <div class="field-inline">bar <input type="number" data-efield="startBar" min="1" max="${sec.bars}" value="${evt.startBar}"></div>
        <div class="field-inline">beat <input type="number" data-efield="fermataBeat" min="1" max="${sec.timeSignatureNum}" value="${evt.fermataBeat || 1}"></div>
        <div class="field-inline">holds <input type="number" data-efield="beatsConsumed" min="1" max="${sec.timeSignatureNum}" value="${evt.beatsConsumed || sec.timeSignatureNum}"> beats</div>
        <div class="field-inline">hold <input type="number" data-efield="holdSeconds" min="1" max="30" step="0.5" value="${evt.holdSeconds || 3}">s</div>
      `;
    }

    row.appendChild(el('button', { className: 'btn-sm', 'data-action': 'del-event', title: 'Remove' }, '✕'));
    return row;
  }

  function esc(s) { return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  function readEditorState() {
    const song = state.currentSong;
    if (!song) return;
    song.name = ($('#ed-name')?.value || '').trim() || 'Untitled';
    song.countInMeasures = parseInt($('#ed-countin')?.value) || 0;
    song.autoWarningBars = parseInt($('#ed-autowarn')?.value) || 0;

    $$('.section-card').forEach((card, si) => {
      if (si >= song.sections.length) return;
      const sec = song.sections[si];
      const f = (sel) => card.querySelector(sel);
      sec.name = (f('[data-field="name"]')?.value || '').trim();
      sec.timeSignatureNum = parseInt(f('[data-field="tsNum"]')?.value) || 4;
      sec.timeSignatureDen = parseInt(f('[data-field="tsDen"]')?.value) || 4;
      sec.keySignature = f('[data-field="key"]')?.value || '';
      sec.tempo = parseFloat(f('[data-field="tempo"]')?.value) || 120;
      sec.bars = parseInt(f('[data-field="bars"]')?.value) || 1;

      // Read events
      card.querySelectorAll('.event-row').forEach((eRow) => {
        const ei = parseInt(eRow.dataset.event ?? eRow.getAttribute('data-event'));
        if (isNaN(ei) || ei >= sec.events.length) return;
        const evt = sec.events[ei];
        const ef = (sel) => eRow.querySelector(sel);
        if (ef('[data-efield="startBar"]')) evt.startBar = parseInt(ef('[data-efield="startBar"]').value) || 1;
        if (ef('[data-efield="endBar"]')) evt.endBar = parseInt(ef('[data-efield="endBar"]').value) || evt.startBar;
        if (ef('[data-efield="targetTempo"]')) evt.targetTempo = parseFloat(ef('[data-efield="targetTempo"]').value) || 120;
        if (ef('[data-efield="fermataBeat"]')) evt.fermataBeat = parseInt(ef('[data-efield="fermataBeat"]').value) || 1;
        if (ef('[data-efield="beatsConsumed"]')) evt.beatsConsumed = parseInt(ef('[data-efield="beatsConsumed"]').value) || 1;
        if (ef('[data-efield="holdSeconds"]')) evt.holdSeconds = parseFloat(ef('[data-efield="holdSeconds"]').value) || 3;
        if (ef('[data-efield="label"]')) evt.label = ef('[data-efield="label"]').value;
        if (ef('[data-efield="color"]')) {
          evt.color = ef('[data-efield="color"]').value;
          const preview = eRow.querySelector('.warning-color-preview');
          if (preview) preview.style.background = evt.color;
        }
      });
    });
    saveSongs();
  }

  // Delegated editor events
  $('#editor-content').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action || btn.getAttribute('data-action');
    const card = btn.closest('.section-card');
    const si = card ? parseInt(card.dataset.section || card.getAttribute('data-section')) : -1;
    const song = state.currentSong;

    readEditorState();

    switch (action) {
      case 'add': {
        const newSec = defaultSection(song.sections.length);
        newSec.tempo = song.sections[0]?.tempo ?? newSec.tempo;
        song.sections.push(newSec);
        break;
      }
      case 'del-section': {
        if (song.sections.length > 1) song.sections.splice(si, 1);
        break;
      }
      case 'dup-section': {
        const copy = JSON.parse(JSON.stringify(song.sections[si]));
        song.sections.splice(si + 1, 0, copy);
        break;
      }
      case 'move-up': {
        if (si > 0) [song.sections[si - 1], song.sections[si]] = [song.sections[si], song.sections[si - 1]];
        break;
      }
      case 'move-down': {
        if (si < song.sections.length - 1) [song.sections[si + 1], song.sections[si]] = [song.sections[si], song.sections[si + 1]];
        break;
      }
      case 'a-tempo': break;
      case 'add-rit': {
        song.sections[si].events.push({ type: 'rit', startBar: Math.max(1, song.sections[si].bars - 1), endBar: song.sections[si].bars, targetTempo: Math.round(song.sections[si].tempo * 0.9), color: null, label: null });
        break;
      }
      case 'add-accel': {
        song.sections[si].events.push({ type: 'accel', startBar: 1, endBar: Math.min(4, song.sections[si].bars), targetTempo: Math.round(song.sections[si].tempo * 1.1), color: null, label: null });
        break;
      }
      case 'add-warning': {
        song.sections[si].events.push({ type: 'warning', startBar: 1, endBar: 2, targetTempo: null, color: '#ff8c00', label: 'Warning' });
        break;
      }
      case 'add-tempo_change': {
        song.sections[si].events.push({ type: 'tempo_change', startBar: 1, endBar: null, targetTempo: song.sections[si].tempo, color: null, label: null });
        break;
      }
      case 'add-fermata': {
        song.sections[si].events.push({ type: 'fermata', startBar: song.sections[si].bars, fermataBeat: song.sections[si].timeSignatureNum, beatsConsumed: 1, holdSeconds: 3, color: null, label: null });
        break;
      }
      case 'del-event': {
        const eRow = btn.closest('.event-row');
        const ei = parseInt(eRow.dataset.event || eRow.getAttribute('data-event'));
        song.sections[si].events.splice(ei, 1);
        break;
      }
    }
    saveSongs();
    renderEditor();
  });

  // Subdivision toggle
  $('#editor-content').addEventListener('click', e => {
    const opt = e.target.closest('.subdiv-opt');
    if (!opt) return;
    readEditorState();
    const card = opt.closest('.section-card');
    const si = parseInt(card.dataset.section || card.getAttribute('data-section'));
    state.currentSong.sections[si].subdivision = parseInt(opt.dataset.subdiv || opt.getAttribute('data-subdiv'));
    saveSongs();
    renderEditor();
  });

  // Auto-save on input
  $('#editor-content').addEventListener('input', debounce(() => {
    readEditorState();
    $('#editor-title').textContent = state.currentSong?.name || 'Edit Song';
  }, 400));

  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  // Editor nav
  $('#editor-back-btn').addEventListener('click', () => { readEditorState(); showView('list-view'); renderSongList(); });
  $('#editor-play-btn').addEventListener('click', () => { readEditorState(); openPerformance(); });

  /* ====== Performance View ====== */
  function openPerformance() {
    const song = state.currentSong;
    if (!song) return;
    state.startBar = 1;
    showView('performance-view');
    // Song metadata
    $('#perf-song-name').textContent = song.name;
    const dur = estimateDuration(song);
    const mins = Math.floor(dur / 60);
    const secs = Math.floor(dur % 60).toString().padStart(2, '0');
    $('#perf-song-duration').textContent = `${mins}:${secs}`;
    // Setup scrubber
    const maxBar = totalBars(song);
    const scrub = $('#perf-scrub');
    scrub.max = maxBar;
    scrub.value = 1;
    scrub.disabled = false;
    updateScrubLabel(1, maxBar);
    // Init display
    resetPerfDisplay();
    updateAudioBtn();
    updatePlayBtn();
    // Pre-build beat dots from first section
    if (song.sections.length) {
      buildBeatDots(song.sections[0].timeSignatureNum, song.sections[0].subdivision);
    }
  }

  function resetPerfDisplay() {
    $('#perf-section-letter').textContent = '\u00A0';
    $('#perf-section-label').textContent = '';
    $('#perf-bar-number').textContent = '\u00A0';
    $('#perf-bar-number').className = 'bar-number';
    $('#perf-beats-container').innerHTML = '';
    $('#perf-next-info').textContent = '';
    $('#perf-next-info').className = 'perf-next';
    hideWarning();
  }

  function hideWarning() {
    const w = $('#perf-warning');
    w.classList.add('hidden');
    w.innerHTML = '';
    w.style.background = '';
  }

  function showWarning(color, label) {
    const w = $('#perf-warning');
    w.style.background = color || '#ff8c00';
    w.classList.remove('hidden');
    w.innerHTML = label ? `<span class="warning-label">${escHtml(label)}</span>` : '';
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function buildBeatDots(beatsPerBar, subdivision) {
    const container = $('#perf-beats-container');
    container.innerHTML = '';
    for (let i = 1; i <= beatsPerBar; i++) {
      const col = el('div', { className: 'beat-col' });
      const dot = el('div', { className: 'beat-dot', 'data-beat': i.toString() }, i.toString());
      col.appendChild(dot);
      if (subdivision > 0) {
        const subRow = el('div', { className: 'sub-dots' });
        for (let s = 0; s < subdivision; s++) {
          subRow.appendChild(el('div', { className: 'sub-dot', 'data-sub': s.toString() }));
        }
        col.appendChild(subRow);
      }
      container.appendChild(col);
    }
  }

  function updateScrubLabel(bar, max) {
    $('#perf-scrub-label').textContent = `Bar ${bar} / ${max}`;
  }

  function updatePlayBtn() {
    const btn = $('#perf-play-toggle');
    btn.textContent = state.playing ? '⏸' : '▶';
    btn.classList.toggle('playing', state.playing);
  }

  // Play / Pause toggle
  $('#perf-play-toggle').addEventListener('click', () => {
    if (state.playing) {
      pausePlayback();
    } else {
      startPlayback();
    }
  });

  // Stop — reset to beginning
  $('#perf-stop-btn').addEventListener('click', () => {
    stopPlayback();
  });

  // Restart — reset scrubber to 1 and stop
  $('#perf-restart-btn').addEventListener('click', () => {
    const wasPlaying = state.playing;
    stopPlayback();
    $('#perf-scrub').value = 1;
    updateScrubLabel(1, parseInt($('#perf-scrub').max) || 1);
    if (wasPlaying) startPlayback();
  });

  function startPlayback() {
    const song = state.currentSong;
    if (!song) return;
    if (state.paused && state.beatMap.length) {
      // Resume from pause
      state.playing = true;
      state.paused = false;
      state.startTime = performance.now() - state.pauseElapsed * 1000;
      $('#perf-scrub').disabled = true;
      acquireWakeLock();
      updatePlayBtn();
      tick();
      return;
    }
    state.startBar = parseInt($('#perf-scrub').value) || 1;
    state.beatMap = computeBeatMap(song, state.startBar);
    if (!state.beatMap.length) return;
    state.beatIndex = 0;
    state.playing = true;
    state.paused = false;
    state.pauseElapsed = 0;
    state.startTime = performance.now();
    $('#perf-scrub').disabled = true;
    ensureAudioCtx();
    acquireWakeLock();
    updatePlayBtn();
    const firstBeat = state.beatMap[0];
    buildBeatDots(firstBeat.beatsPerBar, firstBeat.subdivision);
    tick();
  }

  function pausePlayback() {
    state.pauseElapsed = (performance.now() - state.startTime) / 1000;
    state.playing = false;
    state.paused = true;
    if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
    releaseWakeLock();
    updatePlayBtn();
    // Keep display as-is, don't reset
  }

  function stopPlayback() {
    state.playing = false;
    state.paused = false;
    state.pauseElapsed = 0;
    if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
    releaseWakeLock();
    hideWarning();
    $('#perf-scrub').disabled = false;
    updatePlayBtn();
    resetPerfDisplay();
    const song = state.currentSong;
    if (song && song.sections.length) {
      buildBeatDots(song.sections[0].timeSignatureNum, song.sections[0].subdivision);
    }
  }

  // Scrubber
  $('#perf-scrub').addEventListener('input', () => {
    if (state.playing) return;
    state.paused = false; // scrubbing cancels a pause
    const bar = parseInt($('#perf-scrub').value) || 1;
    const max = parseInt($('#perf-scrub').max) || 1;
    updateScrubLabel(bar, max);
  });

  // Close
  $('#perf-close-btn').addEventListener('click', () => {
    stopPlayback();
    showView('editor-view');
  });

  // Audio toggle
  $('#perf-audio-toggle').addEventListener('click', () => {
    state.audioOn = !state.audioOn;
    if (state.audioOn) ensureAudioCtx();
    updateAudioBtn();
  });

  function updateAudioBtn() {
    $('#perf-audio-toggle').textContent = state.audioOn ? '🔊' : '🔇';
  }



  /* ====== Playback Engine ====== */
  let lastBeatIndex = -1;
  let lastBarBeats = 0;
  let lastSubdiv = -1;
  let subTick = 0;
  let lastSubTime = 0;

  function tick() {
    if (!state.playing) return;
    state.rafId = requestAnimationFrame(tick);
    const elapsed = (performance.now() - state.startTime) / 1000;
    const map = state.beatMap;

    // Find current beat
    let bi = state.beatIndex;
    while (bi < map.length - 1 && elapsed >= map[bi + 1].time) bi++;
    state.beatIndex = bi;

    if (bi >= map.length) {
      // Song complete
      state.playing = false;
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
      releaseWakeLock();
      showWarning('#4caf50', 'DONE');
      updatePlayBtn();
      $('#perf-scrub').disabled = false;
      return;
    }

    const beat = map[bi];
    const nextBeat = bi + 1 < map.length ? map[bi + 1] : null;
    const beatDuration = nextBeat ? nextBeat.time - beat.time : 60 / beat.tempo;
    const beatProgress = Math.min(1, (elapsed - beat.time) / beatDuration);

    // New beat trigger
    if (bi !== lastBeatIndex) {
      lastBeatIndex = bi;
      onNewBeat(beat, bi);
    }

    // Update subdivision fill
    if (beat.subdivision > 0 && !beat.isFermata) {
      const subIndex = Math.floor(beatProgress * beat.subdivision);
      updateSubdivisionFill(beat.beat, subIndex, beat.subdivision, beat.isDownbeat, beat.isCountIn);

      // Subdivision click
      if (state.audioOn && subIndex > subTick) {
        playClick(600, 0.04);
      }
      subTick = subIndex;
    }

    // Fermata hold progress bar — use holdSeconds directly for accuracy
    if (beat.isFermata && beat.holdSeconds > 0) {
      const w = $('#perf-warning');
      const holdProgress = Math.min(1, (elapsed - beat.time) / beat.holdSeconds);
      const pctFill = holdProgress * 100;
      w.style.background = `linear-gradient(to right, #9c27b0 ${pctFill}%, #3a1050 ${pctFill}%)`;
    }

    // Progress — update scrubber position and label during playback
    const lastBeat = map[map.length - 1];
    const lastBeatDur = lastBeat.isFermata ? lastBeat.holdSeconds : 60 / lastBeat.tempo;
    const totalTime = lastBeat.time + lastBeatDur;
    const scrub = $('#perf-scrub');
    if (scrub && scrub.disabled) {
      const maxBar = parseInt(scrub.max) || 1;
      const currentBar = beat.bar > 0 ? beat.bar : 1;
      scrub.value = Math.min(maxBar, currentBar);
      updateScrubLabel(currentBar, maxBar);
    }

    // "Next" info — auto warnings
    updateNextInfo(beat, map, bi);

    // Check if song is done
    if (elapsed >= totalTime) {
      state.playing = false;
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
      releaseWakeLock();
      showWarning('#4caf50', 'DONE');
      updatePlayBtn();
      $('#perf-scrub').disabled = false;
    }
  }

  function onNewBeat(beat, bi) {
    // Audio click
    if (state.audioOn) {
      if (beat.isDownbeat) playClick(1000, 0.08);
      else playClick(800, 0.06);
    }

    // Downbeat screen pulse
    const perfView = $('#performance-view');
    if (beat.isDownbeat) {
      perfView.classList.remove('downbeat-flash');
      void perfView.offsetWidth; // force reflow to re-trigger animation
      perfView.classList.add('downbeat-flash');
    }

    // Rebuild dots if beats-per-bar or subdivision changed
    if (beat.beatsPerBar !== lastBarBeats || beat.subdivision !== lastSubdiv) {
      buildBeatDots(beat.beatsPerBar, beat.subdivision);
      lastBarBeats = beat.beatsPerBar;
      lastSubdiv = beat.subdivision;
    }

    // Update beat dots
    $$('.beat-dot').forEach(dot => {
      dot.classList.remove('active', 'downbeat', 'count-in-beat');
    });
    // Clear all sub-dots
    $$('.sub-dot').forEach(sd => sd.classList.remove('filled', 'db-sub', 'ci-sub'));

    const activeDot = $(`.beat-dot[data-beat="${beat.beat}"]`);
    if (activeDot) {
      activeDot.classList.add('active');
      if (beat.isDownbeat) activeDot.classList.add('downbeat');
      if (beat.isCountIn) activeDot.classList.add('count-in-beat');
    }
    subTick = 0;

    // Section indicator
    if (beat.isCountIn) {
      $('#perf-section-letter').textContent = '⏱';
      $('#perf-section-label').textContent = 'Count-in';
    } else {
      $('#perf-section-letter').textContent = beat.sectionLetter;
      $('#perf-section-label').textContent = beat.sectionName !== beat.sectionLetter ? beat.sectionName : '';
    }

    // Bar number
    const barEl = $('#perf-bar-number');
    barEl.textContent = beat.isCountIn ? beat.bar : beat.bar;
    barEl.className = 'bar-number' + (beat.isCountIn ? ' count-in-mode' : '');

    // Top tags
    $('#perf-tempo-display').textContent = `♩= ${Math.round(beat.tempo)}`;
    if (beat.keySignature) {
      $('#perf-key').textContent = beat.keySignature;
      $('#perf-key').style.display = '';
    } else {
      $('#perf-key').style.display = 'none';
    }
    const bpb = beat.beatsPerBar;
    // Find denominator for this section
    const sec = state.currentSong?.sections[beat.sectionIndex];
    const den = sec ? sec.timeSignatureDen : 4;
    $('#perf-time-sig').textContent = `${bpb}/${den}`;

    // Warning / Fermata
    if (beat.isFermata) {
      const w = $('#perf-warning');
      w.classList.remove('hidden');
      w.innerHTML = '<span class="warning-label">HOLD</span>';
      w.style.background = 'linear-gradient(to right, #9c27b0 0%, #3a1050 0%)';
    } else if (beat.warningColor) {
      showWarning(beat.warningColor, beat.warningLabel);
    } else {
      hideWarning();
    }
  }

  function updateSubdivisionFill(beatNum, subIndex, subdiv, isDownbeat, isCountIn) {
    const col = $(`.beat-col:nth-child(${beatNum})`);
    if (!col) return;
    const subs = col.querySelectorAll('.sub-dot');
    subs.forEach((sd, i) => {
      sd.classList.toggle('filled', i <= subIndex);
      sd.classList.toggle('db-sub', i <= subIndex && isDownbeat);
      sd.classList.toggle('ci-sub', i <= subIndex && isCountIn);
    });
  }

  function updateNextInfo(currentBeat, map, bi) {
    const song = state.currentSong;
    if (!song || currentBeat.isCountIn) {
      $('#perf-next-info').textContent = '';
      $('#perf-next-info').className = 'perf-next';
      return;
    }

    // Look ahead for section transitions
    const nextEl = $('#perf-next-info');
    const currentSection = currentBeat.sectionIndex;
    const autoWarnBars = song.autoWarningBars || 0;

    // Find if we're near a section change
    let barsUntilChange = null;
    let nextSectionName = '';
    for (let j = bi + 1; j < map.length; j++) {
      if (map[j].sectionIndex !== currentSection && !map[j].isCountIn) {
        // Count bars remaining in current section
        barsUntilChange = map[j].bar - currentBeat.bar;
        nextSectionName = map[j].sectionName;
        break;
      }
    }

    if (barsUntilChange !== null && barsUntilChange <= autoWarnBars && barsUntilChange > 0) {
      nextEl.textContent = `→ ${nextSectionName} in ${barsUntilChange} bar${barsUntilChange > 1 ? 's' : ''}`;
      nextEl.className = 'perf-next imminent';
    } else if (barsUntilChange !== null && barsUntilChange <= autoWarnBars + 2) {
      nextEl.textContent = `Next: ${nextSectionName}`;
      nextEl.className = 'perf-next';
    } else {
      nextEl.textContent = '';
      nextEl.className = 'perf-next';
    }
  }

  /* ====== Tap Tempo ====== */
  const tapState = { times: [], lastTap: 0 };
  const TAP_RESET_MS = 10000;
  const TAP_WINDOW = 6;

  function openTapTempo() {
    $('#tap-tempo-dialog').classList.remove('hidden');
  }
  function closeTapTempo() {
    $('#tap-tempo-dialog').classList.add('hidden');
  }
  function resetTapTempo() {
    tapState.times = [];
    tapState.lastTap = 0;
    renderTapBpm();
  }
  function renderTapBpm() {
    const display = $('#tap-bpm-display');
    if (tapState.times.length < 2) {
      display.textContent = 'Tap…';
      display.className = 'tap-bpm tap-hint';
      return;
    }
    const intervals = [];
    for (let i = 1; i < tapState.times.length; i++) {
      intervals.push(tapState.times[i] - tapState.times[i - 1]);
    }
    const recent = intervals.slice(-TAP_WINDOW);
    const avg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const bpm = Math.round(60000 / avg);
    display.textContent = bpm;
    display.className = 'tap-bpm';
  }

  $('#tap-tempo-btn').addEventListener('click', openTapTempo);
  $('#tap-close-btn').addEventListener('click', closeTapTempo);
  $('#tap-reset-btn').addEventListener('click', resetTapTempo);
  $('#tap-tempo-dialog').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTapTempo();
  });

  $('#tap-btn').addEventListener('click', () => {
    const now = Date.now();
    if (tapState.lastTap && (now - tapState.lastTap) > TAP_RESET_MS) {
      tapState.times = [];
    }
    tapState.times.push(now);
    tapState.lastTap = now;
    // Keep only enough timestamps to compute TAP_WINDOW intervals
    if (tapState.times.length > TAP_WINDOW + 1) {
      tapState.times = tapState.times.slice(-(TAP_WINDOW + 1));
    }
    renderTapBpm();
  });

  /* ====== Import / Export ====== */
  function openIO() { $('#io-dialog').classList.remove('hidden'); }
  function closeIO() { $('#io-dialog').classList.add('hidden'); }

  $('#io-btn').addEventListener('click', openIO);
  $('#io-close-btn').addEventListener('click', closeIO);
  $('#io-dialog').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeIO();
  });

  $('#export-btn').addEventListener('click', () => {
    const json = JSON.stringify(state.songs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `virtual-conductor-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  $('#import-trigger-btn').addEventListener('click', () => {
    $('#import-file').value = '';
    $('#import-file').click();
  });

  $('#import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        let imported = JSON.parse(ev.target.result);
        if (!Array.isArray(imported)) throw new Error('Not an array');
        // Assign fresh IDs and migrate
        imported = imported.map(s => {
          s = migrateSong(JSON.parse(JSON.stringify(s)));
          s.id = uid();
          return s;
        });
        state.songs = state.songs.concat(imported);
        saveSongs();
        renderSongList();
        closeIO();
      } catch {
        alert('Import failed — invalid file.');
      }
    };
    reader.readAsText(file);
  });

  /* ====== Init ====== */
  state.songs = loadSongs();
  renderSongList();

})();
