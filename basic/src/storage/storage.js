// Storage module: localStorage CRUD for .bas programs
const STORAGE_PREFIX = 'basic_file_';
const INDEX_KEY = 'basic_file_index';
const INIT_PREFIX = 'basic_init_';

function getIndex() {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]'); }
  catch { return []; }
}

function setIndex(idx) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
}

export function listFiles() {
  return getIndex().map(name => {
    try {
      const meta = JSON.parse(localStorage.getItem(STORAGE_PREFIX + name) || '{}');
      return { name, modified: meta.modified || 0 };
    } catch { return { name, modified: 0 }; }
  }).sort((a, b) => b.modified - a.modified);
}

export function loadFile(name) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_PREFIX + name));
    return data ? data.source : null;
  } catch { return null; }
}

export function saveFile(name, source) {
  const idx = getIndex();
  if (!idx.includes(name)) { idx.push(name); setIndex(idx); }
  localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify({
    source, modified: Date.now()
  }));
}

export function ensureFile(name, source) {
  if (loadFile(name) !== null) return false;
  saveFile(name, source);
  return true;
}

export function initializeFilesOnce(marker, files) {
  const key = INIT_PREFIX + marker;
  if (localStorage.getItem(key) === '1') {
    return false;
  }

  for (const file of files) {
    saveFile(file.name, file.source);
  }
  localStorage.setItem(key, '1');
  return true;
}

export function deleteFile(name) {
  const idx = getIndex().filter(n => n !== name);
  setIndex(idx);
  localStorage.removeItem(STORAGE_PREFIX + name);
}

export function renameFile(oldName, newName) {
  const source = loadFile(oldName);
  if (source === null) return false;
  saveFile(newName, source);
  deleteFile(oldName);
  return true;
}

export function exportFile(name) {
  const source = loadFile(name);
  if (source === null) return;
  const filename = name.endsWith('.bas') ? name : name + '.bas';
  const blob = new Blob([source], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const opened = window.open(url, '_blank', 'noopener');
  if (opened) {
    opened.document.title = filename;
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}

export function importFile(onImported) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.bas,.txt';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      let name = file.name.replace(/\.(bas|txt)$/i, '').toUpperCase();
      if (!name) name = 'UNTITLED';
      saveFile(name, ev.target.result);
      onImported(name);
    };
    reader.readAsText(file);
  };
  input.click();
}
