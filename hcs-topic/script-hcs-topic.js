#!/usr/bin/env node

import {
    Client,
    PrivateKey,
    AccountId,
    TopicCreateTransaction,
    TopicMessageSubmitTransaction,
} from '@hashgraph/sdk';
import dotenv from 'dotenv';
import {
    blueLog,
    metricsTrackOnHcs,
} from '../util/util.js';

const hfwId = 'HFW-HCS';

let client;

async function scriptHcsTopic() {
    metricsTrackOnHcs('scriptHcsTopic', 'run');

    // Read in environment variables from `.env` file in parent directory
    dotenv.config({ path: '../.env' });

    // Initialise the operator account
    const yourName = process.env.YOUR_NAME;
    const operatorIdStr = process.env.OPERATOR_ACCOUNT_ID;
    const operatorKeyStr = process.env.OPERATOR_ACCOUNT_PRIVATE_KEY;
    if (!yourName || !operatorIdStr || !operatorKeyStr) {
        throw new Error('Must set YOUR_NAME, OPERATOR_ACCOUNT_ID and OPERATOR_ACCOUNT_PRIVATE_KEY environment variables');
    }
    const operatorId = AccountId.fromString(operatorIdStr);
    const operatorKey = PrivateKey.fromStringECDSA(operatorKeyStr);
    client = Client.forTestnet().setOperator(operatorId, operatorKey);

    // NOTE: Create a HCS topic
    // Step (1) in the accompanying tutorial
    blueLog('Creating new HCS topic');
    const topicCreateTx = await new TopicCreateTransaction()
        .setTransactionMemo(hfwId)
        .setTopicMemo(`HFW-HCS topic by ${yourName}`)
        // Freeze the transaction to prepare for signing
        .freezeWith(client);

    // Get the transaction ID of the transaction.
    // The SDK automatically generates and assigns a transaction ID when the transaction is created
    const topicCreateTxId = topicCreateTx.transactionId;
    console.log('The topic create transaction ID: ',
        topicCreateTxId.toString());

    // Sign the transaction with the account key that will be paying for this transaction
    const topicCreateTxSigned = await topicCreateTx.sign(operatorKey);

    // Submit the transaction to the Hedera Testnet
    const topicCreateTxSubmitted = await topicCreateTxSigned.execute(client);

    // Get the transaction receipt
    const topicCreateTxReceipt = await topicCreateTxSubmitted.getReceipt(client);

    // Get the topic ID
    const topicId = topicCreateTxReceipt.topicId;
    console.log('topicId:', topicId.toString());

    // NOTE: Publish a message to the HCS topic
    // Step (2) in the accompanying tutorial
    const topicMsgSubmitTx = await new TopicMessageSubmitTransaction()
        .setTransactionMemo(hfwId)
        .setTopicId(topicId)
        .setMessage(`Hello HCS! - ${yourName}`)
        // Freeze the transaction to prepare for signing
        .freezeWith(client);

    // Get the transaction ID of the transaction. The SDK automatically generates and assigns a transaction ID when the transaction is created
    const topicMsgSubmitTxId = topicMsgSubmitTx.transactionId;
    console.log('The message submit create transaction ID: ',
        topicMsgSubmitTxId.toString());

    // Sign the transaction with the account key that will be paying for this transaction
    const topicMsgSubmitTxSigned = await topicMsgSubmitTx.sign(operatorKey);

    // Submit the transaction to the Hedera Testnet
    const topicMsgSubmitTxSubmitted = await topicMsgSubmitTxSigned.execute(client);

    // Get the transaction receipt
    const topicMsgSubmitTxReceipt = await topicMsgSubmitTxSubmitted.getReceipt(client);

    // Get the topic message sequence number
    const topicMsgSeqNum = topicMsgSubmitTxReceipt.topicSequenceNumber;
    console.log('topicMsgSeqNum:', topicMsgSeqNum.toString());
    console.log('');

    client.close();

    // NOTE: Verify transactions using Hashscan
    // Step (3) in the accompanying tutorial
    // This is a manual step, the code below only outputs the URL to visit

    // View your topic on HashScan
    blueLog('View the topic on HashScan');
    const topicVerifyHashscanUrl = `https://hashscan.io/testnet/topic/${topicId.toString()}`;
    console.log('Paste URL in browser:', topicVerifyHashscanUrl);
    console.log('');

    // Wait for 6s for record files (blocks) to propagate to mirror nodes
    await new Promise((resolve) => setTimeout(resolve, 6_000));

    // NOTE: Verify topic using Mirror Node API
    // Step (4) in the accompanying tutorial
    blueLog('Get topic data from the Hedera Mirror Node');
    const topicVerifyMirrorNodeApiUrl =
        `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId.toString()}/messages?encoding=base64&limit=5&order=asc&sequencenumber=1`;
    console.log(
        'The topic Hedera Mirror Node API URL:\n',
        topicVerifyMirrorNodeApiUrl
    );
    const topicVerifyFetch = await fetch(topicVerifyMirrorNodeApiUrl);
    const topicVerifyJson = await topicVerifyFetch.json();
    const topicVerifyMessages =
        topicVerifyJson?.messages;
    console.log('Number of messages retrieved from this topic:', topicVerifyMessages?.length || 0);
    const topicVerifyMessagesParsed = (topicVerifyMessages || [])
        .map((msg) => {
            const seqNum = msg?.sequence_number || -1;
            const decodedMsg = Buffer.from((msg?.message || ''), 'base64').toString();
            return `#${seqNum}: ${decodedMsg}`;
        });
    console.log('Messages retrieved from this topic:', topicVerifyMessagesParsed);
    console.log('');

    metricsTrackOnHcs('scriptHcsTopic', 'complete');
}

scriptHcsTopic().catch((ex) => {
    if (client) {
        client.close();
    }
    console.error(ex);
    metricsTrackOnHcs('scriptHcsTopic', 'error');
});
