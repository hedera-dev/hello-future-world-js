const crypto = require('node:crypto');
const fs = require('fs/promises');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
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

const DEFAULT_VALUES = {
    mainDotEnvFilePath: path.resolve(__dirname, '../.env'),
    loggerFilePath: path.resolve(__dirname, '../logger.json'),
    gitRefsHeadMainFilePath: path.resolve(__dirname, '../.git/refs/heads/main'),
};

const ANSI = {
    RESET: '\x1b[0m',
    BRIGHT: '\x1b[1m',
    BRIGHT_OFF: '\x1b[21m',
    UNDERLINE: '\x1b[4m',
    UNDERLINE_OFF: '\x1b[24m',
    FG_RED: '\x1b[31m',
    FG_GREEN: '\x1b[32m',
    FG_YELLOW: '\x1b[33m',
    FG_BLUE: '\x1b[34m',
    FG_PURPLE: '\x1b[35m',
    FG_CYAN: '\x1b[36m',
    FG_DEFAULT: '\x1b[39m',
    CLEAR_LINE: '\x1b[2K',
    CURSOR_UP_1: '\x1b[1A',
    CURSOR_LEFT_MAX: '\x1b[9999D',
};
const CHARS = {
    HELLIP: '…',
    START: '🏁',
    SECTION: '🟣',
    COMPLETE: '🎉',
    ERROR: '❌',
    SUMMARY: '🔢',
};
const hashSha256 = crypto.createHash('sha256');

