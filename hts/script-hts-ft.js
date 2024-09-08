#!/usr/bin/env node

import {
  Client,
  Hbar,
  PrivateKey,
  AccountId,
  TokenCreateTransaction,
  TokenType,
} from '@hashgraph/sdk';
import dotenv from 'dotenv';
import { createLogger } from '../util/util.js';

const logger = await createLogger({
  scriptId: 'htsFt',
  scriptCategory: 'task',
});
let client;

async function scriptHtsFungibleToken() {
  logger.logStart('Hello Future World - HTS Fungible Token - start');

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

  // NOTE: Create a HTS token
  await logger.logSection('Creating new HTS token');
  const tokenCreateTx = await new TokenCreateTransaction()
    //Set the transaction memo
    .setTransactionMemo(`Hello Future World token - ${logger.version}`)
    // HTS `TokenType.FungibleCommon` behaves similarly to ERC20
    .setTokenType(TokenType.FungibleCommon)
    // Configure token options: name, symbol, decimals, initial supply
    .setTokenName(`${logger.scriptId} coin`)
    // Set the token symbol
    .setTokenSymbol(logger.scriptId.toUpperCase())
    // Set the token decimals to 2
    .setDecimals(2)
    // Set the initial supply of the token to 1,000,000
    .setInitialSupply(1_000_000)
    // Configure token access permissions: treasury account, admin, freezing
    .setTreasuryAccountId(operatorId)
    // Set the freeze default value to false
    .setFreezeDefault(false)
    //Freeze the transaction and prepare for signing
    .freezeWith(client);

  // Get the transaction ID of the transaction. The SDK automatically generates and assigns a transaction ID when the transaction is created
  const tokenCreateTxId = tokenCreateTx.transactionId;
  logger.log('The token create transaction ID: ', tokenCreateTxId.toString());

  // Sign the transaction with the private key of the treasury account (operator key)
  const tokenCreateTxSigned = await tokenCreateTx.sign(operatorKey);

  // Submit the transaction to the Hedera Testnet
  const tokenCreateTxSubmitted = await tokenCreateTxSigned.execute(client);

  // Get the transaction receipt
  const tokenCreateTxReceipt = await tokenCreateTxSubmitted.getReceipt(client);

  // Get the token ID
  const tokenId = tokenCreateTxReceipt.tokenId;
  logger.log('tokenId:', tokenId.toString());

  client.close();

  // NOTE: Verify transactions using Hashscan
  // This is a manual step, the code below only outputs the URL to visit

  // View your token on HashScan
  await logger.logSection('View the token on HashScan');
  const tokenVerifyHashscanUrl = `https://hashscan.io/testnet/token/${tokenId.toString()}`;
  logger.log(
    'Paste URL in browser:\n',
    ...logger.applyAnsi('URL', tokenVerifyHashscanUrl),
  );

  // Wait for 6s for record files (blocks) to propagate to mirror nodes
  await new Promise((resolve) => setTimeout(resolve, 6_000));

  // NOTE: Verify token using Mirror Node API
  await logger.logSection('Get token data from the Hedera Mirror Node');
  const tokenVerifyMirrorNodeApiUrl = `https://testnet.mirrornode.hedera.com/api/v1/tokens/${tokenId.toString()}`;
  logger.log(
    'The token Hedera Mirror Node API URL:\n',
    ...logger.applyAnsi('URL', tokenVerifyMirrorNodeApiUrl),
  );
  const tokenVerifyFetch = await fetch(tokenVerifyMirrorNodeApiUrl);
  const tokenVerifyJson = await tokenVerifyFetch.json();
  const tokenVerifyName = tokenVerifyJson?.name;
  logger.log('The name of this token:', tokenVerifyName);
  const tokenVerifyTotalSupply = tokenVerifyJson?.total_supply;
  logger.log('The total supply of this token:', tokenVerifyTotalSupply);

  logger.logComplete('Hello Future World - HTS Fungible Token - complete');
}

scriptHtsFungibleToken().catch((ex) => {
  client && client.close();
  logger ? logger.logError(ex) : console.error(ex);
});
