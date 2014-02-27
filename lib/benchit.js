var util = require('hw-util')
  , fs = require('fs')
  , log4js = require('log4js')
  , NanoTimer = require('nanotimer')
  , defaultConfig = require('./default-config');

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
  that.logger = log4js.getLogger('benchit');
  if (config.log['level']) {
    that.logger.setLevel(config.log['level']);
  }
}

BenchIt.prototype.stop = function (options, callback) {
  var that = this;
  that.stopSignal = true;
};

BenchIt.prototype.run = function (options, callback) {
  var that, logger, jobIndex
    , noStartedJobs, noCompletedJobs, noRunningJobs
    , startTimes, durations, errors, results
    , data, error, statsTimer, timer
    , outHandler, errHandler;
  that = this;
  that.stopSignal = false;
  logger = that.logger;
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
              logger.error(err);
            }
          });
        };
      }
    })();
  }
  logger.info('launching test jobs with : runs=%s, concurrent runs=%s, command="%s"',
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
          logger.warn('max limit of child spawn reached (%s) for job #%s, wait for %s and retry', err.code, jobIndex + 1, options.waitIfCannotSpawn);
          timer.setTimeout(runJob, [jobIndex], options.waitIfCannotSpawn);
        })();
        return;
      } else {
        throw err;
      }
    }
    noRunningJobs++;
    logger.trace('job #%s started', jobIndex);
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
      logger.trace('job #%s completed, total:%s', jobIndex, noCompletedJobs);
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
    logger.info('job stats : started=%s (%s%%), completed=%s (%s%%), running=%s (%s%%)',
      noStartedJobs, Math.round(noStartedJobs * 100 / options.number),
      noCompletedJobs, Math.round(noCompletedJobs * 100 / options.number),
      noRunningJobs, Math.round(noRunningJobs * 100 / options.concurrency)
    );
  }
};

module.exports = BenchIt;