'use strict';
var jitGruntReverse = require('./lib/jit-grunt-reverse');
var path = require('path');

module.exports = function (grunt, mappings) {
  var jit = jitGruntReverse(grunt, mappings);
  return function (options) {
    options = options || {};

    if (options.loadTasks) {
      jit.customTasksDir = path.resolve(options.loadTasks);
    }

    if (options.customTasksDir) {
      jit.customTasksDir = path.resolve(options.customTasksDir);
    }

    if (options.pluginsRoot) {
      jit.pluginsRoot = options.pluginsRoot;
    }
  };
};
