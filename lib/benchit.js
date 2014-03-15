var util = require('hw-util')
  , fs = require('fs')
  , NanoTimer = require('nanotimer')
  , Q = require('q')
  , hwLogger = require('hw-logger')
  , defaultConfig = require('./default-config')
  , logger = hwLogger.logger;

function BenchIt(baseDir, configDir, defaultConfigName) {
  var that, args;
  that = this;
  args = util.parseArgs(arguments, [
    { name: 'baseDir', optional: true, type: 'string'},
    { name: 'configDir', optional: true, type: 'string'},
    { name: 'defaultConfigName', optional: true, type: 'string'}
  ]);
  that.config = util.copyProperties(defaultConfig);
  try {
    util.copyProperties(util.loadConfig({ configDir: args.configDir, defaultConfigName: args.defaultConfigName, depth: 2, baseDir: args.baseDir }), that.config, false);
  } catch (err) {
  }
  util.configToAbsolutePaths(that.config, that.config.baseDir);
  if (that.config.log) {
    hwLogger.init(that.config.log);
  }
}

BenchIt.prototype.stop = function (options, callback) {
  var that = this;
  that.stopSignal = true;
};

BenchIt.prototype.run = function (options, callback) {
  var that, jobIndex
    , noStartedJobs, noCompletedJobs, noRunningJobs
    , startTimes, durations, errors, results
    , data, error, statsTimer, timer;
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
    var childEnv, childOutStream, childErrStream, childOutHandler, childErrHandler;
    logger.trace('starting job#%s', jobIndex + 1);
    childEnv = process.env;
    childEnv[options.jobName] = util.format('BenchIt job#%s', (jobIndex + 1));
    if (options.outputFile) {
      childOutStream = fs.createWriteStream(util.format('%s-%s.out', options.outputFile, jobIndex + 1));
      childOutHandler = function (data) {
        childOutStream.write(data);
      };
      childErrStream = fs.createWriteStream(util.format('%s-%s.err', options.outputFile, jobIndex + 1));
      childErrHandler = function (data) {
        childErrStream.write(data);
      };
    }
    startTimes[jobIndex] = process.hrtime();
    try {
      util.exec(options.cmd, options.args, childEnv, runCompleted(jobIndex, childOutStream, childErrStream), childOutHandler, childErrHandler);
    } catch (err) {
      if (err.code === 'EAGAIN' || err.code === 'EMFILE') {
        if (that.stopSignal) {
          return;
        }
        (function () {
          logger.warn('max limit of child spawn reached (%s) for job#%s, wait for %s and retry', err.code, jobIndex + 1, options.waitIfCannotSpawn);
          timer.setTimeout(runJob, [jobIndex], options.waitIfCannotSpawn);
        })();
        return;
      } else {
        throw err;
      }
    }
    noRunningJobs++;
    logger.trace('job#%s started', jobIndex + 1);
  }

  function runCompleted(jobIndex, childOutStream, childErrStream) {
    return function (err, result) {
      var duration;
      if (childOutStream) {
        childOutStream.close();
      }
      if (childOutStream) {
        childErrStream.close();
      }
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
      logger.trace('job#%s completed, total:%s', jobIndex + 1, noCompletedJobs);
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
          timer.setTimeout(runJob, [noStartedJobs], options.timeBetweenJobs);
        } else {
          runJob(noStartedJobs);
        }
        noStartedJobs++;
      }
    }
  }

  function jobStats() {
    logger.info('stats : started=%s (%s%%), completed=%s (%s%%), running=%s (%s%%)',
      noStartedJobs, Math.round(noStartedJobs * 100 / options.number),
      noCompletedJobs, Math.round(noCompletedJobs * 100 / options.number),
      noRunningJobs, Math.round(noRunningJobs * 100 / options.concurrency)
    );
  }
};

module.exports = BenchIt;