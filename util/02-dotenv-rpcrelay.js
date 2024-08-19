#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const dotenv = require('dotenv');
const { PrivateKey } = require('@hashgraph/sdk');
const { createLogger } = require('../util/util.js');

let logger;

const DEFAULT_VALUES = {
  dotEnvFilePath: path.resolve(__dirname, '../.rpcrelay.env'),
  appDotEnvFilePath: path.resolve(__dirname, '../.env'),
};

async function initDotEnvForRpcRelay() {
  logger = await createLogger({
    scriptId: 'initDotEnvForRpcRelay',
    scriptCategory: 'setup',
  });
  logger.logStart(
    'Hello Future World - Initialise RPC Relay .env file - start',
  );

  // read in initial values for env variables that have been set
  dotenv.config({ path: DEFAULT_VALUES.appDotEnvFilePath });
  const { OPERATOR_ACCOUNT_PRIVATE_KEY, OPERATOR_ACCOUNT_ID } = process.env;

  const operatorId = OPERATOR_ACCOUNT_ID;
  let operatorKey = OPERATOR_ACCOUNT_PRIVATE_KEY;

  if (!operatorId) {
    console.error('Must define operator ID');
    return;
  }

  // convert operatorKey from Hex encoded format to DER encoded format
  operatorKey = PrivateKey.fromStringECDSA(operatorKey).toStringDer();

  const dotEnvText = `HEDERA_NETWORK=testnet
OPERATOR_ID_MAIN=${operatorId}
OPERATOR_KEY_MAIN=${operatorKey}
CHAIN_ID=0x128
MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com/
`;

  const fileName = DEFAULT_VALUES.dotEnvFilePath;
  await fs.writeFile(fileName, dotEnvText);

  logger.log('OK, wrote .rpcrelay.env file');
  logger.logComplete(
    'Hello Future World - Initialise RPC Relay .env file - complete',
  );
}

initDotEnvForRpcRelay().catch((ex) => {
  logger ? logger.logError(ex) : console.error(ex);
});
