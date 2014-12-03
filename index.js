'use strict';

var gutil = require('gulp-util');
var _ = require('lodash');
var exec = require('child_process').exec;
var zlib = require('zlib');
var path = require('path');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var Q = require('q');
var tzs = require('./timezones.json');

//module.exports = function(opts) {
  //opts = _.isObject(opts) ? opts : {};
  var opts = {};

  var version = opts.version || 'latest';
  var src = opts.src || version !== 'latest' ? 
    'http://www.iana.org/time-zones/repository/releases/tzdata' + version + '.tar.gz' : 
    'ftp://ftp.iana.org/tz/tzdata-latest.tar.gz';

  var tmp = path.resolve('tmp', version);
  var out = path.resolve(tmp, 'data.tar.gz');


  function dataDownload() {

    gutil.log('Downloading TimeZone Data from: ' + src);

    mkdirp(tmp);

    var deferred = Q.defer();

    exec('curl ' + src + ' -o ' + out + ' && cd ' + tmp + ' && gzip -dc ' + out + ' | tar -xf -', function(err, stdout) {
      if (err) { 
        deferred.reject(err); 
      }
      gutil.log('Downloaded and unarchived to: ' + out);
      deferred.resolve();
    });
    return deferred.promise;
  }

  function dataZic() {

    gutil.log('Compiling data sources with zic(8)');

    var deferred = Q.defer();

    var dest = path.resolve(tmp, version, 'zic');
    mkdirp(dest);
    var tz = tzs.shift();
    var src = path.resolve(tmp, version, tz);

    exec('zic -d ' + dest + ' ' + src, function(err) {
      if (err) { 
        throw err; 
      }
      gutil.log('Compiled zic ' + version + ':' + file);
    }); 
  }

  dataDownload();

//};
