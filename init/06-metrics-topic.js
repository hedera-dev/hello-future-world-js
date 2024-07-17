#!/usr/bin/env node

const {
    metricsTopicCreate,
} = require('../util/util.js');

async function initMetricsTopic() {
    await metricsTopicCreate();
}

initMetricsTopic();
