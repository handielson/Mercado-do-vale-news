#!/bin/sh
set -eu

cd /var/www/mdv-api

node /var/www/mdv-api/cron/archive-autoresponder-logs.cjs "$@"
