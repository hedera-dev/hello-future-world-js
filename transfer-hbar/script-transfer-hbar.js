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
    const yourName = process.env.YOUR_NAME;
    const operatorIdStr = process.env.OPERATOR_ACCOUNT_ID;
    const operatorKeyStr = process.env.OPERATOR_ACCOUNT_PRIVATE_KEY;

    if (!yourName || !operatorIdStr || !operatorKeyStr) {
        throw new Error('Must set YOUR_NAME, OPERATOR_ACCOUNT_ID, OPERATOR_ACCOUNT_PRIVATE_KEY');
    }
    const operatorId = AccountId.fromString(operatorIdStr);
    const operatorKey = PrivateKey.fromStringECDSA(operatorKeyStr);
    logger.log('Using your name as:', yourName);
    logger.log('Using account:', operatorIdStr);

    // The client operator ID and key is the account that will be automatically set to pay for the transaction fees for each transaction
    client = Client.forTestnet().setOperator(operatorId, operatorKey);

    const account1EvmAddress = process.env.ACCOUNT_1_EVM_ADDRESS;
    const account2EvmAddress = process.env.ACCOUNT_2_EVM_ADDRESS;
    logger.log('Will transfer HBAR to these accounts:', account1EvmAddress, account2EvmAddress);
    if (!account1EvmAddress || !account2EvmAddress) {
        throw new Error('Must set ACCOUNT_1_EVM_ADDRESS, ACCOUNT_2_EVM_ADDRESS');
    }

    // NOTE: Transfer HBAR using TransferTransaction
    // Step (1) in the accompanying tutorial
    logger.logSection('Creating, signing, and submitting the transfer transaction');

    const transferTx = await new TransferTransaction()
        .setTransactionMemo(logger.scriptId)
        // Debit 6.62607015 + 0.00000001 hbars from the operator account
        .addHbarTransfer(operatorId, new Hbar(-662607016, HbarUnit.Tinybar))
        // Credit 0.00000001 hbars to EVM address 0
        .addHbarTransfer(account1EvmAddress, new Hbar(1, HbarUnit.Tinybar))
        // Credit 6.62607015 hbars to EVM address 1
        .addHbarTransfer(account2EvmAddress, new Hbar(662607015, HbarUnit.Tinybar))
        // Freeze the transaction to prepare for signing
        .freezeWith(client);

    // Get the transaction ID for the transfer transaction
    const transferTxId = transferTx.transactionId;
    logger.log('The transfer transaction ID:', transferTxId.toString());

    // Sign the transaction with the account that is being debited (operator account) and the transaction fee payer account (operator account)
    // Since the account that is being debited and the account that is paying for the transaction are the same only one accoun'ts signature is required
    const transferTxSigned = await transferTx.sign(operatorKey);

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
        .setAccountId(account1EvmAddress)
        .execute(client);
    const newHbarBalance = (await newAccountBalance).hbars;
    logger.log('The new account balance after the transfer:', newHbarBalance.toString());

    client.close();

    logger.logSection('Get transfer transaction data from the Hedera Mirror Node');

    // Wait for 6s for record files (blocks) to propagate to mirror nodes
    await new Promise((resolve) => setTimeout(resolve, 6_000));

    // The transfer transaction mirror node API request
    const transferTxIdMirrorNodeFormat = convertTransactionIdForMirrorNodeApi(transferTxId);
    const transferTxVerifyMirrorNodeApiUrl = `https://testnet.mirrornode.hedera.com/api/v1/transactions/${transferTxIdMirrorNodeFormat}?nonce=0`;
    logger.log(
        'The transfer transaction Hedera Mirror Node API URL:',
        '\n',
        transferTxVerifyMirrorNodeApiUrl,
    );

    // The transfer transaction assessed transaction fee, debits, and credits in HBAR
    const transferFetch = await fetch(transferTxVerifyMirrorNodeApiUrl);
    const transferJson = await transferFetch.json();
    const transferJsonAccountTransfers = transferJson?.transactions[0]?.transfers;
    const transferJsonAccountTransfersFinalAmounts = transferJsonAccountTransfers
        ?.slice(-3)
        ?.map((obj) => Hbar.from(obj.amount, HbarUnit.Tinybar).toString(HbarUnit.Hbar));
    logger.log(
        'The debit and credit amounts of the transfer transaction:\n',
        transferJsonAccountTransfersFinalAmounts
      );

    // View the transaction in HashScan
    logger.logSection('View the transfer transaction transaction in HashScan');
    const transferTxVerifyHashscanUrl = `https://hashscan.io/testnet/transaction/${transferTxId}`;
    logger.log(
        'Copy and paste this URL in your browser:',
        '\n',
        transferTxVerifyHashscanUrl,
    );

    logger.logComplete('Hello Future World - Transfer Hbar - complete');
}

scriptTransferHbar().catch((ex) => {
    client && client.close();
    logger ? logger.logError(ex) : console.error(ex);
});
