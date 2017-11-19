// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
/* global window:false */
var geo = require('../geo');
var whereFilter = require('../where-filter')

function getValue(obj, path) {
  if (obj == null) {
    return undefined;
  }
  var keys = path.split('.');
  var val = obj;
  for (var i = 0, n = keys.length; i < n; i++) {
    val = val[keys[i]];
    if (val == null) {
      return val;
    }
  }
  return val;
}

function applyLoopbackFilter(originNodes, filter) {
  // Copy Origin Nodes (array) and let it thorw if not array like ane slice-able
  var nodes = originNodes.slice(0);

  if (filter) {
    // do we need some sorting?
    if (filter.order) {
      var orders = filter.order;
      if (typeof filter.order === 'string') {
        orders = [filter.order];
      }
      orders.forEach(function(key, i) {
        var reverse = 1;
        var m = key.match(/\s+(A|DE)SC$/i);
        if (m) {
          key = key.replace(/\s+(A|DE)SC/i, '');
          if (m[1].toLowerCase() === 'de') reverse = -1;
        }
        orders[i] = {'key': key, 'reverse': reverse};
      });
      nodes = nodes.sort(sorting.bind(orders));
    }

    var nearFilter = geo.nearFilter(filter.where);

    // geo sorting
    if (nearFilter) {
      nodes = geo.filter(nodes, nearFilter);
    }

    // do we need some filtration?
    if (filter.where && nodes)
      nodes = nodes.filter(whereFilter(filter));

    // field selection
    if (filter.fields) {
      nodes = nodes.map(selectFields(filter.fields));
    }

    // limit/skip
    var skip = filter.skip || filter.offset || 0;
    var limit = filter.limit || nodes.length;
    nodes = nodes.slice(skip, skip + limit);
  }
  return nodes;

  function sorting(a, b) {
    var undefinedA, undefinedB;

    for (var i = 0, l = this.length; i < l; i++) {
      var aVal = getValue(a, this[i].key);
      var bVal = getValue(b, this[i].key);
      undefinedB = bVal === undefined && aVal !== undefined;
      undefinedA = aVal === undefined && bVal !== undefined;

      if (undefinedB || aVal > bVal) {
        return 1 * this[i].reverse;
      } else if (undefinedA || aVal < bVal) {
        return -1 * this[i].reverse;
      }
    }

    return 0;
  }
};

function selectFields(fields) {
  // map function
  return function (obj) {
    var result = {};
    var key;

    for (var i = 0; i < fields.length; i++) {
      key = fields[i];

      result[key] = obj[key];
    }
    return result;
  };
}
exports = applyLoopbackFilter;
