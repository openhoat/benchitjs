#!/bin/bash

pause=$1
if [[ -z $pause ]]; then
  pause=1
fi

echo -n "waiting for ${pause}s... "
sleep ${pause}
echo "done."