## What's BenchItjs?

BenchItjs provides a simple way to run load tests.

## Installation

    # npm install benchitjs -g

## How it works?

1. Simply specify the command to run, the number of workers, and the maximum number of concurrent workers
2. Run BenchIt
3. BenchIt starts the maximum allowed concurrent workers
4. Each time a job is completed, then BenchIt spawn another one to keep the specified concurrency
5. When all jobs are completed, BenchIt displays a duration report

## Usage examples :

Bench a simple shell script that does :

    # etc/pause.sh 3
    waiting for 3s... done.

Bench it with 1 request :

    # benchit "pause.sh 3"
    info [2014-02-27 10:05:23.239] [benchit] - job stats : started=0 (0%), completed=0 (0%), running=0 (0%)
    info [2014-02-27 10:05:23.240] [benchit] - launching test jobs with : runs=1, concurrent runs=1, command="pause.sh 3"
    info [2014-02-27 10:05:26.239] [benchit] - job stats : started=1 (100%), completed=0 (0%), running=1 (100%)
    info [2014-02-27 10:05:26.244] [benchit] - job stats : started=1 (100%), completed=1 (100%), running=0 (0%)
    info [2014-02-27 10:05:26.245] [benchit] - duration report (ms) : min=3004, max=3004, average=3004
    info [2014-02-27 10:05:26.245] [benchit] - done

With 100 concurrent runs and a total of 300 runs :

    # benchit -n 300 -c 100 "pause.sh 3"
    info [2014-02-27 10:26:19.614] [benchit] - job stats : started=0 (0%), completed=0 (0%), running=0 (0%)
    info [2014-02-27 10:26:19.615] [benchit] - launching test jobs with : runs=300, concurrent runs=100, command="pause.sh 3"
    info [2014-02-27 10:26:22.614] [benchit] - job stats : started=100 (33%), completed=0 (0%), running=100 (100%)
    info [2014-02-27 10:26:25.614] [benchit] - job stats : started=200 (67%), completed=100 (33%), running=100 (100%)
    info [2014-02-27 10:26:28.614] [benchit] - job stats : started=300 (100%), completed=200 (67%), running=100 (100%)
    info [2014-02-27 10:26:28.769] [benchit] - job stats : started=300 (100%), completed=300 (100%), running=0 (0%)
    info [2014-02-27 10:26:28.770] [benchit] - duration report (ms) : min=3002, max=3005, average=3003
    info [2014-02-27 10:26:28.770] [benchit] - done

Bench your own project mocha test :

    # benchit -n 200 -c 50 -p 5s "mocha -C -t 10000 -R spec myproject/spec/mySpec.js"

Bench a functional web testing scenario with [WebBotjs](https://github.com/openhoat/webbotjs) based on a Google Doc sheet, with a timeout of 20s :

    # benchit -n 10 -c 10 -p 5s "webbot -C -g 0AilC0U4Eb0tjdDRObHlrTDMySms2d0dGZUhWQi10Wmc -i 1 -t 20000"
    info [2014-02-27 10:38:54.532] [benchit] - job stats : started=0 (0%), completed=0 (0%), running=0 (0%)
    info [2014-02-27 10:38:54.533] [benchit] - launching test jobs with : runs=10, concurrent runs=10, command="webbot -g 0AilC0U4Eb0tjdDRObHlrTDMySms2d0dGZUhWQi10Wmc -i 1 -t 20000"
    info [2014-02-27 10:38:57.532] [benchit] - job stats : started=10 (100%), completed=0 (0%), running=10 (100%)
    info [2014-02-27 10:39:00.532] [benchit] - job stats : started=10 (100%), completed=1 (10%), running=9 (90%)
    info [2014-02-27 10:39:03.532] [benchit] - job stats : started=10 (100%), completed=2 (20%), running=8 (80%)
    info [2014-02-27 10:39:06.532] [benchit] - job stats : started=10 (100%), completed=5 (50%), running=5 (50%)
    info [2014-02-27 10:39:08.895] [benchit] - job stats : started=10 (100%), completed=10 (100%), running=0 (0%)
    info [2014-02-27 10:39:08.896] [benchit] - duration report (ms) : min=5407, max=14357, average=11019
    info [2014-02-27 10:39:08.896] [benchit] - done

BenchIt works with any kind of command, give it a try with your favourite one $(^_-)$

Type "benchit --help" for more information about usage

Enjoy !
