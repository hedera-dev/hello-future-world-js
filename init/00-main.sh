#!/bin/bash

# initialise a `.env` file
# for use in the application being built
node ./00-main-setup-app.js

# initialise a `.rpcrelay.env` file
# for use by the RPC relay server to initialise with
node ./00-main-setup-rpcrelay.js
