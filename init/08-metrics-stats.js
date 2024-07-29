#!/usr/bin/env node
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const {
    logMetricsSummary,
    createLogger,
    writeLoggerFile,
} = require('../util/util.js');

async function metricsStats() {
    const metricsSummary = await logMetricsSummary();
    const rlPrompt = readline.createInterface({
        input: stdin,
        output: stdout,
    });
    console.log('Do you wish to log your metrics on HCS?');
    console.log('(yes/No)');
    const inputAllow = await rlPrompt.question('> ');
    rlPrompt.close();
    const inputAllow1stChar = inputAllow.toLowerCase().charAt(0);
    if (inputAllow1stChar !== 'y') {
        console.log('OK, not logging metrics summary...');
        return;
    }
    console.log('OK, logging metrics summary...');
    const logger = await createLogger({
        scriptId: 'metricsStats',
        scriptCategory: 'setup',
    });
    logger.config.metricsHcsDisabled = false;
    await writeLoggerFile(logger);
    await logger.logSummary(metricsSummary);
    await logger.gracefullyCloseClient();
}

metricsStats();
