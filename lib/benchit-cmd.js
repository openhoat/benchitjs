var program = require('commander')
  , path = require('path')
  , ss = require('simple-statistics')
  , BenchIt = require('../lib/benchit')
  , pkg = require('../package')
  , options, bench, log;

program.name = 'benchit';

program.
  version(pkg.version).
  usage('[options] "command args ..."').
  option('-n, --number <n>', 'number of runs (default : 1)', parseInt, 1).
  option('-c, --concurrency <n>', 'number of concurrent runs (default : 1)', parseInt, 1).
  option('-l, --loglevel <silly|verbose|trace|info|http|warn|error|silent>', 'Log level (silent to disable)', 'info').
  option('-o, --output <file>', 'output results into file').
  option('-s, --stats <time>', 'frequency for stats display (time : number plus unity letter or "off", default : 3s)', '3s').
  option('-t, --jobsinterval <time>', 'pause between jobs start (default : 1u)', '1u').
  option('-i, --completeinterval <time>', 'pause between jobs start after complete (default : 1u)', '1u').
  option('-p, --waitspawn <time>', 'waiting duration if spawn limit reached (default : 1s)', '1s').
  parse(process.argv);

if (!program.args.length) {
  program.outputHelp();
  process.exit(1);
  return;
}

options = {
  cmd: program.args[0],
  concurrency: program.concurrency,
  number: program.number,
  jobStatsFreq: program.stats,
  timeBetweenJobs: program.timeBetweenJobs,
  timeBetweenJobsComplete: program.timeBetweenJobsComplete,
  waitIfCannotSpawn: program.waitspawn,
  outputFile: program.output
};
bench = new BenchIt(path.join(__dirname, '..'));
log = bench.log;
log.level = program.loglevel;

process.on('SIGINT', function () {
  log.warn('received SIGINT signal : stop bench.');
  bench.stop();
});

bench.run(options, function (err, data) {
  log.info('duration report (ms) : min=%s, max=%s, average=%s',
    ss.min(data.durations),
    ss.max(data.durations),
    Math.round(ss.average(data.durations))
  );
  done(err);
});

function done(err) {
  if (err) {
    log.error('Error :', err);
    process.exit(1);
    return;
  }
  log.info('done');
}