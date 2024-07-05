#!/usr/bin/env node

const readline = require('node:readline/promises');
const fs = require('fs/promises');
const path = require('path');
const { stdin, stdout } = require('node:process');
const dotenv = require('dotenv');

const DEFAULT_VALUES = {
    dotEnvFilePath: path.resolve(__dirname, '../.rpcrelay.env'),
    appDotEnvFilePath: path.resolve(__dirname, '../.env'),
};

async function initDotEnvForRpcRelay() {
    // read in initial values for env variables that have been set
    dotenv.config({ path: DEFAULT_VALUES.appDotEnvFilePath });
    const {
        OPERATOR_ACCOUNT_PRIVATE_KEY,
        OPERATOR_ACCOUNT_EVM_ADDRESS,
        OPERATOR_ACCOUNT_ID,
    } = process.env;

    let operatorId = OPERATOR_ACCOUNT_ID;
    let operatorEvmAddress = OPERATOR_ACCOUNT_EVM_ADDRESS;
    let operatorKey = OPERATOR_ACCOUNT_PRIVATE_KEY;

    const rlPrompt = readline.createInterface({
        input: stdin,
        output: stdout,
    });

    if (!operatorId && !operatorEvmAddress) {
        console.log('Must define operator ID or operator EVM address');
        rlPrompt.close();
        return;
    } else if (!operatorId) {
        console.log(`Please enter the operator account ID which corresponds to ${operatorEvmAddress}`);
        console.log('If this account has not yet been created or funded, you may do so via https://faucet.hedera.com');
        const inputOperatorId = await rlPrompt.question('> ');
        operatorId = inputOperatorId;
    }

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

    rlPrompt.close();
}

initDotEnvForRpcRelay();
