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
const packageJson = require('../package.json');
const { read } = require('node:fs');

const DEFAULT_VALUES = {
    mainDotEnvFilePath: path.resolve(__dirname, '../.env'),
    metricsDotEnvFilePath: path.resolve(__dirname, '../.metrics.env'),
    loggerFilePath: path.resolve(__dirname, '../logger.json'),
    metricsAccountId: '',
    metricsAccountKey: '',
    metricsHcsTopicId: '0.0.4573319',
    metricsHcsTopicMemo: 'HFWV2',
};

const ANSI_ESCAPE_CODE_BLUE = '\x1b[34m%s\x1b[0m';
const HELLIP_CHAR = '…';
const hashSha256 = crypto.createHash('sha256');

function displayDuration(ms) {
    const seconds = (ms / 1_000);
    const minutes = Math.floor(seconds / 60);
    let out = (seconds % 60).toFixed(1) + 's';
    if (minutes > 0) {
        out = `${minutes}min ${out}`;
    }
    return out;
}

async function readLoggerFile() {
    let loggerFile;
    try {
        const loggerFileJson  = await fs.readFile(DEFAULT_VALUES.loggerFilePath);
        loggerFile = JSON.parse(loggerFileJson);
    } catch (ex) {
        // do nothing
    }
    return (loggerFile || {});
}

async function createLogger({
    scriptId,
    scriptCategory,
}) {
    if (typeof scriptId !== 'string' ||
        scriptId.length < 2 ||
        !scriptId.match(/^[a-zA-Z0-9_]+$/)
    ) {
        throw new Error('Invalid scriptId');
    }
    if (['setup', 'task'].indexOf(scriptCategory) < 0) {
        throw new Error('Invalid script category');
    }

    // obtain package.json version number and git commit hash
    const gitRefsHeadMainFilePath = path.resolve(process.cwd(), '../.git/refs/heads/main');
    const gitRefsHeadMain = await fs.readFile(gitRefsHeadMainFilePath);
    const gitCommitHash = gitRefsHeadMain.toString().trim().substring(0, 8);
    const version = `${packageJson.version}-${gitCommitHash}`;
    console.log({ version });

    // read previous stats collected for this script, if any
    const loggerFile = await readLoggerFile();
    const loggerStatsPrev = {
        firstStart: Number.MAX_SAFE_INTEGER,
        lastStart: 0,
        countStart: 0,
        firstComplete: Number.MAX_SAFE_INTEGER,
        lastComplete: 0,
        countComplete: 0,
        firstError: Number.MAX_SAFE_INTEGER,
        lastError: 0,
        countError: 0,
        countErrorBeforeFirstComplete: 0,
        countErrorAfterFirstComplete: 0,
        ...(loggerFile?.[scriptId] || {}),
    };

    const logger = {
        scriptId: `${DEFAULT_VALUES.metricsHcsTopicMemo}-${scriptId}`,
        scriptCategory,
        version,
        step: 0,
        lastMsg: '',
        log,
        logSection,
        logStart,
        logComplete,
        logError,
        getStartMessage,
        getCompleteMessage,
        getErrorMessage,
        stats: loggerStatsPrev,
    };

    function log(...strings) {
        logger.step += 1;
        logger.lastMsg = ([...strings])[0];
        return console.log(...strings);
    }

    function logSection(...strings) {
        logger.step += 1;
        logger.lastMsg = ([...strings])[0];
        console.log('');
        return blueLog(...strings);
    }

    function logStart(...strings) {
        const retVal = logSection(...strings);
        const msg = getStartMessage();
        logger.stats.lastStart = Math.max(msg.time, logger.stats.lastStart);
        logger.stats.firstStart = Math.min(msg.time, logger.stats.firstStart);
        logger.stats.countStart += 1;
        saveLoggerStats(logger);
        metricsTrackOnHcs(msg);
        return retVal;
    }

    function logComplete(...strings) {
        const retVal = logSection(...strings);
        const msg = getCompleteMessage();
        logger.stats.lastComplete = Math.max(msg.time, logger.stats.lastComplete);
        logger.stats.firstComplete = Math.min(msg.time, logger.stats.firstComplete);
        logger.stats.countComplete += 1;
        saveLoggerStats(logger);
        metricsTrackOnHcs(msg);
        logMetricsSummary();
        return retVal;
    }

    function logError(...strings) {
        const msg = getErrorMessage();
        metricsTrackOnHcs(msg);
        logger.stats.lastError = Math.max(msg.time, logger.stats.lastError);
        logger.stats.firstError = Math.min(msg.time, logger.stats.firstError);
        logger.stats.countError += 1;
        if (logger.stats.countComplete > 0) {
            logger.stats.countErrorAfterFirstComplete += 1;
        } else {
            logger.stats.countErrorBeforeFirstComplete += 1;
        }
        saveLoggerStats(logger);
        return log(...strings);
    }

    function getStartMessage() {
        return {
            cat: 'start',
            v: logger.version,
            action: scriptId,
            detail: '',
            time: Date.now(),
        };
    }

    function getCompleteMessage() {
        return {
            cat: 'complete',
            v: logger.version,
            action: scriptId,
            detail: '',
            time: Date.now(),
        };
    }

    function getErrorMessage() {
        const lastMsgHashedTruncated = hashSha256
            .update(logger.lastMsg)
            .digest('hex')
            .substring(0, 8);
        return {
            cat: 'error',
            v: logger.version,
            action: scriptId,
            detail: `${logger.step}-${lastMsgHashedTruncated}`,
            time: Date.now(),
        };
    }

    return logger;
}

