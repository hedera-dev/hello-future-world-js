#!/usr/bin/env node

import {
    Client,
    PrivateKey,
    AccountId,
    AccountCreateTransaction,
    TransferTransaction,
    Hbar,
    HbarUnit,
} from '@hashgraph/sdk';
import dotenv from 'dotenv';

async function scriptAccount() {
    // Read in environment variables from `.env` file in parent directory
    dotenv.config({ path: '../.env' });

    // Initialise the operator account
    const operatorIdStr = process.env.OPERATOR_ACCOUNT_ID;
    const operatorKeyStr = process.env.OPERATOR_ACCOUNT_PRIVATE_KEY;
    const account1PrivateKeyStr = process.env.ACCOUNT_1_PRIVATE_KEY;
    const account2EvmAddress = process.env.ACCOUNT_2_EVM_ADDRESS;
    if (!operatorIdStr || !operatorKeyStr || !account1PrivateKeyStr || !account2EvmAddress) {
        throw new Error('Must set OPERATOR_ACCOUNT_ID, OPERATOR_ACCOUNT_PRIVATE_KEY, ACCOUNT_1_PRIVATE_KEY, and ACCOUNT_2_EVM_ADDRESS environment variables');
    }
    const operatorId = AccountId.fromString(operatorIdStr);
    const operatorKey = PrivateKey.fromStringECDSA(operatorKeyStr);
    const client = Client.forTestnet().setOperator(operatorId, operatorKey);
    const account1PrivateKey = PrivateKey.fromStringECDSA(account1PrivateKeyStr);

    // NOTE: Create new account using AccountCreateTransaction
    // Step (1) in the accompanying tutorial
    const YOUR_NAME = 'bguiz';
    const accountCreateTx = await new AccountCreateTransaction({
        initialBalance: new Hbar(5),
        key: account1PrivateKey,
        accountMemo: `Hello Future World from ${YOUR_NAME}'s first account!`,
    })
        .freezeWith(client);
    const accountCreateTxSigned = await accountCreateTx.sign(operatorKey);
    const accountCreateTxSubmitted = await accountCreateTxSigned.execute(client);
    const accountCreateTxReceipt = await accountCreateTxSubmitted.getReceipt(client);
    const account1Id = accountCreateTxReceipt.accountId;
    console.log('account1Id:', account1Id.toString());

    // Now you should have a new account, with an assigned ID in `0.0.nnn` format,
    // and it should have a balance of 5 HBAR transferred from the operator account during creation

    // NOTE: Transfer HBAR using TransferTransaction
    // Step (2) in the accompanying tutorial
    // TransferTransaction.TransferHbarInput: { accountId, amount }
    const transferTx = await new TransferTransaction({
        hbarTransfers: [
            {
                accountId: operatorId,
                amount: new Hbar((0 - 66260702 - 65821196), HbarUnit.Tinybar),
             },
             {
                 accountId: account1Id,
                 amount: new Hbar(66260702, HbarUnit.Tinybar),
              },
             {
                accountId: account2EvmAddress,
                amount: new Hbar(65821196, HbarUnit.Tinybar),
              },
        ],
    })
        .freezeWith(client);
    const transferTxSigned = await transferTx.sign(operatorKey);
    const transferTxSubmitted = await transferTxSigned.execute(client);
    const transferTxId = transferTxSubmitted.transactionId;
    console.log('transferTxId:', transferTxId.toString());

    client.close();

    // NOTE: Verify transactions using Hashscan
    // Step (3) in the accompanying tutorial
    // This is a manual step, the code below only outputs the URL to visit
    const accountCreateTxVerifyHashscanUrl =
        `https://hashscan.io/testnet/account/${account1Id.toString()}`;
    console.log('accountCreateTxVerifyHashscanUrl:', accountCreateTxVerifyHashscanUrl);

    const transferTxVerifyHashscanUrl =
        `https://hashscan.io/testnet/transaction/${transferTxId.toString()}`;
    console.log('transferTxVerifyHashscanUrl:', transferTxVerifyHashscanUrl);

    // Wait for 5s for record files (blocks) to propagate to mirror nodes
    await new Promise((resolve) => setTimeout(resolve, 5_000));

    // NOTE: Verify transactions using Mirror Node API
    // Step (4) in the accompanying tutorial
    const accountCreateTxVerifyMirrorNodeApiUrl =
        `https://testnet.mirrornode.hedera.com/api/v1/accounts/${account1Id.toString()}?limit=1&order=asc&transactiontype=cryptotransfer&transactions=false`;
    console.log('accountCreateTxVerifyMirrorNodeApiUrl:', accountCreateTxVerifyMirrorNodeApiUrl);
    const accountCreateFetch = await fetch(accountCreateTxVerifyMirrorNodeApiUrl);
    const accountCreateJson = await accountCreateFetch.json();
    const accountCreateJsonAccountMemo = accountCreateJson?.memo;
    console.log('accountCreateJsonAccountMemo:', accountCreateJsonAccountMemo);

    let [transferTxIdA, transferTxIdB] = transferTxId.toString().split('@');
    transferTxIdB = transferTxIdB.replace('.', '-');
    const transferTxIdMirrorNodeFormat = `${transferTxIdA}-${transferTxIdB}`;
    const transferTxVerifyMirrorNodeApiUrl =
        `https://testnet.mirrornode.hedera.com/api/v1/transactions/${transferTxIdMirrorNodeFormat}?nonce=0`;
    console.log('transferTxVerifyMirrorNodeApiUrl:', transferTxVerifyMirrorNodeApiUrl);
    const transferFetch = await fetch(transferTxVerifyMirrorNodeApiUrl);
    const transferJson = await transferFetch.json();
    const transferJsonAccountTransfers =
        transferJson?.transactions[0]?.transfers;
    const transferJsonAccountTransfersFinal3Amounts =
        transferJsonAccountTransfers?.slice(-3)?.map((obj) => obj.amount);
    console.log('transferJsonAccountTransfersFinal3Amounts:', transferJsonAccountTransfersFinal3Amounts);
}

scriptAccount();
