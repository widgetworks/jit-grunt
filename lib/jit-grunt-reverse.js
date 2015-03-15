'use strict';
var fs = require('fs');
var path = require('path');
var reverseRequire = require('reverse-require')();

var PREFIXES = ['', 'grunt-', 'grunt-contrib-'];
var EXTENSIONS = ['.coffee', '.js'];

var jit = {
  pluginsRoot: 'node_modules',
  mappings: {}
};


jit.findUp = function (cwd, iterator) {
  var result = iterator(cwd);
  if (result) {
    return result;
  }
  var parent = path.resolve(cwd, '..');
  return parent !== cwd ? jit.findUp(parent, iterator) : null;
};


jit.findPlugin = function (taskName) {

  // Static Mappings
  if (this._findMapping(taskName)){
    return;
  }

  // Custom Tasks
  if (jit.customTasksDir) {
    if (this._findCustom(taskName)){
      return;
    }
  }

  // Auto Mappings
  if (this._findAuto(taskName)){
    return;
  }

  var log = jit.grunt.log.writeln;
  log();
  log('jit-grunt: Plugin for the "'.yellow + taskName.yellow + '" task not found.'.yellow);
  log('If you have installed the plugin already, please setting the static mapping.'.yellow);
  log('See'.yellow, 'https://github.com/shootaroo/jit-grunt#static-mappings'.cyan);
  log();
};


/**
 * Search the static mapping for the task name
 * and module/file ID.
 *
 * We search for modules in reverse order, starting
 * from the parent module before drilling into
 * children and terminating at the inner project.
 *
 * @param taskName
 * @returns {boolean}
 * @private
 */
jit._findMapping = function(taskName){
  var pluginName, taskPath, loaded = false;

  pluginName = this.mappings[taskName];

  if (!pluginName){
    console.log('Invalid `pluginName` for taskName="%s"', taskName);
  }

  if (pluginName.indexOf('/') >= 0 && pluginName.indexOf('@') !== 0) {
    taskPath = path.resolve(pluginName);
    if (fs.existsSync(taskPath)) {
      jit.loadPlugin(taskName, taskPath, true);
      loaded = true;
    }
  } else {

    var pluginPath = reverseRequire.reverseFind(pluginName);
    taskPath = path.join(pluginPath, 'tasks');


    //var dir = path.join(jit.pluginsRoot, pluginName, 'tasks');
    //taskPath = jit.findUp(path.resolve(), function (cwd) {
    //  var findPath = path.join(cwd, dir);
    //  return fs.existsSync(findPath) ? findPath : null;
    //});


    if (taskPath) {
      jit.loadPlugin(pluginName, taskPath);
      loaded = true;
    }
  }

  return loaded;
};


/**
 * Search the custom task directory for a file
 * matching the task name.
 *
 * Return true if the plugin has been loaded.
 *
 * @param taskName
 * @returns {boolean}
 * @private
 */
jit._findCustom = function(taskName){
  var taskPath,
    loaded = false;

  for (var i = EXTENSIONS.length; i--;) {
    taskPath = path.join(jit.customTasksDir, taskName + EXTENSIONS[i]);
    if (fs.existsSync(taskPath)) {
      jit.loadPlugin(taskName, taskPath, true);
      loaded = true;
      break;
    }
  }

  return loaded;
};


/**
 * Try to infer the name of the plugin
 * based on the name of the task.
 *
 * Return true if the plugin has been loaded.
 *
 * TODO: Need to implement `reverseFind` here too.
 *
 * @param taskName
 * @returns {boolean}
 * @private
 */
jit._findAuto = function(taskName){
  var taskPath, pluginName, loaded = false;

  var dashedName = taskName.replace(/([A-Z])/g, '-$1').replace(/_+/g, '-').toLowerCase();
  taskPath = jit.findUp(path.resolve(), function (cwd) {
    for (var p = PREFIXES.length; p--;) {
      pluginName = PREFIXES[p] + dashedName;
      var findPath = path.join(cwd, jit.pluginsRoot, pluginName, 'tasks');
      if (fs.existsSync(findPath)) {
        return findPath;
      }
    }
  });
  if (taskPath) {
    jit.loadPlugin(pluginName, taskPath);
    loaded = true;
  }
  return loaded;
};


jit.loadPlugin = function (name, path, isFile) {
  var grunt = jit.grunt;
  var _write = grunt.log._write;
  var _nameArgs = grunt.task.current.nameArgs;
  grunt.task.current.nameArgs = 'loading ' + name;
  if (jit.hideHeader) {
    grunt.log._write = function () {};
  }
  grunt.log.header('Loading "' + name + '" plugin');
  grunt.log._write = _write;

  if (isFile) {
    var fn = require(path);
    if (typeof fn === 'function') {
      fn.call(grunt, grunt);
    }
  } else {
    grunt.loadTasks(path);
  }
  grunt.task.current.nameArgs = _nameArgs;
};


jit.proxy = function (name) {
  return {
    task: {
      name: name,
      fn: function () {
        var thing = jit._taskPlusArgs.call(jit.grunt.task, name);
        if (!thing.task) {
          jit.findPlugin(thing.args[0]);
          thing = jit._taskPlusArgs.call(jit.grunt.task, name);
          if (!thing.task) {
            return new Error('Task "' + name + '" failed.');
          }
        }

        this.nameArgs = thing.nameArgs;
        this.name = thing.task.name;
        this.args = thing.args;
        this.flags = thing.flags;
        return thing.task.fn.apply(this, this.args);
      }
    },
    nameArgs: name,
    args: null,
    flags: null
  };
};


module.exports = function factory(grunt, mappings) {
  if (!jit.grunt) {
    jit.grunt = grunt;
    jit.hideHeader = !grunt.option('verbose');

    // Override _taskPlusArgs
    jit._taskPlusArgs = grunt.util.task.Task.prototype._taskPlusArgs;
    grunt.util.task.Task.prototype._taskPlusArgs = jit.proxy;
  }

  for (var key in mappings) {
    if (mappings.hasOwnProperty(key)) {
      jit.mappings[key] = mappings[key];
    }
  }

  return jit;
};
