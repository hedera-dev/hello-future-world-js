#!/usr/bin/env node

const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const {
    PrivateKey,
    Mnemonic,
} = require('@hashgraph/sdk');
const dotenv = require('dotenv');

async function init() {
    // prompt for inputs
    const {} = await promptInputs();

    // output `.env` file
    // TODO
}

function constructDotEnvFile({
    use1stAccountAsOperator,
    accounts,
    operatorKey,
    operatorEvmAddress,
    operatorId,
    seedPhrase,
    numAccounts,
    rpcUrl,
}) {
    const accountsOutput = accounts.map((account, accountIndex) => {
        const text =
`## Account #${accountIndex}
ACCOUNT_${accountIndex}_PRIVATE_KEY=${account.privateKey}
ACCOUNT_${accountIndex}_EVM_ADDRESS=${account.evmAddress}
ACCOUNT_${accountIndex}_ID=${account.id}
`;
        return text;
    }).join('\n\n');
    const output =
`# Operator account
OPERATOR_ACCOUNT_PRIVATE_KEY=${operatorKey}
OPERATOR_ACCOUNT_EVM_ADDRESS=${operatorEvmAddress}
OPERATOR_ACCOUNT_ID=${operatorId}

# BIP-39 seed phrase
SEED_PHRASE=${seedPhrase}
NUM_ACCOUNTS=${numAccounts}

${accountsOutput}

# JSON-RPC endpoint
RPC_URL=${rpcUrl}
`
    return output;
}

async function promptInputs() {
    // read in initial values for env variables that have been set
    const {
        OPERATOR_ACCOUNT_PRIVATE_KEY,
        OPERATOR_ACCOUNT_EVM_ADDRESS,
        OPERATOR_ACCOUNT_ID,
        SEED_PHRASE,
        NUM_ACCOUNTS,
        RPC_URL,
    } = process.env;

    let use1stAccountAsOperator = false;
    let operatorId = OPERATOR_ACCOUNT_PRIVATE_KEY;
    let operatorEvmAddress = OPERATOR_ACCOUNT_EVM_ADDRESS;
    let operatorKey = OPERATOR_ACCOUNT_ID;
    let seedPhrase = SEED_PHRASE;
    let numAccounts = NUM_ACCOUNTS;
    let accounts = [];
    let rpcUrl = RPC_URL;

    const rlPrompt = readline.createInterface({
        input: stdin,
        output: stdout,
    });

    // prompt users for the required fields in a loop
    // the loop is in case of any validation failures,
    // to allow for correction before proceeding
    let restart;
    do {
        restart = false;
        // prompt for operator account
        // - user may opt for "none" in which case the 1st account
        //   generated from the seed phrase will be used instead
        // - user may opt to specify an account ID + account private key
        // - if account ID + private key are specified,
        //   validation will be performed
        // TODO

        // prompt for BIP-39 seed phrase + number of accounts desired
        // - user may leave empty, and a new one will be generated at random
        // - user may specify a seed phrase, in which case it will be validated
        // - the desired number of accounts will be generated (minimum  1)
        // - however these accounts will not yet have account IDs, until funded
        // TODO

        // prompt for RPC URL
        // - defaults to localhost
        // - on gitpod, `RPC_URL` env var is expected to be set prior to
        //   invoking this script
        // TODO

        // prompt for user to overwrite the file `.env` file
        // - prints out the proposed file
        // - user may select "yes", "no", or "restart"
        // - if restart is selected, this loop with prompts is repeated,
        //   allowing user to update input values
        const dotEnvText = constructDotEnvFile({
            use1stAccountAsOperator,
            operatorId,
            operatorEvmAddress,
            operatorKey,
            seedPhrase,
            numAccounts,
            accounts,
            rpcUrl,
        });
        console.log(dotEnvText);
        console.log('Do you wish to overwrite the .env file with the above?');
        console.log('(restart/yes/No)');
        const inputAllowOverwrite = await rlPrompt.question('> ');
        const allowOverwrite1stChar = inputAllowOverwrite.toLowerCase().charAt(0);
        if (allowOverwrite1stChar === 'r') {
            console.log('OK, restarting...');
            restart = true;
        }
    } while (restart);

    rlPrompt.close();

    return {
        use1stAccountAsOperator,
        operatorId,
        operatorEvmAddress,
        operatorKey,
        seedPhrase,
        numAccounts,
        accounts,
        rpcUrl,
    };
}

init();
