#!/usr/bin/env node

import fs from 'node:fs/promises';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { ContractFactory } from '@ethersproject/contracts';
import dotenv from 'dotenv';
import {
  CHARS,
  createLogger,
  calculateTransactionFeeFromViem,
} from '../util/util.js';

const logger = await createLogger({
  scriptId: 'hscsSC',
  scriptCategory: 'task',
});
const solidityFileName = 'my_contract_sol_MyContract';
let client;

async function scriptHscsSmartContract() {
  logger.logStart('Hello Future World - HSCS smart contract - start');

  // Read in environment variables from `.env` file in parent directory
  dotenv.config({ path: '../.env' });

  // Initialize the operator account
  const operatorIdStr = process.env.OPERATOR_ACCOUNT_ID;
  const operatorKeyStr = process.env.OPERATOR_ACCOUNT_PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL;
  if (!operatorIdStr || !operatorKeyStr || !rpcUrl) {
    throw new Error(
      'Must set OPERATOR_ACCOUNT_ID, OPERATOR_ACCOUNT_PRIVATE_KEY, and RPC_URL environment variables',
    );
  }

  logger.logSection('Initializing operator account');
  const rpcProvider = new JsonRpcProvider(rpcUrl);
  const operatorWallet = new Wallet(operatorKeyStr, rpcProvider);
  const operatorAddress = operatorWallet.address;
  logger.log('Operator account initialized:', operatorAddress);

  // Compile smart contract
  await logger.logSection('Reading compiled smart contract artefacts');
  const abi = await fs.readFile(`${solidityFileName}.abi`, {
    encoding: 'utf8',
  });
  const evmBytecode = await fs.readFile(`${solidityFileName}.bin`, {
    encoding: 'utf8',
  });
  logger.log(
    'Compiled smart contract ABI:',
    abi.substring(0, 32),
    CHARS.HELLIP,
  );
  logger.log(
    'Compiled smart contract EVM bytecode:',
    evmBytecode.substring(0, 32),
    CHARS.HELLIP,
  );

  // Deploy smart contract
  // NOTE: Prepare smart contract for deployment
  await logger.logSection('Deploying smart contract');
  const myContractFactory = new ContractFactory(
    abi,
    evmBytecode,
    operatorWallet,
  );
  const myContract = await myContractFactory.deploy();
  const deployTx = myContract.deployTransaction;
  const deploymentTxReceipt = await deployTx.wait();
  console.log(
    'Smart contract deployment transaction fee',
    calculateTransactionFeeFromViem(deploymentTxReceipt),
  );
  const deploymentTxAddress = myContract.address;
  logger.log('Smart contract deployment address:', deploymentTxAddress);
  const deploymentTxHashscanUrl = `https://hashscan.io/testnet/contract/${deploymentTxAddress}`;
  logger.log(
    'Smart contract deployment Hashscan URL:\n',
    ...logger.applyAnsi('URL', deploymentTxHashscanUrl),
  );

  // Write data to smart contract
  // NOTE: Invoke a smart contract transaction
  await logger.logSection('Write data to smart contract');
  const scWriteTxRequest = await myContract.functions.introduce(
    `${logger.version} - ${logger.scriptId}`,
  );
  const scWriteTxReceipt = await scWriteTxRequest.wait();
  logger.log(
    'Smart contract write transaction fee',
    calculateTransactionFeeFromViem(scWriteTxReceipt),
  );
  const scWriteTxHash = scWriteTxReceipt.transactionHash;
  const scWriteTxHashscanUrl = `https://hashscan.io/testnet/transaction/${scWriteTxHash}`;
  logger.log('Smart contract write transaction hash', scWriteTxHash);
  logger.log(
    'Smart contract write transaction Hashscan URL:\n',
    ...logger.applyAnsi('URL', scWriteTxHashscanUrl),
  );

  // Read data from smart contract
  // NOTE: Invoke a smart contract query
  await logger.logSection('Read data from smart contract');
  const [scReadQueryResult] = await myContract.functions.greet();
  logger.log('Smart contract read query result:', scReadQueryResult);

  logger.logComplete('Hello Future World - HSCS smart contract - complete');
}

scriptHscsSmartContract().catch((ex) => {
  client && client.close();
  logger ? logger.logError(ex) : console.error(ex);
});
