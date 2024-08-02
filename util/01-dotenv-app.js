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
const {
    createLogger,
} = require('../util/util.js');

let logger;
let client;

const DEFAULT_VALUES = {
    dotEnvFilePath: path.resolve(__dirname, '../.env'),
    rpcUrl: 'http://localhost:7546/',
    numAccounts: 1,
    numAccountsMinimum: 1,
};

async function initDotEnvForApp() {
    logger = await createLogger({
        scriptId: 'initDotEnvForApp',
        scriptCategory: 'setup',
    });
    logger.logStart('Initialise .env file - start');

    // prompt for inputs
    const {
        allowOverwrite1stChar,
        dotEnvText,
    } = await promptInputs();

    // write `.env` file if instructed
    if (allowOverwrite1stChar === 'y') {
        logger.log('OK, overwriting .env file');
        const fileName = DEFAULT_VALUES.dotEnvFilePath;
        await fs.writeFile(fileName, dotEnvText);
        logger.logComplete('Initialise .env file, overwrite - complete');
    } else {
        logger.logComplete('Initialise .env file, leave as-is - complete');
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
`# This .env file stores credentials for Hedera Testnet only.
# Do **not** reuse or share any credentials from Hedera Mainnet,
# as this file is stored as plain text on disk,
# and is therefore not secure enough.

# Operator account
OPERATOR_ACCOUNT_PRIVATE_KEY=${operatorAccount.privateKey}
OPERATOR_ACCOUNT_EVM_ADDRESS=${operatorAccount.evmAddress}
OPERATOR_ACCOUNT_ID=${operatorAccount.id}

# BIP-39 seed phrase
SEED_PHRASE="${seedPhrase}"
NUM_ACCOUNTS=${numAccounts}

${accountsOutput}

# JSON-RPC endpoint
RPC_URL=${rpcUrl}
`
    return output;
}

async function queryAccountByEvmAddress(evmAddress) {
    let accountId;
    let accountBalance;
    let accountEvmAddress;
    const accountFetchApiUrl =
        `https://testnet.mirrornode.hedera.com/api/v1/accounts/${evmAddress}?limit=1&order=asc&transactiontype=cryptotransfer&transactions=false`;
    logger.log('Fetching: ', accountFetchApiUrl);
    try {
        const accountFetch = await fetch(accountFetchApiUrl);
        const accountObj = await accountFetch.json();
        const account = accountObj;
        accountId = account?.account;
        accountBalance = account?.balance?.balance;
        accountEvmAddress = account?.evm_address;
    } catch (ex) {
        // do nothing
    }
    return {
        accountId,
        accountBalance,
        accountEvmAddress,
    }
}

async function queryAccountByPrivateKey(privateKeyStr) {
    const privateKeyObj = PrivateKey.fromStringECDSA(privateKeyStr);
    const publicKey = `0x${ privateKeyObj.publicKey.toStringRaw() }`;
    let accountId;
    let accountBalance;
    let accountEvmAddress;
    const accountFetchApiUrl =
        `https://testnet.mirrornode.hedera.com/api/v1/accounts?account.publickey=${publicKey}&balance=true&limit=1&order=desc`;
    logger.log('Fetching: ', accountFetchApiUrl);
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
    return {
        accountId,
        accountBalance,
        accountEvmAddress,
    }
}

async function getUsableAccount(privateKeyStr, evmAddress) {
    let account;
    if (evmAddress) {
        account = await queryAccountByEvmAddress(evmAddress);
    } else {
        account = await queryAccountByPrivateKey(privateKeyStr);
    }
    let {
        accountId,
        accountBalance,
        accountEvmAddress,
    } = account;
    if (!accountId) {
        throw new Error('Must specify an account which exists, and can be derived from the specified private key');
    }
    if (!accountBalance) {
        throw new Error('Must specify an account which is funded');
    }

    return {
        privateKey: privateKeyStr,
        evmAddress: accountEvmAddress || '',
        id: accountId,
    };
}

async function promptInputs() {
    // read in initial values for env variables that have been set
    dotenv.config({ path: DEFAULT_VALUES.dotEnvFilePath });
    const {
        YOUR_NAME,
        OPERATOR_ACCOUNT_PRIVATE_KEY,
        SEED_PHRASE,
        NUM_ACCOUNTS,
        RPC_URL,
    } = process.env;

    let operatorAccount;
    let operatorKey = OPERATOR_ACCOUNT_PRIVATE_KEY;
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

        // prompt for operator account private key
        // - user may opt for "none" in which case the 1st account
        //   generated from the BIP-39 seed phrase will be used instead
        // - user may opt to specify an account private key
        // - if private key is specified, validation will be performed,
        //   and account ID will be obtained from there (no need to ask user to input)
        logger.log('Enter your operator account (ECDSA) private key');
        if (operatorKey) {
            logger.log(`Current: "${operatorKey}"`);
            logger.log('(enter blank to re-use the above value)');
        } else {
            logger.log('e.g. "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"');
        }
        logger.log('(enter "none" to use first account from BIP-39 seed phrase as operator account)');
        const inputOperatorKey = await rlPrompt.question('> ');
        if (inputOperatorKey === 'none') {
            use1stAccountAsOperator = true;
        } else {
            operatorKey = inputOperatorKey || operatorKey;
            if (!operatorKey) {
                console.error('Must specify operator account private key');
                restart = true;
                continue;
            }

            // validate operator account details
            try {
                operatorAccount = await getUsableAccount(operatorKey);
            } catch (ex) {
                // Fail fast here, as we know this account is non-functional in its present state
                console.error(ex.message);
                restart = true;
                continue;
            }
        }

        // prompt for BIP-39 seed phrase
        // - user may leave empty, and a new one will be generated at random
        // - user may specify a seed phrase, in which case it will be validated
        logger.log('Enter a BIP-39 seed phrase');
        if (seedPhrase) {
            logger.log(`Current: "${seedPhrase}"`);
            logger.log('(enter blank to re-use the above value)');
        } else {
            logger.log('(enter blank value generate a new one at random)');
        }
        const inputSeedPhrase = await rlPrompt.question('> ');
        seedPhrase = inputSeedPhrase || seedPhrase;

        // validate seed phrase or generate a new one
        let mnemonic;
        if (!seedPhrase) {
            // generate new seed phrase
            mnemonic = await Mnemonic.generate12();
            seedPhrase = mnemonic.toString();
            logger.log('Randomly-generated seed phrase: ', seedPhrase);
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
        logger.log('Enter a number of accounts to generate from your BIP-39 seed phrase');
        if (numAccounts) {
            logger.log(`Current: "${numAccounts}"`);
            logger.log('(enter blank to re-use the above value)');
        } else {
            logger.log(`Default: "${DEFAULT_VALUES.numAccounts}"`);
            logger.log('(enter blank value to use default value)');
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

        // prompt for RPC URL
        // - defaults to localhost
        // - on gitpod, `RPC_URL` env var is expected to be set prior to
        //   invoking this script
        logger.log('Enter your preferred JSON-RPC endpoint URL');
        if (rpcUrl) {
            logger.log(`Current: "${rpcUrl}"`);
            logger.log('(enter blank to re-use the above value)');
        } else {
            logger.log(`Default: "${DEFAULT_VALUES.rpcUrl}"`);
            logger.log('(enter blank value to use default value)');
        }
        const inputRpcUrl = await rlPrompt.question('> ');
        if (!inputRpcUrl) {
            rpcUrl = rpcUrl || DEFAULT_VALUES.rpcUrl;
        } else {
            rpcUrl = inputRpcUrl;
        }

        if (use1stAccountAsOperator) {
            // first, give user the opportunity to fund this account
            logger.log(`Please ensure that you have funded ${accounts[0].evmAddress}`);
            logger.log('If this account has not yet been created or funded, you may do so via https://faucet.hedera.com');
            logger.log('(Simply enter a blank value to when this account is ready)');
            await rlPrompt.question('> '); // discard the response, no use for it

            // validate operator account details
            try {
                operatorAccount = await getUsableAccount(accounts[0].privateKey, accounts[0].evmAddress);
            } catch (ex) {
                // Fail fast here, as we know this account is non-functional in its present state
                console.error(ex.message);
                restart = true;
                continue;
            }

            accounts[0].id = operatorAccount.id;
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
        logger.log(dotEnvText);
        logger.log('Do you wish to overwrite the .env file with the above?');
        logger.log('(restart/yes/No)');
        const inputAllowOverwrite = await rlPrompt.question('> ');
        allowOverwrite1stChar = inputAllowOverwrite.toLowerCase().charAt(0);
        if (allowOverwrite1stChar === 'r') {
            logger.log('OK, restarting...');
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

initDotEnvForApp().catch((ex) => {
    client && client.close();
    logger ? logger.logError(ex) : console.error(ex);
});
