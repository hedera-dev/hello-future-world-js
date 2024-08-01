#!/bin/bash

DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

cd ${DIR}/..
npm install
[ ! -f .env ] && cp .env.sample .env
[ ! -f .rpcrelay.env ] && cp .rpcrelay.env.sample .rpcrelay.env
[ ! -f logger.json ] && cp logger.json.sample logger.json

cd ${DIR}

# initialise a `.env` file
# for use in the application being built
node ${DIR}/01-dotenv-app.js

# initialise a `.rpcrelay.env` file
# for use by the RPC relay server to initialise with
node ${DIR}/02-dotenv-rpcrelay.js
