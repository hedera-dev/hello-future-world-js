#!/bin/bash

DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

source ${DIR}/../.env
curl "${RPC_URL}" \
    -X POST \
    -H "Content-Type: application/json" \
    --data '{"method": "eth_getBlockByNumber", "params": ["latest", false], "id": 1, "jsonrpc": "2.0"}' |
    jq
