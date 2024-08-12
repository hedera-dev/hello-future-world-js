#!/bin/bash

DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# install main dependencies
echo "Installing main dependencies…"
cd ${DIR}/..
npm install

if command -v "gp" &> /dev/null
then
  gp sync-done get_dependencies_base
fi

# install additional dependencies, if defined by project
cd ${DIR}
[ -f ./03b-get-additional-dependencies.sh ] && ./03b-get-additional-dependencies.sh

# get specific tag name for latest RPC relay
cd ${DIR}
export RPC_RELAY_VERSION=$( curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/hashgraph/hedera-json-rpc-relay/releases?per_page=1" |
  jq -r ".[].tag_name" |
  cut -c2-
)
echo "RPC Relay version: ${RPC_RELAY_VERSION}"
export RPC_RELAY_DOCKER_IMAGE="ghcr.io/hashgraph/hedera-json-rpc-relay:${RPC_RELAY_VERSION}"

# run the RPC relay via its docker image
docker pull \
  "${RPC_RELAY_DOCKER_IMAGE}"
