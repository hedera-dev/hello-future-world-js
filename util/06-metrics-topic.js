#!/usr/bin/env node

const process = require('node:process');
const path = require('node:path');
const fs = require('node:fs/promises');
const { createLogger, metricsTopicCreate } = require('../util/util.js');

let logger;

async function initMetricsTopic() {
  logger = await createLogger({
    scriptId: 'initDotEnvForRpcRelay',
    scriptCategory: 'setup',
    skipHcsTopicValidation: true,
  });
  logger.logStart('Initialise metrics topic - start');

  const [metricsHcsTopicMemo] = process.argv.slice(2);
  if (!metricsHcsTopicMemo) {
    throw new Error('Specify a topic memo as 1st argument');
  }

  await logger.logSection('Creating new topic with memo:', metricsHcsTopicMemo);
  console.log('Creating new topic with memo:', metricsHcsTopicMemo);
  const updatedLoggerConfig = await metricsTopicCreate(
    logger,
    metricsHcsTopicMemo,
  );
  console.log('Updated logger config:', updatedLoggerConfig);

  await logger.logSection('Updating logger.json.sample');
  const filePath = path.resolve(__dirname, '../logger.json.sample');
  let loggerSampleConfig = {
    scriptCategory: '',
    ansiDisabled: false,
    metricsId: '',
    metricsHcsTopicId: updatedLoggerConfig.metricsHcsTopicId,
    metricsHcsTopicMemo: updatedLoggerConfig.metricsHcsTopicMemo,
    metricsAccountId: '',
    metricsAccountKey: '',
    metricsHcsDisabled: false,
  };
  const fileContents = JSON.stringify(
    { config: loggerSampleConfig },
    undefined,
    2,
  );
  await fs.writeFile(filePath, fileContents);

  logger.logComplete('Initialise metrics topic - complete');
}

initMetricsTopic().catch((ex) => {
  logger ? logger.logError(ex) : console.error(ex);
});
