const crypto = require('node:crypto');
const fs = require('fs/promises');
const path = require('path');
const dotenv = require('dotenv');
const {
    Client,
    PrivateKey,
    AccountId,
    TopicCreateTransaction,
    TopicMessageSubmitTransaction,
} = require('@hashgraph/sdk');

const DEFAULT_VALUES = {
    mainDotEnvFilePath: path.resolve(__dirname, '../.env'),
    metricsDotEnvFilePath: path.resolve(__dirname, '../.metrics.env'),
    metricsAccountId: '',
    metricsAccountKey: '',
    metricsHcsTopicId: '0.0.4573319',
    metricsHcsTopicMemo: 'HFWv2',
};

const ANSI_ESCAPE_CODE_BLUE = '\x1b[34m%s\x1b[0m';
const HELLIP_CHAR = '…';

function blueLog(...strings) {
    console.log(ANSI_ESCAPE_CODE_BLUE, '🔵', ...strings, HELLIP_CHAR);
}

function convertTransactionIdForMirrorNodeApi(txId) {
    // The transaction ID has to be converted to the correct format to pass in the mirror node query (0.0.x@x.x to 0.0.x-x-x)
    let [txIdA, txIdB] = txId.toString().split('@');
    txIdB = txIdB.replace('.', '-');
    const txIdMirrorNodeFormat = `${txIdA}-${txIdB}`;
    return txIdMirrorNodeFormat;
}

async function queryAccountByEvmAddress(evmAddress) {
    let accountId;
    let accountBalance;
    let accountEvmAddress;
    const accountFetchApiUrl =
        `https://testnet.mirrornode.hedera.com/api/v1/accounts/${evmAddress}?limit=1&order=asc&transactiontype=cryptotransfer&transactions=false`;
    console.log('Fetching: ', accountFetchApiUrl);
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
    console.log('Fetching: ', accountFetchApiUrl);
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

async function getMetricsConfig() {
    // read in current metrics config
    dotenv.config({
        path: [DEFAULT_VALUES.metricsDotEnvFilePath, DEFAULT_VALUES.mainDotEnvFilePath],
        override: true,
    });

    // read ID, account credentials and HCS topic ID from config
    // falling back on defaults in not present
    const metricsId = process.env.METRICS_ID ||
        crypto.randomBytes(16).toString('hex');
    const metricsAccountId =
        process.env.METRICS_ACCOUNT_ID ||
        DEFAULT_VALUES.metricsAccountId ||
        process.env.OPERATOR_ACCOUNT_ID;
    const metricsAccountKey =
        process.env.METRICS_ACCOUNT_PRIVATE_KEY ||
        DEFAULT_VALUES.metricsAccountKey ||
        process.env.OPERATOR_ACCOUNT_PRIVATE_KEY;
    const metricsHcsTopicId = process.env.METRICS_HCS_TOPIC_ID ||
        DEFAULT_VALUES.metricsHcsTopicId;

    let client;
    let metricsAccountIdObj;
    let metricsAccountKeyObj;
    if (metricsAccountId && metricsAccountKey) {
        metricsAccountIdObj = AccountId.fromString(metricsAccountId);
        metricsAccountKeyObj = PrivateKey.fromStringECDSA(metricsAccountKey);
        client = Client.forTestnet().setOperator(metricsAccountIdObj, metricsAccountKeyObj);
    }

    return {
        metricsId,
        metricsAccountId,
        metricsAccountKey,
        metricsHcsTopicId,
        client,
        metricsAccountIdObj,
        metricsAccountKeyObj,
    };
}

async function saveMetricsConfig({
    metricsId,
    metricsAccountId,
    metricsAccountKey,
    metricsHcsTopicId,
}) {
    // save/ overwrite config file
    const dotEnvFileText =
`
METRICS_ID=${metricsId || ''}
METRICS_ACCOUNT_ID=${metricsAccountId || ''}
METRICS_ACCOUNT_PRIVATE_KEY=${metricsAccountKey || ''}
METRICS_HCS_TOPIC_ID=${metricsHcsTopicId || ''}
`;
    const fileName = DEFAULT_VALUES.metricsDotEnvFilePath;
    await fs.writeFile(fileName, dotEnvFileText);
}

async function metricsTopicCreate() {
    const {
        metricsId,
        metricsAccountId,
        metricsAccountKey,
        client,
        metricsAccountKeyObj,
    } = await getMetricsConfig();

    const topicCreateTx = await new TopicCreateTransaction()
        .setTopicMemo(DEFAULT_VALUES.metricsHcsTopicMemo)
        .freezeWith(client);
    const topicCreateTxSigned = await topicCreateTx.sign(metricsAccountKeyObj);
    const topicCreateTxSubmitted = await topicCreateTxSigned.execute(client);
    const topicCreateTxReceipt = await topicCreateTxSubmitted.getReceipt(client);
    const metricsHcsTopicId = topicCreateTxReceipt.topicId;
    console.log('Metrics HCS topic ID:', metricsHcsTopicId.toString());

    client.close();

    // save/ overwrite config file
    await saveMetricsConfig({
        metricsId,
        metricsAccountId,
        metricsAccountKey,
        metricsHcsTopicId,
    });
}

const metricsMessages = [];

async function metricsTrackOnHcs(action, detail) {
    if (typeof action !== 'string' || typeof detail !== 'string') {
        throw new Error();
    }
    const timeStamp = Date.now();

    let client;

    try {
        const metricsConfig = await getMetricsConfig();
        const {
            metricsId,
            metricsAccountId,
            metricsAccountKey,
            metricsHcsTopicId,
            metricsAccountKeyObj,
        } = metricsConfig;
        client = metricsConfig.client;

        // Save the message in a queue immediately
        const metricsMessage = {
            id: metricsId,
            action,
            detail,
            time: timeStamp,
        };
        metricsMessages.push(metricsMessage);

        await saveMetricsConfig({
            metricsId,
            metricsAccountId,
            metricsAccountKey,
            metricsHcsTopicId,
        });

        // Submit metrics message to HCS topic
        if (client) {
            do {
                const nextMetricsMessage = metricsMessages.shift();
                // Track directly on HCS
                const topicMsgSubmitTx = await new TopicMessageSubmitTransaction()
                    .setTopicId(metricsHcsTopicId)
                    .setMessage(JSON.stringify(nextMetricsMessage))
                    .freezeWith(client);
                const topicMsgSubmitTxSigned = await topicMsgSubmitTx.sign(metricsAccountKeyObj);
                const topicMsgSubmitTxSubmitted = await topicMsgSubmitTxSigned.execute(client);
                const topicMsgSubmitTxReceipt = await topicMsgSubmitTxSubmitted.getReceipt(client);
                // const topicMsgSeqNum = topicMsgSubmitTxReceipt.topicSequenceNumber;
            } while (metricsMessages.length > 0);
        }
        // When `client` is not initialised, the `metricsMessage` is
        // already tracked in memory, and will be submitted to HCS at a later time
        // when `client` is available.
    } catch (ex) {
        console.error('Failed to track', action, detail);
    }
    if (client) {
        client.close();
    }
}

module.exports = {
    ANSI_ESCAPE_CODE_BLUE,
    HELLIP_CHAR,
    blueLog,
    convertTransactionIdForMirrorNodeApi,
    queryAccountByEvmAddress,
    queryAccountByPrivateKey,
    metricsTopicCreate,
    metricsTrackOnHcs,
};
