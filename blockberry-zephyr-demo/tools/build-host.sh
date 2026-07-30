#!/usr/bin/env sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_root"

export ZEPHYR_TOOLCHAIN_VARIANT=host

exec west build -p always \
  -d build-native \
  -b native_sim/native/64 \
  blockberry-zephyr-demo -- \
  -DEXTRA_CONF_FILE=configs/host.conf "$@"