async function saveLoggerStats(logger) {
    const loggerFile = await readLoggerFile();
    loggerFile[logger.scriptId] = {
        scriptCategory: logger.scriptCategory,
        ...logger.stats,
    };
    const loggerFileJsonUpdated = JSON.stringify(loggerFile, undefined, 2);
    await fs.writeFile(DEFAULT_VALUES.loggerFilePath, loggerFileJsonUpdated);
}

async function logMetricsSummary() {
    // read previous stats collected for all scripts
    const loggerFile = await readLoggerFile();

    // find first setup script
    // find first task script
    let firstSetupScript;
    let firstTaskScript;
    const completedTasks = [];
    const incompleteTasks = [];
    Object.keys(loggerFile).forEach((scriptId) => {
        const scriptStats = loggerFile[scriptId];
        const {
            scriptCategory,
            firstStart,
            countComplete,
        } = scriptStats;
        scriptStats.scriptId = scriptId;
        switch (scriptCategory) {
            case 'setup':
                if (!firstSetupScript ||
                    (
                        firstStart < firstSetupScript.firstStart &&
                        countComplete > 0
                    )) {
                    firstSetupScript = scriptStats;
                }
                break;
            case 'task':
                if (!firstTaskScript ||
                    (
                        firstStart < firstTaskScript.firstStart &&
                        countComplete > 0
                    )) {
                    firstTaskScript = scriptStats;
                }
                if (countComplete > 0) {
                    completedTasks.push(scriptStats);
                } else {
                    incompleteTasks.push(scriptStats);
                }
                break;
        }
    });

    // Timestamp difference between 1st `start` in setup to 1st `complete` in task
    // --> Quantify **time to hello world**
    const hasCompletedFirstTask = !!(firstSetupScript && firstTaskScript);
    const timeToHelloWorld = hasCompletedFirstTask ?
        firstTaskScript.firstComplete - firstSetupScript.firstStart :
        0;

    // Timestamp difference between 1st `start` in a task to 1st `complete` in the same task
    // --> Quantify time taken to complete specific task
    const totalCountOfTaskCompletions = completedTasks.reduce((count, task) => {
        return count + task.countComplete;
    }, 0);
    const completedTaskDurations = completedTasks.map((task) => {
        const timeToComplete = task.firstComplete - task.firstStart;
        const errorsBeforeFirstComplete = task.countErrorBeforeFirstComplete;
        return {
            name: task.scriptId,
            duration: timeToComplete,
            errors: errorsBeforeFirstComplete,
        };
    });

    // Count of `error` occurrences between 1st instance of a `start`,
    // and 1st instance of a `complete` in the same task
    // --> Quantify number of friction points
    // NOTE this is included in `errorsBeforeFirstComplete` computed above

    // Count of 1st instance of `start` without any corresponding `complete` for the same task
    // --> Quantify the completion rate (and therefore drop-off rate)
    const incompleteAttemptedTaskDurations = incompleteTasks.map((task) => {
        timeToLastAttempt = task.lastError - task.firstStart;
        return {
            name: task.scriptId,
            duration: timeToLastAttempt,
            errors: task.countError,
        };
    });

    console.log('Has completed a task:', hasCompletedFirstTask);
    console.log('First task completed ID:', firstTaskScript.scriptId);
    console.log('Time to first task completion:', timeToHelloWorld);
    console.log('Total number of task completions:', totalCountOfTaskCompletions);
    console.log('Completed tasks:');
    completedTaskDurations.forEach((info, index) => {
        console.log(`(${index + 1}) Task ID:`, info.name);
        console.log('Time taken to complete:', displayDuration(info.duration));
        console.log('Errors prior to completion:', info.errors);
    });
    console.log('Attempted but incomplete tasks:', );
    incompleteAttemptedTaskDurations.forEach((info, index) => {
        console.log(`(${index + 1}) Task ID:`, info.name);
        console.log('Time taken for attempts:', displayDuration(info.duration));
        console.log('Errors thus far:', info.errors);
    });
}

function blueLog(...strings) {
    return console.log(ANSI_ESCAPE_CODE_BLUE, '🔵', ...strings, HELLIP_CHAR);
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

async function metricsTrackOnHcs({
    cat,
    v,
    action,
    detail,
    time,
}) {
    if (typeof cat !== 'string' ||
        typeof v !== 'string' ||
        typeof action !== 'string' ||
        typeof detail !== 'string' ||
        typeof time !== 'number') {
        throw new Error('Missing params');
    }
    if (['start', 'complete', 'error'].indexOf(cat) < 0) {
        throw new Error('Invalid category:', cat);
    }
    if (isNaN(time) || time < 1) {
        throw new Error('Invalid time:', time);
    }

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
            cat,
            v,
            action,
            detail,
            time,
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
    displayDuration,
    createLogger,
    saveLoggerStats,
    logMetricsSummary,

    ANSI_ESCAPE_CODE_BLUE,
    HELLIP_CHAR,
    blueLog,
    convertTransactionIdForMirrorNodeApi,
    queryAccountByEvmAddress,
    queryAccountByPrivateKey,
    metricsTopicCreate,
    metricsTrackOnHcs,
};
