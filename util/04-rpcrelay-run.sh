#!/bin/bash

DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# get specific tag name for latest RPC relay
export RPC_RELAY_VERSION=$( curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/hashgraph/hedera-json-rpc-relay/releases?per_page=1" |
  jq -r ".[].tag_name" |
  cut -c2-
)
echo "🟣 RPC Relay version: ${RPC_RELAY_VERSION}"
export RPC_RELAY_DOCKER_IMAGE="ghcr.io/hashgraph/hedera-json-rpc-relay:${RPC_RELAY_VERSION}"

# run the RPC relay via its docker image
docker run \
  --rm \
  --publish 7546:7546 \
  --publish 8546:8546 \
  --publish 8547:8547 \
  --env-file ${DIR}/../.rpcrelay.env \
  "${RPC_RELAY_DOCKER_IMAGE}"
