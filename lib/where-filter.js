'use strict';
function whereFilter(filter) {
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
              return whereFilter({where: cond})(obj);
            });
          }
          if (key === 'or') {
            return where[key].some(function(cond) {
              return whereFilter({where: cond})(obj);
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
          return whereFilter(filter)(value);
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
          return subValue.some(whereFilter(subFilter));
        } else if (typeof subValue === 'object' && subValue !== null) {
          return whereFilter(subFilter)(subValue);
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
module.exports = whereFilter;
