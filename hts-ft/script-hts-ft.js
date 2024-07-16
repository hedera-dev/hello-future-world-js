#!/usr/bin/env node

import {
    Client,
    PrivateKey,
    AccountId,
    TokenCreateTransaction,
    TokenType,
} from '@hashgraph/sdk';
import dotenv from 'dotenv';
import {
    HELLIP_CHAR,
    blueLog,
} from '../util/util.js';

async function scriptHtsFungibleToken() {
    // Read in environment variables from `.env` file in parent directory
    dotenv.config({ path: '../.env' });

    // Initialise the operator account
    const yourName = process.env.YOUR_NAME;
    const operatorIdStr = process.env.OPERATOR_ACCOUNT_ID;
    const operatorKeyStr = process.env.OPERATOR_ACCOUNT_PRIVATE_KEY;
    if (!yourName || !operatorIdStr || !operatorKeyStr) {
        throw new Error('Must set OPERATOR_ACCOUNT_ID and OPERATOR_ACCOUNT_PRIVATE_KEY environment variables');
    }
    const operatorId = AccountId.fromString(operatorIdStr);
    const operatorKey = PrivateKey.fromStringECDSA(operatorKeyStr);
    const client = Client.forTestnet().setOperator(operatorId, operatorKey);

    // NOTE: Create a HTS token
    // Step (1) in the accompanying tutorial
    blueLog('Creating new HTS token' + HELLIP_CHAR);
    const tokenCreateTx = await new TokenCreateTransaction()
        // HTS `TokenType.FungibleCommon` behaves similarly to ERC20
        .setTokenType(TokenType.FungibleCommon)
        // Configure token options: name, symbol, decimals, initial supply
        .setTokenName(`${yourName} coin`)
        .setTokenSymbol('HFW-HTS')
        .setDecimals(2)
        .setInitialSupply(1_000_000)
        // Configure token access permissions: treasury account, admin, freezing
        .setTreasuryAccountId(operatorId)
        .setAdminKey(operatorKey)
        .setFreezeDefault(false)
        // Freeze the transaction to prepare for signing
        .freezeWith(client);

    // Get the transaction ID of the transaction. The SDK automatically generates and assigns a transaction ID when the transaction is created
    const tokenCreateTxId = tokenCreateTx.transactionId;
    console.log('The token create transaction ID: ',
        tokenCreateTxId.toString());

    // Sign the transaction with the account key that will be paying for this transaction
    const tokenCreateTxSigned = await tokenCreateTx.sign(operatorKey);

    // Submit the transaction to the Hedera Testnet
    const tokenCreateTxSubmitted = await tokenCreateTxSigned.execute(client);

    // Get the transaction receipt
    const tokenCreateTxReceipt = await tokenCreateTxSubmitted.getReceipt(client);

    // Get the token ID
    const tokenId = tokenCreateTxReceipt.tokenId;
    console.log('tokenId:', tokenId.toString());
    console.log('');

    client.close();

    // NOTE: Verify transactions using Hashscan
    // Step (2) in the accompanying tutorial
    // This is a manual step, the code below only outputs the URL to visit

    // View your token on HashScan
    blueLog('View the token on HashScan' + HELLIP_CHAR);
    const tokenVerifyHashscanUrl = `https://hashscan.io/testnet/token/${tokenId.toString()}`;
    console.log('Paste URL in browser:', tokenVerifyHashscanUrl);
    console.log('');

    // Wait for 6s for record files (blocks) to propagate to mirror nodes
    await new Promise((resolve) => setTimeout(resolve, 6_000));

    // NOTE: Verify token using Mirror Node API
    // Step (3) in the accompanying tutorial
    blueLog('Get token data from the Hedera Mirror Node' + HELLIP_CHAR);
    const tokenVerifyMirrorNodeApiUrl =
        `https://testnet.mirrornode.hedera.com/api/v1/tokens/${tokenId.toString()}`;
    console.log(
        'The token Hedera Mirror Node API URL:\n',
        tokenVerifyMirrorNodeApiUrl
    );
    const tokenVerifyFetch = await fetch(tokenVerifyMirrorNodeApiUrl);
    const tokenVerifyJson = await tokenVerifyFetch.json();
    const tokenVerifyName =
        tokenVerifyJson?.name;
    console.log('The name of this token:', tokenVerifyName);
    const tokenVerifyTotalSupply =
        tokenVerifyJson?.total_supply;
    console.log('The total supply of this token:', tokenVerifyTotalSupply);
    console.log('');
}

scriptHtsFungibleToken();
