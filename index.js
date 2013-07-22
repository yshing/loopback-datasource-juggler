var fs = require('fs');
var path = require('path');

exports.ModelBuilder = exports.LDL = require('./lib/model-builder').ModelBuilder;
exports.DataSource = exports.Schema = require('./lib/datasource').DataSource;
exports.ModelBaseClass = require('./lib/model.js');

var baseSQL = './lib/sql';

exports.__defineGetter__('BaseSQL', function () {
    return require(baseSQL);
});


exports.__defineGetter__('version', function () {
    return JSON.parse(fs.readFileSync(__dirname + '/package.json')).version;
});

var commonTest = './test/common_test';
exports.__defineGetter__('test', function () {
    return require(commonTest);
});
