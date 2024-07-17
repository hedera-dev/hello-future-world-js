#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const dotenv = require('dotenv');
const {
    PrivateKey,
} = require('@hashgraph/sdk');
const {
    metricsTrackOnHcs,
} = require('../util/util.js');

const DEFAULT_VALUES = {
    dotEnvFilePath: path.resolve(__dirname, '../.rpcrelay.env'),
    appDotEnvFilePath: path.resolve(__dirname, '../.env'),
};

async function initDotEnvForRpcRelay() {
    metricsTrackOnHcs('initDotEnvForRpcRelay', 'begin');

    // read in initial values for env variables that have been set
    dotenv.config({ path: DEFAULT_VALUES.appDotEnvFilePath });
    const {
        OPERATOR_ACCOUNT_PRIVATE_KEY,
        OPERATOR_ACCOUNT_ID,
    } = process.env;

    const operatorId = OPERATOR_ACCOUNT_ID;
    let operatorKey = OPERATOR_ACCOUNT_PRIVATE_KEY;

    if (!operatorId) {
        console.error('Must define operator ID');
        return;
    }

    // convert operatorKey from Hex encoded format to DER encoded format
    operatorKey = PrivateKey.fromStringECDSA(operatorKey).toStringDer();

const dotEnvText =
`HEDERA_NETWORK=testnet
OPERATOR_ID_MAIN=${operatorId}
OPERATOR_KEY_MAIN=${operatorKey}
CHAIN_ID=0x128
MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com/
`;

    const fileName = DEFAULT_VALUES.dotEnvFilePath;
    await fs.writeFile(fileName, dotEnvText);

    console.log('OK, wrote .rpcrelay.env file');
    metricsTrackOnHcs('initDotEnvForRpcRelay', 'overwrite');
}

initDotEnvForRpcRelay();
