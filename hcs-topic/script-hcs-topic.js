#!/usr/bin/env node

import {
    Client,
    PrivateKey,
    AccountId,
} from '@hashgraph/sdk';
import dotenv from 'dotenv';

async function script_TODO_NAME() {
    // Read in environment variables from `.env` file in parent directory
    dotenv.config({ path: '../.env' });

    // Initialise the operator account
    const operatorIdStr = process.env.OPERATOR_ACCOUNT_ID;
    const operatorKeyStr = process.env.OPERATOR_ACCOUNT_PRIVATE_KEY;
    if (!operatorIdStr || !operatorKeyStr) {
        throw new Error('Must set OPERATOR_ACCOUNT_ID and OPERATOR_ACCOUNT_PRIVATE_KEY environment variables');
    }
    const operatorId = AccountId.fromString(operatorIdStr);
    const operatorKey = PrivateKey.fromStringECDSA(operatorKeyStr);
    const client = Client.forTestnet().setOperator(operatorId, operatorKey);

    // TODO main steps go here

    client.close();

    // NOTE: Verify transactions using Hashscan
    // Step (3) in the accompanying tutorial
    // This is a manual step, the code below only outputs the URL to visit
    // TODO
    const TODO_NAME_VerifyHashscanUrl =
        `TODO_URL_WITH_SUBSTITUTION`;
    console.log('TODO_NAME_VerifyHashscanUrl:', TODO_NAME_VerifyHashscanUrl);

    // Wait for 5s for record files (blocks) to propagate to mirror nodes
    await new Promise((resolve) => setTimeout(resolve, 5_000));

    // NOTE: Verify transactions using Mirror Node API
    // Step (4) in the accompanying tutorial
    const TODO_NAME_VerifyMirrorNodeApiUrl =
        `TODO_URL_WITH_SUBSTITUTION`;
    console.log('TODO_NAME_VerifyMirrorNodeApiUrl:', TODO_NAME_VerifyMirrorNodeApiUrl);
    const TODO_NAME_Fetch = await fetch(TODO_NAME_VerifyMirrorNodeApiUrl);
    const TODO_NAME_Json = await TODO_NAME_Fetch.json();
    const TODO_NAME_TODO_FIELD =
        TODO_NAME_Json?.TODO_FIELD;
    console.log('TODO_NAME_TODO_FIELD:', TODO_NAME_TODO_FIELD);
}

script_TODO_NAME();
