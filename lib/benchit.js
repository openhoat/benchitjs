var util = require('hw-util')
  , log = require('npmlog')
  , fs = require('fs')
  , NanoTimer = require('nanotimer')
  , defaultConfig = require('./default-config');

log.addLevel('trace', 1500, { fg: 'blue', bg: 'black' });

function BenchIt(baseDir, configDir, defaultConfigName) {
  var that, args, config;
  that = this;
  args = util.parseArgs(arguments, [
    { name: 'baseDir', optional: true, type: 'string'},
    { name: 'configDir', optional: true, type: 'string'},
    { name: 'defaultConfigName', optional: true, type: 'string'}
  ]);
  config = util.copyProperties(defaultConfig);
  try {
    util.copyProperties(util.loadConfig(args.configDir, args.defaultConfigName, 2, args.baseDir), config, false);
  } catch (err) {
  }
  that.config = util.configToAbsolutePaths(config, config.baseDir);
  that.log = BenchIt.log;
  that.log.level = that.config.log.level;
}

BenchIt.log = {};
util.copyProperties(log, BenchIt.log, false);
['silly', 'verbose', 'trace', 'info', 'http', 'warn', 'error'].forEach(function (logLevel) {
  BenchIt.log[logLevel] = function () {
    var args, prefix;
    args = Array.prototype.slice.call(arguments);
    prefix = util.format('[%s] [%s] -', util.date.asString(new Date()), 'benchit');
    args.splice(0, 0, prefix);
    return log[logLevel].apply(this, args);
  };
});

BenchIt.prototype.stop = function (options, callback) {
  var that = this;
  that.stopSignal = true;
};

BenchIt.prototype.run = function (options, callback) {
  var that, jobIndex
    , noStartedJobs, noCompletedJobs, noRunningJobs
    , startTimes, durations, errors, results
    , data, error, statsTimer, timer
    , outHandler, errHandler;
  that = this;
  that.stopSignal = false;
  options = options || {};
  options.number = typeof options.number === 'number' ? options.number : 1;
  options.concurrency = typeof options.concurrency === 'number' ? options.concurrency : 1;
  options.waitIfCannotSpawn = options.waitIfCannotSpawn || '1s';
  startTimes = [];
  durations = [];
  errors = [];
  results = [];
  data = {
    durations: durations,
    errors: errors,
    results: results
  };
  error = null;
  noStartedJobs = noCompletedJobs = noRunningJobs = 0;
  timer = new NanoTimer();
  if (options.jobStatsFreq && options.jobStatsFreq.toLowerCase() !== 'off') {
    statsTimer = new NanoTimer();
    statsTimer.setInterval(jobStats, '', options.jobStatsFreq);
  }
  if (options.outputFile) {
    (function () {
      outHandler = fileHandler(options.outputFile + '.out');
      errHandler = fileHandler(options.outputFile + '.err');
      function fileHandler(file) {
        return function (data) {
          fs.appendFile(file, data, function (err) {
            if (err) {
              that.log.error(err);
            }
          });
        };
      }
    })();
  }
  that.log.info('launching test jobs with : runs=%s, concurrent runs=%s, command="%s"',
    options.number,
    options.concurrency,
    options.cmd
  );
  runJobs();

  function runJobs() {
    for (jobIndex = 0; !that.stopSignal && jobIndex < Math.min(options.number, options.concurrency); jobIndex++) {
      if (options.timeBetweenJobsComplete) {
        timer.setTimeout(runJob, [jobIndex], options.timeBetweenJobsComplete);
      } else {
        runJob(jobIndex);
      }
      noStartedJobs++;
    }
  }

  function runJob(jobIndex) {
    startTimes[jobIndex] = process.hrtime();
    try {
      util.exec(options.cmd, options.args, null, runCompleted(jobIndex), outHandler, errHandler);
    } catch (err) {
      if (err.code === 'EAGAIN' || err.code === 'EMFILE') {
        if (that.stopSignal) {
          return;
        }
        (function () {
          that.log.warn('max limit of child spawn reached (%s) for job #%s, wait for %s and retry', err.code, jobIndex + 1, options.waitIfCannotSpawn);
          timer.setTimeout(runJob, [jobIndex], options.waitIfCannotSpawn);
        })();
        return;
      } else {
        throw err;
      }
    }
    noRunningJobs++;
    that.log.trace('job #%s started', jobIndex);
  }

  function runCompleted(jobIndex) {
    return function (err, result) {
      var duration;
      noCompletedJobs++;
      noRunningJobs--;
      errors[jobIndex] = err;
      if (err && !error) {
        error = {
          jobIndex: jobIndex,
          cause: err
        };
      }
      results[jobIndex] = result;
      duration = process.hrtime(startTimes[jobIndex]);
      durations[jobIndex] = duration[0] * 1E3 + Math.round(duration[1] / 1E6);
      that.log.trace('job #%s completed, total:%s', jobIndex, noCompletedJobs);
      if (that.stopSignal || noCompletedJobs === options.number) {
        if (!that.stopSignal && statsTimer) {
          statsTimer.clearInterval();
          jobStats();
        }
        callback(error, data);
        return;
      }
      if (noStartedJobs < options.number) {
        if (options.timeBetweenJobs) {
          timer.setTimeout(runJob, [jobIndex], options.timeBetweenJobs);
        } else {
          runJob(jobIndex);
        }
        noStartedJobs++;
      }
    }
  }

  function jobStats() {
    that.log.info('job stats : started=%s (%s%%), completed=%s (%s%%), running=%s (%s%%)',
      noStartedJobs, Math.round(noStartedJobs * 100 / options.number),
      noCompletedJobs, Math.round(noCompletedJobs * 100 / options.number),
      noRunningJobs, Math.round(noRunningJobs * 100 / options.concurrency)
    );
  }
};

module.exports = BenchIt;