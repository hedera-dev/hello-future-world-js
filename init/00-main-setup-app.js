#!/usr/bin/env node

const readline = require('node:readline/promises');
const fs = require('fs/promises');
const path = require('path');
const { stdin, stdout } = require('node:process');
const {
    PrivateKey,
    Mnemonic,
} = require('@hashgraph/sdk');
const dotenv = require('dotenv');

const DEFAULT_VALUES = {
    rpcUrl: 'http://localhost:7546/',
    numAccounts: 1,
    numAccountsMinimum: 1,
};

async function init() {
    // prompt for inputs
    const {
        allowOverwrite1stChar,
        dotEnvText,
    } = await promptInputs();

    // write `.env` file if instructed
    if (allowOverwrite1stChar === 'y') {
        console.log('OK, overwriting .env file');
        const fileName = path.resolve('..', '.env');
        await fs.writeFile(fileName, dotEnvText);
    } else {
        console.log('OK, leaving current .env file as it was');
    }
}

function constructDotEnvFile({
    operatorAccount,
    accounts,
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
OPERATOR_ACCOUNT_PRIVATE_KEY=${operatorAccount.privateKey}
OPERATOR_ACCOUNT_EVM_ADDRESS=${operatorAccount.evmAddress}
OPERATOR_ACCOUNT_ID=${operatorAccount.id}

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
        OPERATOR_ACCOUNT_ID,
        SEED_PHRASE,
        NUM_ACCOUNTS,
        RPC_URL,
    } = process.env;

    let operatorAccount;
    let operatorId = OPERATOR_ACCOUNT_PRIVATE_KEY;
    let operatorKey = OPERATOR_ACCOUNT_ID;
    let seedPhrase = SEED_PHRASE;
    let numAccounts = NUM_ACCOUNTS;
    let accounts = [];
    let rpcUrl = RPC_URL;
    let allowOverwrite1stChar = '';
    let dotEnvText = '';

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
        let use1stAccountAsOperator = false;

        // prompt for operator account
        // - user may opt for "none" in which case the 1st account
        //   generated from the seed phrase will be used instead
        // - user may opt to specify an account ID + account private key
        // - if account ID + private key are specified,
        //   validation will be performed
        console.log('Enter your operator account (ECDSA) ID');
        if (operatorId) {
            console.log(`Current: "${operatorId}"`);
            console.log('(enter blank to re-use the above value)');
        } else {
            console.log('e.g. "0.0.12345"');
        }
        console.log('(enter "none" to use first account from BIP-39 seed phrase)');
        const inputOperatorId = await rlPrompt.question('> ');
        if (inputOperatorId === 'none') {
            use1stAccountAsOperator = true;
        } else {
            operatorId = inputOperatorId || operatorId;
            if (!operatorId) {
                console.error('Must specify operator ID');
                restart = true;
                continue;
            }
        }

        if (!use1stAccountAsOperator) {
            console.log('Enter your operator account (ECDSA) private key');
            if (operatorKey) {
                console.log(`Current: "${operatorKey}"`);
                console.log('(enter blank to re-use the above value)');
            } else {
                console.log('e.g. "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"');
            }
            const inputOperatorKey = await rlPrompt.question('> ');
            operatorKey = inputOperatorKey || operatorKey;
            if (!operatorKey) {
                console.error('Must specify operator account private key');
                restart = true;
                continue;
            }

            // validate operator account details
            const operatorPrivateKeyObj = PrivateKey.fromStringECDSA(operatorKey);
            const operatorPublicKey = `0x${ operatorPrivateKeyObj.publicKey.toStringRaw() }`;
            let accountId;
            let accountBalance;
            let accountEvmAddress;
            const accountFetchApiUrl =
                `https://testnet.mirrornode.hedera.com/api/v1/accounts?account.publickey=${operatorPublicKey}&balance=true&limit=1&order=desc`;
            try {
                const accountFetch = await fetch(accountFetchApiUrl);
                const accountObj = await accountFetch.json();
                const account = accountObj?.accounts[0];
                accountId = account?.account;
                accountBalance = account?.balance?.balance;
                accountEvmAddress = account?.evm_address;
            } catch (ex) {
                // do nothing
            }
            if (accountId !== operatorId || !accountBalance) {
                // Fail fast here, as we know this account is non-functional in its present state
                console.error('Must specify an operator account which exists, private key matches account, and is funded');
                restart = true;
                continue;
            }

            operatorAccount = {
                privateKey: operatorKey,
                evmAddress: accountEvmAddress || '',
                id: operatorId,
            };
        }

        // prompt for BIP-39 seed phrase
        // - user may leave empty, and a new one will be generated at random
        // - user may specify a seed phrase, in which case it will be validated
        console.log('Enter a BIP-39 seed phrase');
        if (seedPhrase) {
            console.log(`Current: "${seedPhrase}"`);
            console.log('(enter blank to re-use the above value)');
        } else {
            console.log('(enter blank value generate a new one at random)');
        }
        const inputSeedPhrase = await rlPrompt.question('> ');
        seedPhrase = inputSeedPhrase || seedPhrase;

        // validate seed phrase or generate a new one
        let mnemonic;
        if (!seedPhrase) {
            // generate new seed phrase
            mnemonic = await Mnemonic.generate12();
            seedPhrase = mnemonic.toString();
        } else {
            // validate specified seed phrase
            let isValidatedSeedPhrase = true;
            try {
                mnemonic = await Mnemonic.fromString(seedPhrase);
            } catch (ex) {
                isValidatedSeedPhrase = false;
            }
            if (!isValidatedSeedPhrase) {
                console.error('Specified input is not a valid BIP-39 seed phrase');
                restart = true;
                continue;
            }
        }

        // prompt for number of accounts desired
        // - the desired number of accounts will be generated (minimum  1)
        // - however these accounts will not yet have account IDs, until funded
        console.log('Enter a number of accounts to generate from your BIP-39 seed phrase');
        if (numAccounts) {
            console.log(`Current: "${numAccounts}"`);
            console.log('(enter blank to re-use the above value)');
        } else {
            console.log(`Default: "${DEFAULT_VALUES.numAccounts}"`);
            console.log('(enter blank value to use default value)');
        }
        const inputNumAccounts = await rlPrompt.question('> ');
        numAccounts = inputNumAccounts || numAccounts || DEFAULT_VALUES.numAccounts;
        numAccounts = parseInt(numAccounts, 10);
        if (isNaN(numAccounts)) {
            numAccounts = DEFAULT_VALUES.numAccounts;
        }
        numAccounts = Math.max(numAccounts, DEFAULT_VALUES.numAccountsMinimum);

        // use Hedera SDK to generate accounts from seed phrase + derivation path
        // note that this is now possible as of v2.48.1 of the Hedera JS SDK
        // and no longer need to import another library (such as ethers.js or viem)
        // for this purpose
        // See: https://github.com/hashgraph/hedera-sdk-js/pull/2341
        // Note that Hedera Java and Go SDKs also have equivalent functions implemented,
        // and are linked from the JS SDK github PR
        accounts = new Array(numAccounts);
        for (let accountIndex = 0; accountIndex < numAccounts; ++accountIndex) {
            const accountPrivateKeyObj =
                await mnemonic.toStandardECDSAsecp256k1PrivateKeyCustomDerivationPath(
                    '',
                    `m/44'/60'/0'/0/${accountIndex}`,
                );
            const accountPrivateKey = `0x${ accountPrivateKeyObj.toStringRaw() }`;
            const accountEvmAddress = `0x${ accountPrivateKeyObj.publicKey.toEvmAddress() }`;
            accounts[accountIndex] = {
                privateKey: accountPrivateKey,
                evmAddress: accountEvmAddress,
                id: '',
            };
        }
        if (use1stAccountAsOperator) {
            operatorAccount = accounts[0];
        }

        // prompt for RPC URL
        // - defaults to localhost
        // - on gitpod, `RPC_URL` env var is expected to be set prior to
        //   invoking this script
        console.log('Enter your preferred JSON-RPC endpoint URL');
        if (rpcUrl) {
            console.log(`Current: "${rpcUrl}"`);
            console.log('(enter blank to re-use the above value)');
        } else {
            console.log(`Default: "${DEFAULT_VALUES.rpcUrl}"`);
            console.log('(enter blank value to use default value)');
        }
        const inputRpcUrl = await rlPrompt.question('> ');
        if (!inputRpcUrl) {
            rpcUrl = rpcUrl || DEFAULT_VALUES.rpcUrl;
        } else {
            rpcUrl = inputRpcUrl;
        }

        // prompt for user to overwrite the file `.env` file
        // - prints out the proposed file
        // - user may select "yes", "no", or "restart"
        // - if restart is selected, this loop with prompts is repeated,
        //   allowing user to update input values
        dotEnvText = constructDotEnvFile({
            operatorAccount,
            accounts,
            seedPhrase,
            numAccounts,
            rpcUrl,
        });
        console.log(dotEnvText);
        console.log('Do you wish to overwrite the .env file with the above?');
        console.log('(restart/yes/No)');
        const inputAllowOverwrite = await rlPrompt.question('> ');
        allowOverwrite1stChar = inputAllowOverwrite.toLowerCase().charAt(0);
        if (allowOverwrite1stChar === 'r') {
            console.log('OK, restarting...');
            restart = true;
        }
    } while (restart);

    rlPrompt.close();

    return {
        operatorAccount,
        seedPhrase,
        numAccounts,
        accounts,
        rpcUrl,
        allowOverwrite1stChar,
        dotEnvText,
    };
}

init();
