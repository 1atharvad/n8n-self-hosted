#!/usr/bin/env bash
# usage: wait-for-port.sh <host> <port>
set -e

HOST="$1"
PORT="$2"

echo "Waiting for $HOST:$PORT to be available..."
while ! nc -z "$HOST" "$PORT"; do
    sleep 0.5
done
sleep 1
echo "$HOST:$PORT is up!"
