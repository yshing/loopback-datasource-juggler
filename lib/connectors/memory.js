// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
/* global window:false */
var geo = require('../geo');
exports.applyFilter = applyFilter;

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

Memory.prototype._findAllSkippingIncludes = function(model, filter) {
  var nodes = Object.keys(this.collection(model)).map(function(key) {
    return this.fromDb(model, this.collection(model)[key]);
  }.bind(this));

  if (filter) {
    if (!filter.order) {
      var idNames = this.idNames(model);
      if (idNames && idNames.length) {
        filter.order = idNames;
      }
    }
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
      nodes = nodes.filter(applyFilter(filter));

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


function applyFilter(filter) {
  var where = filter.where;
  if (typeof where === 'function') {
    return where;
  }
  var keys = Object.keys(where);
  return function(obj) {
    return keys.every(function(key) {
      if (key === 'and' || key === 'or') {
        if (Array.isArray(where[key])) {
          if (key === 'and') {
            return where[key].every(function(cond) {
              return applyFilter({where: cond})(obj);
            });
          }
          if (key === 'or') {
            return where[key].some(function(cond) {
              return applyFilter({where: cond})(obj);
            });
          }
        }
      }

      var value = getValue(obj, key);
      // Support referencesMany and other embedded relations
      // Also support array types. Mongo, possibly PostgreSQL
      if (Array.isArray(value)) {
        var matcher = where[key];
        // The following condition is for the case where we are querying with
        // a neq filter, and when the value is an empty array ([]).
        if (matcher.neq !== undefined && value.length <= 0) {
          return true;
        }
        return value.some(function(v, i) {
          var filter = {where: {}};
          filter.where[i] = matcher;
          return applyFilter(filter)(value);
        });
      }

      if (test(where[key], value)) {
        return true;
      }

      // If we have a composed key a.b and b would resolve to a property of an object inside an array
      // then, we attempt to emulate mongo db matching. Helps for embedded relations
      var dotIndex = key.indexOf('.');
      var subValue = obj[key.substring(0, dotIndex)];
      if (dotIndex !== -1) {
        var subFilter = {where: {}};
        var subKey = key.substring(dotIndex + 1);
        subFilter.where[subKey] = where[key];
        if (Array.isArray(subValue)) {
          return subValue.some(applyFilter(subFilter));
        } else if (typeof subValue === 'object' && subValue !== null) {
          return applyFilter(subFilter)(subValue);
        }
      }

      return false;
    });
  };

  function toRegExp(pattern) {
    if (pattern instanceof RegExp) {
      return pattern;
    }
    var regex = '';
    // Escaping user input to be treated as a literal string within a regular expression
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Writing_a_Regular_Expression_Pattern
    pattern = pattern.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
    for (var i = 0, n = pattern.length; i < n; i++) {
      var char = pattern.charAt(i);
      if (char === '\\') {
        i++; // Skip to next char
        if (i < n) {
          regex += pattern.charAt(i);
        }
        continue;
      } else if (char === '%') {
        regex += '.*';
      } else if (char === '_') {
        regex += '.';
      } else if (char === '.') {
        regex += '\\.';
      } else if (char === '*') {
        regex += '\\*';
      } else {
        regex += char;
      }
    }
    return regex;
  }

  function test(example, value) {
    if (typeof value === 'string' && (example instanceof RegExp)) {
      return value.match(example);
    }

    if (example === undefined) {
      return undefined;
    }

    if (typeof example === 'object' && example !== null) {
      if (example.regexp) {
        return value ? value.match(example.regexp) : false;
      }

      // ignore geo near filter
      if (example.near) {
        return true;
      }

      var i;
      if (example.inq) {
        // if (!value) return false;
        for (i = 0; i < example.inq.length; i++) {
          if (example.inq[i] == value) {
            return true;
          }
        }
        return false;
      }

      if (example.nin) {
        for (i = 0; i < example.nin.length; i++) {
          if (example.nin[i] == value) {
            return false;
          }
        }
        return true;
      }

      if ('neq' in example) {
        return compare(example.neq, value) !== 0;
      }

      if ('between' in example) {
        return (testInEquality({gte: example.between[0]}, value) &&
        testInEquality({lte: example.between[1]}, value));
      }

      if (example.like || example.nlike || example.ilike || example.nilike) {
        var like = example.like || example.nlike || example.ilike || example.nilike;
        if (typeof like === 'string') {
          like = toRegExp(like);
        }
        if (example.like) {
          return !!new RegExp(like).test(value);
        }

        if (example.nlike) {
          return !new RegExp(like).test(value);
        }

        if (example.ilike) {
          return !!new RegExp(like, 'i').test(value);
        }

        if (example.nilike) {
          return !new RegExp(like, 'i').test(value);
        }
      }

      if (testInEquality(example, value)) {
        return true;
      }
    }
    // not strict equality
    return (example !== null ? example.toString() : example) ==
      (value != null ? value.toString() : value);
  }

  /**
   * Compare two values
   * @param {*} val1 The 1st value
   * @param {*} val2 The 2nd value
   * @returns {number} 0: =, positive: >, negative <
   * @private
   */
  function compare(val1, val2) {
    if (val1 == null || val2 == null) {
      // Either val1 or val2 is null or undefined
      return val1 == val2 ? 0 : NaN;
    }
    if (typeof val1 === 'number') {
      return val1 - val2;
    }
    if (typeof val1 === 'string') {
      return (val1 > val2) ? 1 : ((val1 < val2) ? -1 : (val1 == val2) ? 0 : NaN);
    }
    if (typeof val1 === 'boolean') {
      return val1 - val2;
    }
    if (val1 instanceof Date) {
      var result = val1 - val2;
      return result;
    }
    // Return NaN if we don't know how to compare
    return (val1 == val2) ? 0 : NaN;
  }

  function testInEquality(example, val) {
    if ('gt' in example) {
      return compare(val, example.gt) > 0;
    }
    if ('gte' in example) {
      return compare(val, example.gte) >= 0;
    }
    if ('lt' in example) {
      return compare(val, example.lt) < 0;
    }
    if ('lte' in example) {
      return compare(val, example.lte) <= 0;
    }
    return false;
  }
}

Memory.prototype.count = function count(model, where, options, callback) {
  var cache = this.collection(model);
  var data = Object.keys(cache);
  if (where) {
    var filter = {where: where};
    data = data.map(function(id) {
      return this.fromDb(model, cache[id]);
    }.bind(this));
    data = data.filter(applyFilter(filter));
  }
  process.nextTick(function() {
    callback(null, data.length);
  });
};



function merge(base, update) {
  if (!base) {
    return update;
  }
  // We cannot use Object.keys(update) if the update is an instance of the model
  // class as the properties are defined at the ModelClass.prototype level
  for (var key in update) {
    var val = update[key];
    if (typeof val === 'function') {
      continue; // Skip methods
    }
    base[key] = val;
  }
  return base;
}

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