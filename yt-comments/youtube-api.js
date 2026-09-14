(function (global) {
  'use strict';

  var API_BASE = 'https://www.googleapis.com/youtube/v3';
  var PAGE_SIZE = 100;

  /* ====== Video ID parsing ====== */
  function extractVideoId(input) {
    if (!input) return null;
    var s = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
    try {
      var url = new URL(s);
      var host = url.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') {
        var seg = url.pathname.split('/').filter(Boolean)[0];
        return seg || null;
      }
      if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
        if (url.searchParams.has('v')) return url.searchParams.get('v');
        var parts = url.pathname.split('/').filter(Boolean);
        // /shorts/<id>, /embed/<id>, /live/<id>
        if (parts.length >= 2 && ['shorts', 'embed', 'live'].indexOf(parts[0]) !== -1) {
          return parts[1];
        }
      }
    } catch (e) {
      // not a URL
    }
    return null;
  }

  /* ====== Error normalization ====== */
  function ApiError(message, reason) {
    this.name = 'ApiError';
    this.message = message;
    this.reason = reason || null;
  }
  ApiError.prototype = Object.create(Error.prototype);

  function buildUrl(path, params) {
    var url = new URL(API_BASE + path);
    Object.keys(params).forEach(function (k) {
      if (params[k] !== undefined && params[k] !== null) url.searchParams.set(k, params[k]);
    });
    return url.toString();
  }

  function request(path, params, signal) {
    var url = buildUrl(path, params);
    return fetch(url, { signal: signal }).then(function (res) {
      if (res.ok) return res.json();
      return res.json().catch(function () { return null; }).then(function (body) {
        var reason = body && body.error && body.error.errors && body.error.errors[0] && body.error.errors[0].reason;
        var message = (body && body.error && body.error.message) || ('HTTP ' + res.status);
        throw new ApiError(message, reason);
      });
    });
  }

  /* ====== Normalization ====== */
  function normalizeSnippet(snippet) {
    return {
      textDisplay: snippet.textDisplay || '',
      authorDisplayName: snippet.authorDisplayName || 'Unknown',
      authorProfileImageUrl: snippet.authorProfileImageUrl || '',
      authorChannelId: (snippet.authorChannelId && snippet.authorChannelId.value) || null,
      likeCount: snippet.likeCount || 0,
      publishedAt: snippet.publishedAt || null,
      updatedAt: snippet.updatedAt || null
    };
  }

  function normalizeTopLevel(item) {
    var tlc = item.snippet.topLevelComment;
    var c = normalizeSnippet(tlc.snippet);
    c.id = tlc.id;
    c.parentId = null;
    c.threadId = item.id;
    c.totalReplyCount = item.snippet.totalReplyCount || 0;
    return c;
  }

  function normalizeReply(item, threadId) {
    var c = normalizeSnippet(item.snippet);
    c.id = item.id;
    c.parentId = item.snippet.parentId;
    c.threadId = threadId;
    return c;
  }

  /* ====== Video metadata ====== */
  function fetchVideoTitle(apiKey, videoId, signal) {
    return request('/videos', { part: 'snippet', id: videoId, key: apiKey }, signal).then(function (data) {
      var item = data.items && data.items[0];
      if (!item) throw new ApiError('Video not found', 'videoNotFound');
      return item.snippet.title;
    });
  }

  /* ====== Fetch all comment threads (top-level comments), paginated ====== */
  // onPage(threads, repliesFromThreads) called after each page fetched.
  function fetchAllCommentThreads(apiKey, videoId, opts) {
    opts = opts || {};
    var order = opts.order || 'time';
    var onPage = opts.onPage || function () {};
    var signal = opts.signal;

    function loop(pageToken, totalFetched) {
      return request('/commentThreads', {
        part: 'snippet,replies',
        videoId: videoId,
        maxResults: PAGE_SIZE,
        order: order,
        textFormat: 'plainText',
        pageToken: pageToken,
        key: apiKey
      }, signal).then(function (data) {
        var items = data.items || [];
        var topLevel = items.map(normalizeTopLevel);
        var inlineReplies = [];
        items.forEach(function (item) {
          if (item.replies && item.replies.comments) {
            item.replies.comments.forEach(function (r) {
              inlineReplies.push(normalizeReply(r, item.id));
            });
          }
        });
        var newTotal = totalFetched + topLevel.length;
        onPage(topLevel, inlineReplies, newTotal, data.pageInfo && data.pageInfo.totalResults);
        if (data.nextPageToken) {
          return loop(data.nextPageToken, newTotal);
        }
        return newTotal;
      });
    }

    return loop(undefined, 0);
  }

  /* ====== Fetch all replies for a given top-level comment ====== */
  function fetchAllReplies(apiKey, threadId, opts) {
    opts = opts || {};
    var onPage = opts.onPage || function () {};
    var signal = opts.signal;

    function loop(pageToken, acc) {
      return request('/comments', {
        part: 'snippet',
        parentId: threadId,
        maxResults: PAGE_SIZE,
        textFormat: 'plainText',
        pageToken: pageToken,
        key: apiKey
      }, signal).then(function (data) {
        var items = (data.items || []).map(function (item) { return normalizeReply(item, threadId); });
        onPage(items);
        var all = acc.concat(items);
        if (data.nextPageToken) return loop(data.nextPageToken, all);
        return all;
      });
    }

    return loop(undefined, []);
  }

  /* ====== One page of replies (for "load more" UI) ====== */
  function fetchRepliesPage(apiKey, threadId, pageToken, signal) {
    return request('/comments', {
      part: 'snippet',
      parentId: threadId,
      maxResults: PAGE_SIZE,
      textFormat: 'plainText',
      pageToken: pageToken,
      key: apiKey
    }, signal).then(function (data) {
      return {
        items: (data.items || []).map(function (item) { return normalizeReply(item, threadId); }),
        nextPageToken: data.nextPageToken || null
      };
    });
  }

  global.YouTubeAPI = {
    ApiError: ApiError,
    extractVideoId: extractVideoId,
    fetchVideoTitle: fetchVideoTitle,
    fetchAllCommentThreads: fetchAllCommentThreads,
    fetchAllReplies: fetchAllReplies,
    fetchRepliesPage: fetchRepliesPage
  };
})(window);
