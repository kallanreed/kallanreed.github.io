(function () {
  'use strict';

  var APIKEY_KEY = 'yt-cs-apikey';
  var SETTINGS_KEY = 'yt-cs-settings';
  var DEFAULT_SETTINGS = { eagerReplies: false, order: 'time' };

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ====== State ====== */
  var state = {
    apiKey: localStorage.getItem(APIKEY_KEY) || '',
    settings: loadSettings(),
    index: new SearchIndex(),
    videoId: null,
    videoTitle: '',
    fetchController: null,
    view: 'list', // 'list' | 'thread'
    currentThreadId: null,
    currentFocusId: null,
    lastQuery: ''
  };

  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return Object.assign({}, DEFAULT_SETTINGS);
      return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
    } catch (e) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  }

  /* ====== Helpers ====== */
  function showStatus(msg, isError) {
    var el = $('#status-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
    el.classList.toggle('error', !!isError);
  }
  function hideStatus() {
    $('#status-msg').classList.add('hidden');
  }

  function relativeTime(iso) {
    if (!iso) return '';
    var diff = (Date.now() - new Date(iso).getTime()) / 1000;
    var units = [
      ['year', 31536000], ['month', 2592000], ['week', 604800],
      ['day', 86400], ['hour', 3600], ['minute', 60]
    ];
    for (var i = 0; i < units.length; i++) {
      var val = Math.floor(diff / units[i][1]);
      if (val >= 1) return val + units[i][0][0] + ' ago';
    }
    return 'just now';
  }

  function formatCount(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  /* ====== Settings sheet ====== */
  function openSettings() {
    $('#opt-apikey').value = state.apiKey;
    $('#opt-eager-replies').checked = state.settings.eagerReplies;
    $('#opt-order').value = state.settings.order;
    $('#settings-sheet').classList.add('open');
    $('#sheet-scrim').classList.remove('hidden');
  }
  function closeSettings() {
    state.apiKey = $('#opt-apikey').value.trim();
    localStorage.setItem(APIKEY_KEY, state.apiKey);
    state.settings.eagerReplies = $('#opt-eager-replies').checked;
    state.settings.order = $('#opt-order').value;
    saveSettings();
    $('#settings-sheet').classList.remove('open');
    $('#sheet-scrim').classList.add('hidden');
  }

  /* ====== Comment rendering ====== */
  function renderTextWithHighlight(container, text, query) {
    container.textContent = '';
    if (!query) { container.appendChild(document.createTextNode(text)); return; }
    var lower = text.toLowerCase();
    var q = query.toLowerCase();
    var idx = 0;
    var pos;
    while ((pos = lower.indexOf(q, idx)) !== -1) {
      if (pos > idx) container.appendChild(document.createTextNode(text.slice(idx, pos)));
      var mark = document.createElement('mark');
      mark.textContent = text.slice(pos, pos + q.length);
      container.appendChild(mark);
      idx = pos + q.length;
    }
    if (idx < text.length) container.appendChild(document.createTextNode(text.slice(idx)));
  }

  function buildCommentCard(comment, opts) {
    opts = opts || {};
    var card = document.createElement(opts.tag || 'div');
    card.className = 'comment-card' + (opts.highlight ? ' highlight' : '') + (opts.clickable ? ' clickable' : '');
    card.dataset.id = comment.id;

    var head = document.createElement('div');
    head.className = 'comment-head';

    if (comment.authorProfileImageUrl) {
      var img = document.createElement('img');
      img.className = 'avatar';
      img.src = comment.authorProfileImageUrl;
      img.alt = '';
      img.loading = 'lazy';
      head.appendChild(img);
    }

    var meta = document.createElement('div');
    meta.className = 'comment-meta';
    var author = document.createElement('span');
    author.className = 'author';
    author.textContent = comment.authorDisplayName;
    var time = document.createElement('span');
    time.className = 'time';
    time.textContent = relativeTime(comment.publishedAt);
    meta.appendChild(author);
    meta.appendChild(time);
    head.appendChild(meta);
    card.appendChild(head);

    var body = document.createElement('div');
    body.className = 'comment-text';
    renderTextWithHighlight(body, comment.textDisplay, opts.query);
    card.appendChild(body);

    var footer = document.createElement('div');
    footer.className = 'comment-footer';
    var likes = document.createElement('span');
    likes.className = 'likes';
    likes.textContent = '♡ ' + formatCount(comment.likeCount || 0);
    footer.appendChild(likes);
    if (!comment.parentId && comment.totalReplyCount > 0) {
      var replies = document.createElement('span');
      replies.className = 'reply-count';
      replies.textContent = comment.totalReplyCount + (comment.totalReplyCount === 1 ? ' reply' : ' replies');
      footer.appendChild(replies);
    }
    card.appendChild(footer);

    return card;
  }

  /* ====== Search / list view ====== */
  function runSearch() {
    var query = $('#search-input').value;
    state.lastQuery = query;
    var result = state.index.search(query);
    renderResults(result, query);
  }

  function renderResults(result, query) {
    var list = $('#results-list');
    list.textContent = '';
    var frag = document.createDocumentFragment();
    result.matches.forEach(function (comment) {
      var li = document.createElement('li');
      var card = buildCommentCard(comment, { clickable: true, query: query });
      li.appendChild(card);
      li.addEventListener('click', function () { openThread(comment.id); });
      frag.appendChild(li);
    });
    list.appendChild(frag);

    $('#list-empty').classList.toggle('hidden', result.total > 0);
    var countEl = $('#search-count');
    if (state.index.size() === 0) {
      countEl.textContent = '';
    } else if (result.truncated) {
      countEl.textContent = 'Showing top ' + result.matches.length + ' of ' + result.total + ' matches';
    } else {
      countEl.textContent = result.total + (result.total === 1 ? ' match' : ' matches');
    }
  }

  /* ====== Thread (drill-down) view ====== */
  function openThread(commentId) {
    var comment = state.index.get(commentId);
    if (!comment) return;
    var topLevelId = comment.parentId || comment.id;
    state.currentThreadId = topLevelId;
    state.currentFocusId = commentId;
    state.view = 'thread';
    $('#list-view').classList.add('hidden');
    $('#thread-view').classList.remove('hidden');
    renderThread();
  }

  function closeThread() {
    state.view = 'list';
    $('#thread-view').classList.add('hidden');
    $('#list-view').classList.remove('hidden');
  }

  function renderThread() {
    var top = state.index.get(state.currentThreadId);
    if (!top) return closeThread();
    var replies = state.index.repliesOf(top.id);

    var body = $('#thread-body');
    body.textContent = '';

    body.appendChild(buildCommentCard(top, { highlight: state.currentFocusId === top.id }));

    var repliesWrap = document.createElement('div');
    repliesWrap.className = 'thread-replies';

    var label = document.createElement('div');
    label.className = 'thread-replies-label';
    label.textContent = replies.length + ' of ' + (top.totalReplyCount || 0) + ' replies loaded';
    repliesWrap.appendChild(label);

    replies.forEach(function (r) {
      var wrap = document.createElement('div');
      wrap.className = 'reply-wrap';
      wrap.appendChild(buildCommentCard(r, { highlight: state.currentFocusId === r.id }));
      repliesWrap.appendChild(wrap);
    });

    if (replies.length < (top.totalReplyCount || 0)) {
      var loadBtn = document.createElement('button');
      loadBtn.className = 'btn load-more-replies';
      loadBtn.textContent = 'Load ' + (top.totalReplyCount - replies.length) + ' more ' +
        (top.totalReplyCount - replies.length === 1 ? 'reply' : 'replies');
      loadBtn.addEventListener('click', function () { loadMoreReplies(top, loadBtn); });
      repliesWrap.appendChild(loadBtn);
    }

    body.appendChild(repliesWrap);

    if (state.currentFocusId !== top.id) {
      var focusEl = body.querySelector('.highlight');
      if (focusEl) focusEl.scrollIntoView({ block: 'center' });
    } else {
      body.scrollTop = 0;
    }
  }

  function loadMoreReplies(top, btn) {
    if (!state.apiKey) { showStatus('Add your API key in Settings first.', true); return; }
    btn.disabled = true;
    btn.textContent = 'Loading…';
    YouTubeAPI.fetchAllReplies(state.apiKey, top.id, {
      onPage: function (items) {
        state.index.addAll(items);
        persistCache();
      }
    }).then(function () {
      renderThread();
    }).catch(function (err) {
      showStatus('Failed to load replies: ' + err.message, true);
      btn.disabled = false;
      btn.textContent = 'Retry';
    });
  }

  /* ====== Fetch / load flow ====== */
  function persistCache() {
    CommentDB.putVideo({
      videoId: state.videoId,
      videoTitle: state.videoTitle,
      order: state.settings.order,
      fetchedAt: Date.now(),
      comments: Array.from(state.index.byId.values()).map(stripSearchText)
    }).catch(function () { /* non-fatal */ });
  }

  function stripSearchText(c) {
    var copy = {};
    for (var k in c) if (k !== '_searchText') copy[k] = c[k];
    return copy;
  }

  function resetForNewVideo() {
    state.index = new SearchIndex();
    state.view = 'list';
    $('#thread-view').classList.add('hidden');
    $('#list-view').classList.remove('hidden');
    $('#search-input').value = '';
  }

  function showLoadedUI() {
    $('#video-meta').classList.remove('hidden');
    $('#video-title').textContent = state.videoTitle || state.videoId;
    $('#search-bar').classList.remove('hidden');
    $('#content').classList.remove('hidden');
    runSearch();
  }

  function setProgress(current, total) {
    var wrap = $('#progress-wrap');
    wrap.classList.remove('hidden');
    var pct = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
    $('#progress-fill').style.width = pct + '%';
    $('#progress-text').textContent = total
      ? ('Fetched ' + formatCount(current) + ' of ~' + formatCount(total) + ' comments…')
      : ('Fetched ' + formatCount(current) + ' comments…');
  }

  function hideProgress() {
    $('#progress-wrap').classList.add('hidden');
  }

  function loadFromCache(record) {
    state.videoId = record.videoId;
    state.videoTitle = record.videoTitle;
    resetForNewVideo();
    state.index.addAll(record.comments);
    showLoadedUI();
    showStatus('Loaded ' + formatCount(state.index.size()) + ' cached comments from ' + relativeTime(new Date(record.fetchedAt).toISOString()) + '.');
  }

  function fetchFresh(videoId) {
    if (!state.apiKey) {
      showStatus('Add your YouTube Data API key in Settings (⚙) first.', true);
      openSettings();
      return;
    }
    if (state.fetchController) state.fetchController.abort();
    var controller = new AbortController();
    state.fetchController = controller;

    resetForNewVideo();
    state.videoId = videoId;
    hideStatus();
    $('#progress-wrap').classList.remove('hidden');
    setProgress(0, null);
    $('#cancel-fetch-btn').classList.remove('hidden');

    YouTubeAPI.fetchVideoTitle(state.apiKey, videoId, controller.signal)
      .then(function (title) {
        state.videoTitle = title;
        $('#video-meta').classList.remove('hidden');
        $('#video-title').textContent = title;
        return YouTubeAPI.fetchAllCommentThreads(state.apiKey, videoId, {
          order: state.settings.order,
          signal: controller.signal,
          onPage: function (topLevel, inlineReplies, fetchedCount, totalResults) {
            state.index.addAll(topLevel);
            state.index.addAll(inlineReplies);
            setProgress(fetchedCount, totalResults);
            runSearch();
            if (state.settings.eagerReplies) {
              return fetchEagerReplies(topLevel, controller.signal);
            }
          }
        });
      })
      .then(function () {
        hideProgress();
        $('#content').classList.remove('hidden');
        $('#search-bar').classList.remove('hidden');
        runSearch();
        persistCache();
        showStatus('Loaded ' + formatCount(state.index.size()) + ' comments.');
      })
      .catch(function (err) {
        hideProgress();
        if (err && err.name === 'AbortError') {
          showStatus('Fetch cancelled — ' + formatCount(state.index.size()) + ' comments loaded so far.');
          $('#content').classList.remove('hidden');
          $('#search-bar').classList.remove('hidden');
          runSearch();
          if (state.index.size() > 0) persistCache();
          return;
        }
        var msg = describeError(err);
        showStatus(msg, true);
      })
      .then(function () { state.fetchController = null; });
  }

  function fetchEagerReplies(topLevelComments, signal) {
    var withReplies = topLevelComments.filter(function (c) {
      var loaded = state.index.repliesOf(c.id).length;
      return c.totalReplyCount > loaded;
    });
    var i = 0;
    function next() {
      if (i >= withReplies.length) return Promise.resolve();
      var c = withReplies[i++];
      return YouTubeAPI.fetchAllReplies(state.apiKey, c.id, {
        signal: signal,
        onPage: function (items) { state.index.addAll(items); }
      }).then(next);
    }
    return next();
  }

  function describeError(err) {
    if (err instanceof YouTubeAPI.ApiError || (err && err.reason)) {
      switch (err.reason) {
        case 'keyInvalid': return 'That API key was rejected. Check it in Settings.';
        case 'quotaExceeded': return 'YouTube API quota exceeded for today. Try again later.';
        case 'commentsDisabled': return 'Comments are disabled on this video.';
        case 'videoNotFound': return 'Video not found.';
        default: return err.message || 'Something went wrong fetching comments.';
      }
    }
    return (err && err.message) || 'Something went wrong fetching comments.';
  }

  function handleLoad() {
    var raw = $('#video-input').value;
    var videoId = YouTubeAPI.extractVideoId(raw);
    if (!videoId) {
      showStatus('Could not recognize that as a YouTube video URL or ID.', true);
      return;
    }
    hideStatus();
    CommentDB.getVideo(videoId).then(function (cached) {
      if (cached && cached.order === state.settings.order && cached.comments.length) {
        loadFromCache(cached);
      } else {
        fetchFresh(videoId);
      }
    }).catch(function () {
      fetchFresh(videoId);
    });
  }

  function handleRefresh() {
    if (!state.videoId) return;
    fetchFresh(state.videoId);
  }

  function handleClearCache() {
    CommentDB.clearAll().then(function () {
      showStatus('Cache cleared.');
    });
  }

  /* ====== Wiring ====== */
  function init() {
    $('#load-form').addEventListener('submit', function (e) {
      e.preventDefault();
      handleLoad();
    });
    $('#refresh-btn').addEventListener('click', handleRefresh);
    $('#cancel-fetch-btn').addEventListener('click', function () {
      if (state.fetchController) state.fetchController.abort();
    });
    $('#search-input').addEventListener('input', runSearch);
    $('#thread-back-btn').addEventListener('click', closeThread);

    $('#settings-btn').addEventListener('click', openSettings);
    $('#settings-close-btn').addEventListener('click', closeSettings);
    $('#sheet-scrim').addEventListener('click', closeSettings);
    $('#clear-cache-btn').addEventListener('click', handleClearCache);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if ($('#settings-sheet').classList.contains('open')) closeSettings();
        else if (state.view === 'thread') closeThread();
      }
    });

    if (!state.apiKey) {
      showStatus('Add your YouTube Data API key in Settings (⚙) to get started.');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
