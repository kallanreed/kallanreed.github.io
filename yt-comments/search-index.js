(function (global) {
  'use strict';

  var MAX_RESULTS = 200;

  function SearchIndex() {
    this.byId = new Map(); // id -> comment (comment._searchText precomputed)
    this.order = []; // ids in insertion order (roughly fetch/chronological order)
  }

  SearchIndex.prototype.add = function (comment) {
    if (this.byId.has(comment.id)) return;
    comment._searchText = (comment.textDisplay + ' ' + comment.authorDisplayName).toLowerCase();
    this.byId.set(comment.id, comment);
    this.order.push(comment.id);
  };

  SearchIndex.prototype.addAll = function (comments) {
    for (var i = 0; i < comments.length; i++) this.add(comments[i]);
  };

  SearchIndex.prototype.get = function (id) {
    return this.byId.get(id);
  };

  SearchIndex.prototype.size = function () {
    return this.byId.size;
  };

  SearchIndex.prototype.repliesOf = function (threadId) {
    var out = [];
    for (var i = 0; i < this.order.length; i++) {
      var c = this.byId.get(this.order[i]);
      if (c.parentId === threadId) out.push(c);
    }
    out.sort(function (a, b) { return new Date(a.publishedAt) - new Date(b.publishedAt); });
    return out;
  };

  // Live substring search across all indexed comments (top-level and replies).
  // Returns { matches, total, truncated } sorted by likeCount desc.
  SearchIndex.prototype.search = function (query) {
    var q = query.trim().toLowerCase();
    var self = this;
    var all = [];
    if (!q) {
      // No query: show top-level comments, most recent first.
      for (var i = 0; i < this.order.length; i++) {
        var c = this.byId.get(this.order[i]);
        if (!c.parentId) all.push(c);
      }
      all.sort(function (a, b) { return new Date(b.publishedAt) - new Date(a.publishedAt); });
    } else {
      for (var j = 0; j < this.order.length; j++) {
        var cm = this.byId.get(this.order[j]);
        if (cm._searchText.indexOf(q) !== -1) all.push(cm);
      }
      all.sort(function (a, b) { return (b.likeCount || 0) - (a.likeCount || 0); });
    }
    return {
      matches: all.slice(0, MAX_RESULTS),
      total: all.length,
      truncated: all.length > MAX_RESULTS
    };
  };

  global.SearchIndex = SearchIndex;
})(window);