async function createLogger({
    scriptId,
    scriptCategory,
    skipHcsTopicValidation,
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
    const gitRefsHeadMain = await fs.readFile(DEFAULT_VALUES.gitRefsHeadMainFilePath);
    const gitCommitHash = gitRefsHeadMain.toString().trim().substring(0, 8);
    const version = `${packageJson.version}-${gitCommitHash}`;
    console.log(`${scriptCategory} ${scriptId} ${version}`);

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
        scriptId,
        scriptCategory,
        version,
        step: 0,
        lastMsg: '',
        log,
        logSection,
        logSectionWithWaitPrompt,
        logStart,
        logComplete,
        logCompleteWithoutClose,
        logError,
        logErrorWithoutClose,
        logSummary,
        gracefullyCloseClient,
        getStartMessage,
        getCompleteMessage,
        getErrorMessage,
        applyAnsi,
        stats: loggerStatsPrev,
    };

    await initLoggerConfig(logger, skipHcsTopicValidation);

    function log(...strings) {
        logger.step += 1;
        logger.lastMsg = ([...strings])[0];
        return console.log(...strings);
    }

    function logSection(...strings) {
        console.log();
        return log(...logger.applyAnsi('SECTION', ...strings));
    }

    async function logSectionWithWaitPrompt(...strings) {
        const retVal = logSection(...strings);
        // readline is used to simply prompt user to hit enter
        const rlPrompt = readline.createInterface({
            input: stdin,
            output: stdout,
        });
        await rlPrompt.question('(Hit the "return" key when ready to proceed)');
        rlPrompt.close();
        if (!logger?.config?.ansiDisabled) {
            stdout.write(ANSI.CURSOR_UP_1 + ANSI.CLEAR_LINE + ANSI.CURSOR_LEFT_MAX);
        }
        return retVal;
    }

    function logStart(...strings) {
        console.log();
        const retVal = log(...logger.applyAnsi('START', ...strings));
        const msg = getStartMessage();
        logger.stats.lastStart = Math.max(msg.time, logger.stats.lastStart);
        logger.stats.firstStart = Math.min(msg.time, logger.stats.firstStart);
        logger.stats.countStart += 1;
        writeLoggerFile(logger);
        metricsTrackOnHcs(logger, msg);
        return retVal;
    }

    function logCompleteWithoutClose(...strings) {
        const [retVal, msg] = logCompleteImplStart(...strings);
        metricsTrackOnHcs(logger, msg);
        logCompleteImplEnd(false);
        return retVal;
    }

    async function logComplete(...strings) {
        const [retVal, msg] = logCompleteImplStart(...strings);
        await metricsTrackOnHcs(logger, msg);
        logCompleteImplEnd(true);
        return retVal;
    }

    function logCompleteImplStart(...strings) {
        console.log();
        const retVal = log(...logger.applyAnsi('COMPLETE', ...strings));
        const msg = getCompleteMessage();
        logger.stats.lastComplete = Math.max(msg.time, logger.stats.lastComplete);
        logger.stats.firstComplete = Math.min(msg.time, logger.stats.firstComplete);
        logger.stats.countComplete += 1;
        return [retVal, msg];
    }

    async function logCompleteImplEnd(shouldClose) {
        await writeLoggerFile(logger);
        if (logger.scriptCategory === 'task') {
            await logMetricsSummary(logger);
        }
        if (shouldClose) {
            await gracefullyCloseClient();
        }
    }

    function logErrorWithoutClose(...strings) {
        const [msg] = logErrorImplStart();
        writeLoggerFile(logger);
        metricsTrackOnHcs(logger, msg);
        return log(...strings);
    }

    async function logError(...strings) {
        const [msg] = logErrorImplStart();
        await metricsTrackOnHcs(logger, msg);
        await writeLoggerFile(logger);
        await gracefullyCloseClient();
        console.log();
        return log(...logger.applyAnsi('ERROR', 'Error ID:', msg.detail), '\n', ...strings);
    }

    function logErrorImplStart() {
        const msg = getErrorMessage();
        logger.stats.lastError = Math.max(msg.time, logger.stats.lastError);
        logger.stats.firstError = Math.min(msg.time, logger.stats.firstError);
        logger.stats.countError += 1;
        if (logger.stats.countComplete > 0) {
            logger.stats.countErrorAfterFirstComplete += 1;
        } else {
            logger.stats.countErrorBeforeFirstComplete += 1;
        }
        return [msg];
    }

    async function logSummary(summaryObj) {
        const msg = {
            cat: 'summary',
            v: logger.version,
            action: scriptId,
            detail: summaryObj,
            time: Date.now(),
        };
        await metricsTrackOnHcs(logger, msg);
    }

    async function gracefullyCloseClient() {
        await (new Promise((resolve) => { setTimeout(resolve, 100) }));
        try {
            logger.client?.close();
        } catch (ex) {
            // Do nothing, intentionally ignore any errors during client close
        }
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

    function applyAnsi(ansiType, ...strings) {
        if (logger?.config?.ansiDisabled) {
            return strings;
        }
        switch (ansiType) {
            case 'START':
                return [CHARS.START + ANSI.BRIGHT + ANSI.FG_GREEN, ...strings, ANSI.RESET, CHARS.HELLIP];
            case 'SECTION':
                return [CHARS.SECTION + ANSI.BRIGHT + ANSI.FG_PURPLE, ...strings, ANSI.RESET, CHARS.HELLIP];
            case 'COMPLETE':
                return [CHARS.COMPLETE + ANSI.BRIGHT + ANSI.FG_GREEN, ...strings, ANSI.RESET, CHARS.HELLIP];
            case 'ERROR':
                return [CHARS.ERROR + ANSI.BRIGHT + ANSI.FG_RED, ...strings, ANSI.RESET, CHARS.HELLIP];
            case 'SUMMARY':
                return [CHARS.SUMMARY + ANSI.BRIGHT + ANSI.FG_YELLOW, ...strings, ANSI.RESET, CHARS.HELLIP];
            case 'URL':
                if (strings.length === 1 && typeof strings[0] === 'string') {
                    return [ANSI.UNDERLINE + ANSI.FG_CYAN + strings[0] + ANSI.FG_DEFAULT + ANSI.UNDERLINE_OFF]
                }
                return [ANSI.UNDERLINE, ...strings, ANSI.UNDERLINE_OFF];
            default:
                return strings;
        }
    }

    return logger;
}

async function initLoggerConfig(logger, skipHcsTopicValidation) {
    const tempEnv = {};

    // read in main .env file
    dotenv.config({
        path: [DEFAULT_VALUES.mainDotEnvFilePath],
        processEnv: tempEnv,
    });

    const loggerFile = await readLoggerFile();

    // read ID, account credentials and HCS topic ID from config
    // falling back on defaults if not present
    const metricsId = loggerFile?.config?.metricsId ||
        crypto.randomBytes(16).toString('hex');
    const metricsAccountId =
        loggerFile?.config?.metricsAccountId ||
        tempEnv.OPERATOR_ACCOUNT_ID ||
        '';
    const metricsAccountKey =
        loggerFile?.config?.metricsAccountKey ||
        tempEnv.OPERATOR_ACCOUNT_PRIVATE_KEY ||
        '';
    const metricsHcsTopicMemo =
        loggerFile?.config?.metricsHcsTopicMemo || '';
    const ansiDisabled =
        loggerFile?.config?.ansiDisabled || false;
    const metricsHcsTopicId =
        loggerFile?.config?.metricsHcsTopicId || '';
    const metricsHcsDisabled =
        loggerFile?.config?.metricsHcsDisabled || false;

    if (!skipHcsTopicValidation &&
        (!metricsHcsTopicMemo || !metricsHcsTopicId)
    ) {
        throw new Error('Invalid config in logger.json');
    }

    const config = {
        scriptCategory: 'config',
        ansiDisabled,
        metricsId,
        metricsAccountId,
        metricsAccountKey,
        metricsHcsTopicMemo,
        metricsHcsTopicId,
        metricsHcsDisabled,
    };

    let client;
    let metricsAccountIdObj;
    let metricsAccountKeyObj;
    if (!metricsHcsDisabled && metricsAccountId && metricsAccountKey) {
        metricsAccountIdObj = AccountId.fromString(metricsAccountId);
        metricsAccountKeyObj = PrivateKey.fromStringECDSA(metricsAccountKey);
        client = Client.forTestnet().setOperator(metricsAccountIdObj, metricsAccountKeyObj);
    }

    logger.config = config;
    logger.client = client;
    logger.metricsAccountIdObj = metricsAccountIdObj;
    logger.metricsAccountKeyObj = metricsAccountKeyObj;
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

async function writeLoggerFile(logger) {
    const loggerFile = await readLoggerFile();
    loggerFile.config = logger.config;
    loggerFile[logger.scriptId] = {
        scriptCategory: logger.scriptCategory,
        ...logger.stats,
    };
    const loggerFileJsonUpdated = JSON.stringify(loggerFile, undefined, 2);
    await fs.writeFile(DEFAULT_VALUES.loggerFilePath, loggerFileJsonUpdated);
}

async function logMetricsSummary(logger) {
    // read previous stats collected for all scripts
    const loggerFile = await readLoggerFile();

    // find first setup script
    // find first task script
    let firstSetupScript;
    let firstTaskScript;
    let lastTaskScript;
    const completedTasks = [];
    const incompleteTasks = [];
    Object.keys(loggerFile).forEach((scriptId) => {
        const scriptStats = loggerFile[scriptId];
        const {
            scriptCategory,
            firstStart,
            lastComplete,
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
                if (countComplete > 0) {
                    completedTasks.push(scriptStats);
                    if (!firstTaskScript ||
                        firstStart < firstTaskScript.firstStart) {
                        firstTaskScript = scriptStats;
                    }
                    if (!lastTaskScript ||
                        lastComplete > lastTaskScript.lastComplete) {
                        lastTaskScript = scriptStats;
                    }
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
    const timeToFullCompletion = hasCompletedFirstTask ?
        lastTaskScript.lastComplete - firstSetupScript.firstStart :
        0;

    // Timestamp difference between 1st `start` in a task to 1st `complete` in the same task
    // --> Quantify time taken to complete specific task
    const totalCountOfTaskCompletions = completedTasks.reduce((count, task) => {
        return count + task.countComplete;
    }, 0);
    const completedTaskDurations = completedTasks.map((task) => {
        const timeToComplete = task.firstComplete - task.firstStart;
        const timeToCompleteLatest = task.lastComplete - task.lastStart;
        const errorsBeforeFirstComplete = task.countErrorBeforeFirstComplete;
        return {
            name: task.scriptId,
            duration: timeToComplete,
            durationLatest: timeToCompleteLatest,
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

    console.log();
    console.log(...logger.applyAnsi('SUMMARY', 'Summary metrics'));

    console.log('\nHas completed a task:', hasCompletedFirstTask);
    if (hasCompletedFirstTask) {
        console.log('First task completed ID:', firstTaskScript.scriptId);
    } else {
        console.log('First task completed ID:', 'Not applicable');
    }
    if (!hasCompletedFirstTask || timeToHelloWorld < 0) {
        console.log('Time to first task completion:', 'Not applicable');
    } else {
        console.log('Time to first task completion:', displayDuration(timeToHelloWorld));
    }
    if (!hasCompletedFirstTask || timeToFullCompletion < 0) {
        console.log('Time to all tasks completion:', 'Not applicable');
    } else {
        console.log('Time to all tasks completion:', displayDuration(timeToFullCompletion));
    }
    console.log('Total number of task completions:', totalCountOfTaskCompletions);

    console.log('\nCompleted tasks:', completedTaskDurations.length);
    completedTaskDurations.forEach((info, index) => {
        console.log(`(${index + 1}) Task ID:`, info.name);
        console.log('Time taken to complete (first):', displayDuration(info.duration));
        console.log('Time taken to complete (latest):', displayDuration(info.durationLatest));
        console.log('Errors prior to completion:', info.errors);
    });
    console.log('\nAttempted but incomplete tasks:', incompleteAttemptedTaskDurations.length);
    incompleteAttemptedTaskDurations.forEach((info, index) => {
        console.log(`(${index + 1}) Task ID:`, info.name);
        console.log('Time taken for attempts:', displayDuration(info.duration));
        console.log('Errors thus far:', info.errors);
    });

    if (!logger?.config?.metricsHcsDisabled) {
        console.log(
            '\nView HCS metrics on HashScan:\n',
            ...logger.applyAnsi('URL', `https://hashscan.io/testnet/topic/${loggerFile.config.metricsHcsTopicId}`),
            `\nUsing the anonymised key: ${loggerFile.config.metricsId}`,
        );
    }

    return {
        timeToHelloWorld,
        timeToCompleteAll: timeToFullCompletion,
        totalCompletionsCount: totalCountOfTaskCompletions,
        completedTasks: completedTaskDurations,
        attemptedTasks: incompleteAttemptedTaskDurations,
    };
}

function displayDuration(ms) {
    const seconds = (ms / 1_000);
    const minutes = Math.floor(seconds / 60);
    let out = (seconds % 60).toFixed(1) + 's';
    if (minutes !== 0) {
        out = `${minutes}min ${out}`;
    }
    return out;
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

async function metricsTopicCreate(logger, metricsHcsTopicMemo) {
    const {
        client,
        metricsAccountKeyObj,
    } = logger;

    const topicCreateTx = await new TopicCreateTransaction()
        .setTopicMemo(metricsHcsTopicMemo)
        .freezeWith(client);
    const topicCreateTxSigned = await topicCreateTx.sign(metricsAccountKeyObj);
    const topicCreateTxSubmitted = await topicCreateTxSigned.execute(client);
    const topicCreateTxReceipt = await topicCreateTxSubmitted.getReceipt(client);
    const metricsHcsTopicId = topicCreateTxReceipt.topicId;
    console.log('Metrics HCS topic ID:', metricsHcsTopicId.toString());

    logger.config.metricsHcsTopicId = metricsHcsTopicId.toString();
    logger.config.metricsHcsTopicMemo = metricsHcsTopicMemo.toString();

    // save/ overwrite config file
    await writeLoggerFile(logger);

    return logger.config;
}

const metricsMessages = [];

async function metricsTrackOnHcs(logger, {
    cat,
    v,
    action,
    detail,
    time,
}) {
    if (typeof cat !== 'string' ||
        typeof v !== 'string' ||
        typeof action !== 'string' ||
        (typeof detail !== 'string' && typeof detail !== 'object') ||
        typeof time !== 'number') {
        throw new Error('Missing params');
    }
    if (['start', 'complete', 'error', 'summary'].indexOf(cat) < 0) {
        throw new Error('Invalid category:', cat);
    }
    if (isNaN(time) || time < 1) {
        throw new Error('Invalid time:', time);
    }

    if (!logger.client) {
        // attempt to reload client, in case .env file has been recently updated
        await initLoggerConfig(logger);
    }

    const {
        client,
        metricsAccountKeyObj,
    } = logger;
    const {
        metricsId,
        metricsHcsTopicId,
        metricsHcsDisabled,
    } = logger.config;

    try {
        // Save the message in a queue immediately
        const metricsMessage = {
            id: metricsId,
            v,
            cat,
            action,
            detail,
            time,
        };
        metricsMessages.push(metricsMessage);

        // Submit metrics message to HCS topic
        if (!metricsHcsDisabled && client) {
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
        console.error('Failed to track', { cat, action, detail });
        console.log(ex);
    }
}

module.exports = {
    ANSI,
    CHARS,
    displayDuration,
    createLogger,
    writeLoggerFile,
    logMetricsSummary,

    convertTransactionIdForMirrorNodeApi,
    queryAccountByEvmAddress,
    queryAccountByPrivateKey,
    metricsTopicCreate,
};
