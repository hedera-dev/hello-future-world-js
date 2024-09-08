#!/usr/bin/env node

import {
  Client,
  Hbar,
  PrivateKey,
  AccountId,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
} from '@hashgraph/sdk';
import dotenv from 'dotenv';
import { createLogger } from '../util/util.js';

const logger = await createLogger({
  scriptId: 'hcsTopic',
  scriptCategory: 'task',
});
let client;

async function scriptHcsTopic() {
  logger.logStart('Hello Future World - HCS Topic - start');

  // Read in environment variables from `.env` file in parent directory
  dotenv.config({ path: '../.env' });
  logger.log('Read .env file');

  // Initialize the operator account
  const operatorIdStr = process.env.OPERATOR_ACCOUNT_ID;
  const operatorKeyStr = process.env.OPERATOR_ACCOUNT_PRIVATE_KEY;
  if (!operatorIdStr || !operatorKeyStr) {
    throw new Error(
      'Must set OPERATOR_ACCOUNT_ID and OPERATOR_ACCOUNT_PRIVATE_KEY environment variables',
    );
  }
  const operatorId = AccountId.fromString(operatorIdStr);
  const operatorKey = PrivateKey.fromStringECDSA(operatorKeyStr);
  client = Client.forTestnet().setOperator(operatorId, operatorKey);
  logger.log('Using account:', operatorIdStr);

  //Set the default maximum transaction fee (in HBAR)
  client.setDefaultMaxTransactionFee(new Hbar(100));
  //Set the default maximum payment for queries (in HBAR)
  client.setDefaultMaxQueryPayment(new Hbar(50));

  // NOTE: Create a Hedera Consensus Service (HCS) topic
  await logger.logSection('Creating new HCS topic');
  const topicCreateTx = await new TopicCreateTransaction()
    .setTopicMemo(`Hello Future World topic - ${logger.version}`)
    // Freeze the transaction to prepare for signing
    .freezeWith(client);

  // Get the transaction ID of the transaction.
  // The SDK automatically generates and assigns a transaction ID when the transaction is created
  const topicCreateTxId = topicCreateTx.transactionId;
  logger.log('The topic create transaction ID: ', topicCreateTxId.toString());

  // Sign the transaction with the account key that will be paying for this transaction
  const topicCreateTxSigned = await topicCreateTx.sign(operatorKey);

  // Submit the transaction to the Hedera Testnet
  const topicCreateTxSubmitted = await topicCreateTxSigned.execute(client);

  // Get the transaction receipt
  const topicCreateTxReceipt = await topicCreateTxSubmitted.getReceipt(client);

  // Get the topic ID
  const topicId = topicCreateTxReceipt.topicId;
  logger.log('topicId:', topicId.toString());

  // NOTE: Publish a message to the Hedera Consensus Service (HCS) topic
  await logger.logSection('Publish message to HCS topic');
  const topicMsgSubmitTx = await new TopicMessageSubmitTransaction()
    //Set the transaction memo with the hello future world ID
    .setTransactionMemo(`Hello Future World topic message - ${logger.version}`)
    .setTopicId(topicId)
    //Set the topic message contents
    .setMessage('Hello HCS!')
    // Freeze the transaction to prepare for signing
    .freezeWith(client);

  // Get the transaction ID of the transaction. The SDK automatically generates and assigns a transaction ID when the transaction is created
  const topicMsgSubmitTxId = topicMsgSubmitTx.transactionId;
  logger.log(
    'The message submit create transaction ID: ',
    topicMsgSubmitTxId.toString(),
  );

  // Sign the transaction with the account key that will be paying for this transaction
  const topicMsgSubmitTxSigned = await topicMsgSubmitTx.sign(operatorKey);

  // Submit the transaction to the Hedera Testnet
  const topicMsgSubmitTxSubmitted =
    await topicMsgSubmitTxSigned.execute(client);

  // Get the transaction receipt
  const topicMsgSubmitTxReceipt =
    await topicMsgSubmitTxSubmitted.getReceipt(client);

  // Get the topic message sequence number
  const topicMsgSeqNum = topicMsgSubmitTxReceipt.topicSequenceNumber;
  logger.log('topicMsgSeqNum:', topicMsgSeqNum.toString());

  client.close();

  // NOTE: Verify transactions using Hashscan
  // This is a manual step, the code below only outputs the URL to visit

  // View your topic on HashScan
  await logger.logSection('View the topic on HashScan');
  const topicVerifyHashscanUrl = `https://hashscan.io/testnet/topic/${topicId.toString()}`;
  logger.log(
    'Paste URL in browser:\n',
    ...logger.applyAnsi('URL', topicVerifyHashscanUrl),
  );

  // Wait for 6s for record files (blocks) to propagate to mirror nodes
  await new Promise((resolve) => setTimeout(resolve, 6_000));

  // NOTE: Verify topic using Mirror Node API
  await logger.logSection('Get topic data from the Hedera Mirror Node');
  const topicVerifyMirrorNodeApiUrl = `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId.toString()}/messages?encoding=base64&limit=5&order=asc&sequencenumber=1`;
  logger.log(
    'The topic Hedera Mirror Node API URL:\n',
    ...logger.applyAnsi('URL', topicVerifyMirrorNodeApiUrl),
  );
  const topicVerifyFetch = await fetch(topicVerifyMirrorNodeApiUrl);
  const topicVerifyJson = await topicVerifyFetch.json();
  const topicVerifyMessages = topicVerifyJson?.messages;
  logger.log(
    'Number of messages retrieved from this topic:',
    topicVerifyMessages?.length || 0,
  );
  const topicVerifyMessagesParsed = (topicVerifyMessages || []).map((msg) => {
    const seqNum = msg?.sequence_number || -1;
    const decodedMsg = Buffer.from(msg?.message || '', 'base64').toString();
    return `#${seqNum}: ${decodedMsg}`;
  });
  logger.log('Messages retrieved from this topic:', topicVerifyMessagesParsed);

  logger.logComplete('Hello Future World - HCS Topic - complete');
}

scriptHcsTopic().catch((ex) => {
  client && client.close();
  logger ? logger.logError(ex) : console.error(ex);
});
