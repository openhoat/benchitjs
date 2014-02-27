#!/bin/bash

duration=$1

if [[ ! -z ${duration} ]]; then
    echo "waiting for ${duration}s... " 1>&2
    sleep ${duration}
fi
echo "done."