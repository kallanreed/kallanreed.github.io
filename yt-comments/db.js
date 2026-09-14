(function (global) {
  'use strict';

  var DB_NAME = 'yt-comments-cache';
  var DB_VERSION = 1;
  var STORE = 'videos';

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'videoId' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function withStore(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var store = tx.objectStore(STORE);
        var result;
        Promise.resolve(fn(store)).then(function (r) { result = r; }).catch(reject);
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
    });
  }

  function getVideo(videoId) {
    return withStore('readonly', function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.get(videoId);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function putVideo(record) {
    return withStore('readwrite', function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.put(record);
        req.onsuccess = function () { resolve(); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function deleteVideo(videoId) {
    return withStore('readwrite', function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.delete(videoId);
        req.onsuccess = function () { resolve(); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function clearAll() {
    return withStore('readwrite', function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.clear();
        req.onsuccess = function () { resolve(); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  global.CommentDB = {
    getVideo: getVideo,
    putVideo: putVideo,
    deleteVideo: deleteVideo,
    clearAll: clearAll
  };
})(window);
