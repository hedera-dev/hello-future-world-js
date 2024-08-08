#!/usr/bin/env node

import {
    Client,
    PrivateKey,
    AccountId,
    TransferTransaction,
    Hbar,
    HbarUnit,
    AccountBalanceQuery,
} from '@hashgraph/sdk';
import dotenv from 'dotenv';
import {
    convertTransactionIdForMirrorNodeApi,
    createLogger,
} from '../util/util.js';

const logger = await createLogger({
    scriptId: 'transferHbar',
    scriptCategory: 'task',
});
let client;

async function scriptTransferHbar() {
    logger.logStart('Hello Future World - Transfer Hbar - start');

    // Read in environment variables from `.env` file in parent directory
    dotenv.config({ path: '../.env' });
    logger.log('Read .env file');

    // Initialise the operator account
    const operatorIdStr = process.env.OPERATOR_ACCOUNT_ID;
    const operatorKeyStr = process.env.OPERATOR_ACCOUNT_PRIVATE_KEY;

    if (!operatorIdStr || !operatorKeyStr) {
        throw new Error('Must set YOUR_NAME, OPERATOR_ACCOUNT_ID, OPERATOR_ACCOUNT_PRIVATE_KEY');
    }
    const operatorId = AccountId.fromString(operatorIdStr);
    const operatorKey = PrivateKey.fromStringECDSA(operatorKeyStr);
    logger.log('Using account:', operatorIdStr);

    // The client operator ID and key is the account that will be automatically set to pay for the transaction fees for each transaction
    client = Client.forTestnet().setOperator(operatorId, operatorKey);

    // NOTE: Transfer HBAR using TransferTransaction
    // Step (1) in the accompanying tutorial
    await logger.logSectionWithWaitPrompt(
        'Creating, signing, and submitting the transfer transaction');

    const transferTx = await new TransferTransaction()
        .setTransactionMemo(`Hello Future World transfer - ${logger.version}`)
        // Debit -10 HBAR from the operator account (sender)
        .addHbarTransfer(operatorId, new Hbar(-10, HbarUnit.Hbar))
        // Credit 5 HBAR to account 0.0.200 (1st recipient)
        .addHbarTransfer('0.0.200', new Hbar(5, HbarUnit.Hbar))
        // Credit 5 HBAR to account 0.0.201 (2nd recipient)
        .addHbarTransfer('0.0.201', new Hbar(5, HbarUnit.Hbar))
        // Freeze the transaction to prepare for signing
        .freezeWith(client);

    // Get the transaction ID for the transfer transaction
    const transferTxId = transferTx.transactionId;
    logger.log('The transfer transaction ID:', transferTxId.toString());

    // Sign the transaction with the account that is being debited (operator account) and the transaction fee payer account (operator account)
    // Since the account that is being debited and the account that is paying for the transaction are the same, only one account's signature is required
for transferTxSigned = await transferTx.sign(operatorKey);

    //Submit the transaction to the Hedera Testnet
    const transferTxSubmitted = await transferTxSigned.execute(client);

    //Get the transfer transaction receipt
    const transferTxReceipt = await transferTxSubmitted.getReceipt(client);
    const transactionStatus = transferTxReceipt.status;
    logger.log(
        'The transfer transaction status is:',
        transactionStatus.toString(),
    );

    // NOTE: Query HBAR balance using AccountBalanceQuery
    // Step (2) in the accompanying tutorial
    const newAccountBalance = new AccountBalanceQuery()
        .setAccountId('0.0.1')
        .execute(client);
    const newHbarBalance = (await newAccountBalance).hbars;
    logger.log('The new account balance after the transfer:', newHbarBalance.toString());

    client.close();

    // View the transaction in HashScan
    await logger.logSectionWithWaitPrompt('View the transfer transaction transaction in HashScan');
    const transferTxVerifyHashscanUrl = `https://hashscan.io/testnet/transaction/${transferTxId}`;
    logger.log(
        'Copy and paste this URL in your browser:\n',
        ...logger.applyAnsi('URL', transferTxVerifyHashscanUrl),
    );

    await logger.logSectionWithWaitPrompt('Get transfer transaction data from the Hedera Mirror Node');

    // Wait for 6s for record files (blocks) to propagate to mirror nodes
    await new Promise((resolve) => setTimeout(resolve, 6_000));

    // The transfer transaction mirror node API request
    const transferTxIdMirrorNodeFormat = convertTransactionIdForMirrorNodeApi(transferTxId);
    const transferTxVerifyMirrorNodeApiUrl = `https://testnet.mirrornode.hedera.com/api/v1/transactions/${transferTxIdMirrorNodeFormat}?nonce=0`;
    logger.log(
        'The transfer transaction Hedera Mirror Node API URL:\n',
        ...logger.applyAnsi('URL', transferTxVerifyMirrorNodeApiUrl),
    );

    // The transfer transaction assessed transaction fee, debits, and credits in HBAR
    const transferFetch = await fetch(transferTxVerifyMirrorNodeApiUrl);
    const transferJson = await transferFetch.json();
    const transferJsonAccountTransfers = transferJson?.transactions[0]?.transfers;
    const transferJsonAccountTransfersFinalAmounts = transferJsonAccountTransfers
        ?.map((obj) => Hbar.from(obj.amount, HbarUnit.Tinybar).toString(HbarUnit.Hbar));
    logger.log(
        'The debit and credit amounts of the transfer transaction:\n',
        transferJsonAccountTransfersFinalAmounts
      );

    logger.logComplete('Hello Future World - Transfer Hbar - complete');
}

scriptTransferHbar().catch((ex) => {
    client && client.close();
    logger ? logger.logError(ex) : console.error(ex);
});
