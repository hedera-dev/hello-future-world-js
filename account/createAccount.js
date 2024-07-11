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

async function createAccount() {
    // Read in environment variables from `.env` file in parent directory
    dotenv.config({ path: '../.env' });

    // Initialise the operator account
    const operatorIdStr = process.env.OPERATOR_ACCOUNT_ID;
    const operatorEcdsaKeyStr = process.env.OPERATOR_ACCOUNT_PRIVATE_KEY;

    if (!operatorIdStr || !operatorKeyStr) {
        throw new Error('Must set OPERATOR_ACCOUNT_ID, OPERATOR_ACCOUNT_PRIVATE_KEY');
    }
    const operatorAccountId = AccountId.fromString(operatorIdStr);
    const operatorEcdsaKey = PrivateKey.fromStringECDSA(operatorKeyStr);

    //The client operator ID and key is the account that will be automatically set to pay for the transaction fees for each transaction
    const client = Client.forTestnet().setOperator(operatorId, operatorKey);

    //Generate a key for your new account
    const account1PrivateKey = PrivateKey.generateECDSA();
    const account1PublicKey = account1PrivateKey.publicKey;

    // NOTE: Create new account using AccountCreateTransaction, setting the initial hbar balance of 5 and an account key
    // Step (1) in the accompanying tutorial
    const YOUR_NAME = '<enterYourName>';

    console.log("\x1b[34m%s\x1b[0m","🔵 Creating, signing and submitting the account create transaction...");
    const accountCreateTx = await new AccountCreateTransaction({
        initialBalance: new Hbar(5),
        key: account1PrivateKey,
        accountMemo: `Hello Future World from ${YOUR_NAME}'s first account!`,
    }).freezeWith(client); //Freeze the transaction to prepare for signing

    //Get the transaction ID of the transaction. The SDK automatically generates and assigns a transaction ID when the transaction is created
    const accountCreateTransactionId = accountCreateTx.transactionId;
    console.log(
        "The account create transaction ID: " + accountCreateTransactionId
    );

    //Sign the transaction with the account key that will be paying for this transaction
    const accountCreateTxSigned = await accountCreateTx.sign(operatorKey);

    //Submit the transaction to the Hedera Testnet
    const accountCreateTxSubmitted = await accountCreateTxSigned.execute(client);

    //Get the transaction receipt 
    const accountCreateTxReceipt = await accountCreateTxSubmitted.getReceipt(client);

    //Get the account ID
    const account1Id = accountCreateTxReceipt.accountId;
    console.log('account1Id:', account1Id.toString());

    //Get the account balance from a consensus node
    const accountBalance = new AccountBalanceQuery()
        .setAccountId(account1Id)
        .execute(client);

    console.log("The new account balance is: " + (await accountBalance).hbars);
    console.log(" ");

    console.log("\x1b[34m%s\x1b[0m","🔵 Get account data from the Hedera Mirror Node...");

    // Wait for 6s for record files (blocks) to propagate to mirror nodes
    await new Promise((resolve) => setTimeout(resolve, 6_000));

    //Hedera Mirror Node account information request
    const accountInfoMirrorNodeApiUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${account1Id.toString()}?limit=1&order=asc&transactiontype=cryptotransfer&transactions=false`;
    console.log(
        "The account info Hedera Mirror Node API request: \n" +
          accountInfoMirrorNodeApiUrl
      );
    const accountCreateFetch = await fetch(accountInfoMirrorNodeApiUrl);
    const accountCreateJson = await accountCreateFetch.json();
    const accountCreateJsonAccountMemo = accountCreateJson?.memo;
    console.log("The account memo: ", accountCreateJsonAccountMemo);
    console.log(" ");

    //Hedera mirror node account create transaction request
    let [accountCreateTxIdA, accountCreatetransferTxIdB] =
    accountCreateTransactionId.toString().split("@");
    accountCreatetransferTxIdB = accountCreatetransferTxIdB.replace(".", "-");
    const accountCreateTxIdMirrorNodeFormat = `${accountCreateTxIdA}-${accountCreatetransferTxIdB}`;
    const accountCreateTxVerifyMirrorNodeApiUrl = `https://testnet.mirrornode.hedera.com/api/v1/transactions/${accountCreateTxIdMirrorNodeFormat}?nonce=0`;
    console.log(
        "The account create transaction Hedera Mirror Node API request: \n",
        accountCreateTxVerifyMirrorNodeApiUrl
      );
    console.log(" ");
    
    //View the account create transaction on HashScan
    console.log(
        "\x1b[34m%s\x1b[0m",
        "🔵 View the account create transaction on HashScan..."
      );
    const accountCreateTxVerifyHashscanUrl = `https://hashscan.io/testnet/transaction/${accountCreateTransactionId}`;
    console.log(
        "URL to the account create transaction on HashScan:",
        accountCreateTxVerifyHashscanUrl
      );
    console.log(" ");

    //View your account on HashScan
    console.log("\x1b[34m%s\x1b[0m", "🔵 View the account on HashScan...");
    const accountVerifyHashscanUrl = `https://hashscan.io/testnet/account/${account1Id.toString()}`;
    console.log("URL to your account on HashScan:", accountVerifyHashscanUrl);
    console.log(" ");

    //View the account create transaction on HashScan
    console.log(
        "\x1b[34m%s\x1b[0m",
        "🔵 View the account create transaction on HashScan..."
    );
    const accountCreateTxVerifyHashscanUrl = `https://hashscan.io/testnet/transaction/${accountCreateTransactionId}`;
    console.log(
        "URL to the account create transaction on HashScan:",
        accountCreateTxVerifyHashscanUrl
    );
    console.log(" ");

    // Now you should have a new account, with an assigned ID in `0.0.accountNum` format,
    // and it should have a balance of 5 HBAR transferred from the operator account during creation

    // NOTE: Transfer HBAR using TransferTransaction
    // Step (2) in the accompanying tutorial
    console.log("\x1b[34m%s\x1b[0m", "🔵 Creating, signing, and submitting the transfer transaction...");

    const transferTx = await new TransferTransaction()
        //Debit 5 hbars from the operator account
        .addHbarTransfer(operatorId, -5)
         //Credit 5 hbars from the new account
        .addHbarTransfer(account1Id, 5)
         // Freeze the transaction to prepare for signing
        .freezeWith(client);

    //Get the transaction ID for the transfer transaction
    const transferTxId = transferTx.transactionId;
    console.log("transferTxId:", transferTxId.toString());
    console.log(" ");

    //Sign the transaction with the account that is being debited (operator account) and the transaction fee payer account (operator account)
    //Since the account that is being debited and the account that is paying for the transaction are the same only one accoun'ts signature is required
    const transferTxSigned = await transferTx.sign(operatorKey);

    //Submit the transaction to the Hedera Testnet
    const transferTxSubmitted = await transferTxSigned.execute(client);

    console.log(
    "\x1b[34m%s\x1b[0m",
    "🔵 Get transfer transaction data from the Hedera Mirror Node..."
      );

    // Wait for 10s for record files (blocks) to propagate to mirror nodes
    await new Promise((resolve) => setTimeout(resolve, 6_000));

    //The transfer transaction mirror node API resquest

    let [transferTxIdA, transferTxIdB] = transferTxId.toString().split("@");
    transferTxIdB = transferTxIdB.replace(".", "-");
    const transferTxIdMirrorNodeFormat = `${transferTxIdA}-${transferTxIdB}`;
    const transferTxVerifyMirrorNodeApiUrl = `https://testnet.mirrornode.hedera.com/api/v1/transactions/${transferTxIdMirrorNodeFormat}?nonce=0`;
    console.log(
        "The transfer transaction Hedera Mirror Node API request: \n",
        transferTxVerifyMirrorNodeApiUrl
    );
    console.log(" ");

    //The transfer transaction assessed transaction fee, debits, and credits in HBAR
    const transferFetch = await fetch(transferTxVerifyMirrorNodeApiUrl);
    const transferJson = await transferFetch.json();
    const transferJsonAccountTransfers = transferJson?.transactions[0]?.transfers;
    const transferJsonAccountTransfersFinal3Amounts = transferJsonAccountTransfers
        ?.slice(-3)
        ?.map((obj) => obj.amount / 100000000);
    console.log(
        "The transfer transaction transfer amounts in hbar \n",
        transferJsonAccountTransfersFinal3Amounts
      );
    console.log(" ");

    //View the transaction in HashScan
    console.log(
        "\x1b[34m%s\x1b[0m",
        "🔵 View the transfer transaction transaction in HashScan..."
    );
    const transferTxVerifyHashscanUrl = `https://hashscan.io/testnet/transaction/${transferTxId}`;
    console.log(
        "URL to the transfer transaction on HashScan:",
        transferTxVerifyHashscanUrl
    );
    console.log(" ");
    client.close();
    }

createAccount();
