/*
 * FixMe:  Pull out most logic into node-timezones and create a streaming wrapper
 */

var gutil = require('gulp-util');
var _ = require('lodash');
var child_process = require('child_process');
var exec = child_process.exec;
var spawn = child_process.spawn;
var path = require('path');
var vfs = require('vinyl-fs');
var es = require('event-stream');
var glob = require('glob');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var File = require('vinyl');
var Q = require('q');

const PLUGIN_NAME = 'gulp-timezones';

//opts = _.isObject(opts) ? opts : {};
var opts = {};

var stdout = opts.stdout || true; 
var stderr = opts.stderr || true;

var tzs = _.isArray(opts.timezones) ? opts.timezones : require('./timezones.json');
var version = opts.version || 'latest';
var src = opts.src || 'ftp://ftp.iana.org/tz/tzdata-latest.tar.gz';

if (version !== 'latest') {
  src = 'http://www.iana.org/time-zones/repository/releases/tzdata' + version + '.tar.gz' 
}

var tmp = path.resolve('tmp');
var out = path.resolve(tmp, version, 'data.tar.gz');
var zicBase = path.resolve(tmp, 'zic', version);
var zDumpBase = path.resolve(tmp, 'zdump', version);

/*
 *  Data Download
 *    - downloads timezone data from iana.org
 */
function dataDownload() {

  gutil.log('Downloading TimeZone Data from: ' + src);

  mkdirp(path.dirname(out));

  var deferred = Q.defer();

  // curl ftp://ftp.iana.org/tz/tzdata-latest.tar.gz -o ./tmp && cd ./tmp && gzip -dc ./tmp/latest | tar -xf -
  exec('curl ' + src + ' -o ' + out + ' && cd ' + path.dirname(out) + ' && gzip -dc data.tar.gz' + ' | tar -xf -',
    // the largest I've seen on IANA is ~300K Bytes, set to 400K just to be safe
    { maxbuffer: 400 * 1024 }, 
    function(err, stdout, stderr) {
      if (err) { 
        gutil.log(PLUGIN_NAME, err);
        deferred.reject(err); 
      }

      gutil.log('downloaded and unarchived to: ' + out);

      if (opts.stdout) { gutil.log(stdout); }
      if (opts.stderr) { gutil.log(stderr); }

      deferred.resolve();
    }
  );
  return deferred.promise;
}

/*
 *  Data zic
 *    - runs zic command
 */
function dataZic() {
  gutil.log('Compiling data sources with zic(8)');

  mkdirp(zicBase);

  var timezones = _.map(tzs, function(tz) {
    var deferred = Q.defer();
    var src = path.resolve(tmp, version, tz);

    exec('zic -d ' + zicBase + ' ' + src, function(err, stdout, stderr) {
      if (err) {
        gutil.log(PLUGIN_NAME, err);
        return deferred.reject(err); 
      }

      if (opts.stdout) { gutil.log(stdout); }
      if (opts.stderr) { gutil.log(stderr); }

      gutil.log('Compiled zic ' + version + ':' + tz);
      deferred.resolve();
    });
    console.log('returning promise:', deferred.promise);
    return deferred.promise;
  });
  
  console.log(JSON.parse(timezones), null, 2);
  return Q.all(timezones);
}

/*
 *  Data zdump
 *    - zdump's data from zic'd timezone files
 */
function dataZdump() {
  gutil.log('Dumping data with zdump(8).');

  var deferred = Q.defer();
  
  mkdirp(zDumpBase);

  var files = glob(path.join(zicBase + '*'), function(err, files) {
    if (err) { 
      gutil.log(PLUGIN_NAME, err);
      deferred.reject(err);
    }
    return _.map(files, function(file) {

      var zdump = spawn('zdump', ['-v ' + file]);

      if (opts.stderr) {
        zdump.stderr.on('data', function(data) {
          gutil.log(PLUGIN_NAME, zdump.stderr);
        });
      }

      zdump.stdout.on('data', function(data) {
        vfs.dest(
          path.joins(zDumpBase, file) + '.zdump', 
          stdout.replace(new RegExp(zicBase + '/', 'g'), '')
        );
        deferred.resolve();
      });
      return deferred.promise;
    });
  });

  return Q.all(files);
}

function dateCollect() {
  gutil.log('Collect all data from zdump(8) into a single json file.');

  var deferred = Q.defer();

  var files 
}

/*
 *  Cleanup
 *  
 */
function cleanup() {
  gutil.log('Cleaning up and removing', tmp);
  var deferred = Q.deferred();
  rimraf(tmp, function(err) {
    if (err) {
      gutil.log(PLUGIN_NAME, err);
      return deferred.reject(err); 
    }
    deferred.resolve();
  });
  return deferred.promise;
}

dataDownload().then(function() {

  gutil.log('dataDownload Complete!');
  return dataZic().promise;

}).then(function() {

  gutill.log('dataZic Complete!');
  return dataZdump().promise;

}).then(function() {

  gutil.log('dataZdump Complete!');

});

