#!/usr/bin/env node

import fs from 'node:fs/promises';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { ContractFactory } from '@ethersproject/contracts';
import dotenv from 'dotenv';
import {
    HELLIP_CHAR,
    blueLog,
} from '../util/util.js';

const solidityFileName = 'my_contract_sol_MyContract';

async function scriptHscsSmartContract() {
    // Read in environment variables from `.env` file in parent directory
    dotenv.config({ path: '../.env' });

    // Initialise the operator account
    const yourName = process.env.YOUR_NAME;
    const operatorIdStr = process.env.OPERATOR_ACCOUNT_ID;
    const operatorKeyStr = process.env.OPERATOR_ACCOUNT_PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL;
    if (!yourName || !operatorIdStr || !operatorKeyStr || !rpcUrl) {
        throw new Error('Must set YOUR_NAME, OPERATOR_ACCOUNT_ID, OPERATOR_ACCOUNT_PRIVATE_KEY, and RPC_URL environment variables');
    }

    // initialise operator account
    blueLog('Initialising operator account' + HELLIP_CHAR);
    const rpcProvider = new JsonRpcProvider(rpcUrl);
    const operatorWallet = new Wallet(operatorKeyStr, rpcProvider);
    const operatorAddress = operatorWallet.address;
    const operatorAccountHashscanUrl = `https://hashscan.io/testnet/account/${operatorAddress}`;
    console.log('Operator account Hashscan URL', operatorAccountHashscanUrl);
    console.log('');

    // Compile smart contract
    blueLog('Reading compiled smart contract artefacts' + HELLIP_CHAR);
    const abi = await fs.readFile(`${solidityFileName}.abi`, { encoding: 'utf8' });
    const evmBytecode = await fs.readFile(`${solidityFileName}.bin`, { encoding: 'utf8' });
    console.log('Compiled smart contract ABI:', abi.substring(0, 32), HELLIP_CHAR);
    console.log('Compiled smart contract EVM bytecode:', evmBytecode.substring(0, 32), HELLIP_CHAR);
    console.log('');

    // Deploy smart contract
    // NOTE: Prepare smart contract for deployment
    // Step (2) in the accompanying tutorial
    blueLog('Deploying smart contract' + HELLIP_CHAR);
    const myContractFactory = new ContractFactory(abi, evmBytecode, operatorWallet);
    const myContract = await myContractFactory.deploy();
    await myContract.deployTransaction.wait();
    const myContractAddress = myContract.address;
    const myContractHashscanUrl = `https://hashscan.io/testnet/contract/${myContractAddress}`;
    console.log('Deployed smart contract address:', myContractAddress);
    console.log('Deployed smart contract Hashscan URL:', myContractHashscanUrl);
    console.log('');

    // Write data to smart contract
    // NOTE: Invoke a smart contract transaction
    // Step (3) in the accompanying tutorial
    blueLog('Write data to smart contract' + HELLIP_CHAR);
    const scWriteTxRequest = await myContract.functions.introduce(yourName);
    const scWriteTxReceipt = await scWriteTxRequest.wait();
    const scWriteTxHash = scWriteTxReceipt.transactionHash;
    const scWriteTxHashscanUrl = `https://hashscan.io/testnet/transaction/${scWriteTxHash}`;
    console.log('Smart contract write transaction hash', scWriteTxHash);
    console.log('Smart contract write transaction Hashscan URL', scWriteTxHashscanUrl);
    console.log('');

    // Read data from smart contract
    // NOTE: Invoke a smart contract query
    // Step (4) in the accompanying tutorial
    blueLog('Read data from smart contract' + HELLIP_CHAR);
    const [scReadQueryResult] = await myContract.functions.greet();
    console.log('Smart contract read query result', scReadQueryResult);
    console.log('');
}

scriptHscsSmartContract();
