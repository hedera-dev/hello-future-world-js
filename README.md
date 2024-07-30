# Hello Future World - Javascript

Demo repo for Hello World sequences to build on Hedera, using Javascript.

> ⚠️ NOTE that this repo is still a work in progress,
> and is therefore incomplete.
> Sections are explicitly marked `(WIP)` as markers/ reminders.

To follow along, please read the **accompanying tutorial** at [docs.hedera.com](#TODO_LINK) (WIP).

Note that this demo repo is also available in 3 programming languages:

- [Javascript](https://github.com/hedera-dev/hello-future-world-js "Hello Future World - Javascript") (this repo)
- [Java](https://github.com/hedera-dev/hello-future-world-java "Hello Future World - Java") (WIP)
- [Go](https://github.com/hedera-dev/hello-future-world-go "Hello Future World - Go") (WIP)

## How to run

You may choose to run this demo repo and follow along the tutorial, either:
(a) on your own computer (recommended for experienced developers), or
(b) using Gitpod (recommended for quick/ easy setup).

### How to run on your computer

To run on your own computer, `git clone` this repo,
and follow the instructions in the "pre-requisites" section of the accompanying tutorial.

1. Install all the prerequisite software
1. Copy `.env.sample` into `.env` and update values manually
1. Alternatively run `./init/00-main.sh` and this script will interactively prompt you,
   and populate the values needed in the `.env` file
   - TODO specific instructions for prompts
1. Congratulations, you can now move on to the sequences! 🎉

### How to run on your computer

To run on Gitpod (a cloud development environment), click the button below:

<a href="https://gitpod.io/?autostart=true&editor=code&workspaceClass=g1-standard#https://github.com/hedera-dev/hello-future-world-js" target="_blank" rel="noreferrer">
  <img src="./img/gitpod-open-button.svg" />
</a>

1. Wait for Gitpod to load, this should take less than 10 seconds
1. In the VS code terminal, you should see 3 terminals, `rpcrelay_pull`, `rpcrelay_run`, and `main`
1. You do not need to use the `rpcrelay_pull` and `rpcrelay_run` terminals, let them run in the background
1. In the `main` terminal, which is the one that displays by default, a script will interactively prompt you
1. Follow the instructions in the script and copy-paste values or accept its default suggestions
   - TODO specific instructions for prompts
1. After the script has completed, open the `.env` file to inspect its contents
1. Congratulations, you can now move on to the sequences! 🎉

## Sequences

This repo contains the code required for all of the **Hello World** sequences.
The following sections outline what each sequence will cover.
Each one represents the bare minimum required to use various parts of Hedera technology.
Note that each sequence is intended to be completed in **under 10 minutes** when run via Gitpod.

### Setup script

What you will accomplish:

1. Answer interactive prompts in a terminal to construct a `.env` file
1. Generate accounts using a BIP-39 seed phrase (optional)
1. Fund one of those accounts using the Hedera Testnet Faucet (optional)

Steps:

1. Enter pseudonym
   - Input any value, can be fictional/ anonymous/ etc
   - Note that this will be written on the network
1. Enter private key
   - Option 1: Input `none`.
     This will mean that an account generated from a seed phrase will be used (later).
   - Option 2: Input any ECDSA sec256k1 private key.
     You may obtain this from [portal.hedera.com/dashboard](https://portal.hedera.com/dashboard).
1. Enter seed phrase
   - Option 1: Input nothing.
     This will generate a new seed BIP-39 phrase at random.
   - Option 2: Input any [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) compliant seed phrase
     You may generate one using any tool that supports BIP-39.
     If you would like to do this in the browser, you may use [iancoleman.io/bip39](https://iancoleman.io/bip39/)
1. Enter number of accounts
   - Input any whole number greater than or equal to `3`.
     This tutorial requires at least 3 to be generated from the BIP-39 seed phrase.
1. Please ensure that you have funded
   - To do so, copy the EVM address in the terminal output (starts with `0x`)
   - Then visit [faucet.hedera.com](https://faucet.hedera.com/)
   - Paste the EVM address into the "Enter Wallet Address" text field
   - Press the "Receive…" button
   - Pass the reCaptcha ("I'm not a robot")
   - Press the "Confirm transaction" button
   - Wait till you see the "Transaction successful" model dialog
   - Switch back to the script
   - There is no input required here, simply hit "Enter" or "Return" after funding the account
1. Enter JSON-RPC URL
   - Input nothing to accept the default value suggested by the script.
     - If running the script on your own computer, this value defaults to `https://localhost:7546/`
     - If running the script on Gitpod, this value defaults to something that matches the patterns`https://7546-*.gitpod.io/`
1. Overwrite?
   - Input `y` to update the `.env` file
1. Open the `.env` file and check that its contents have been updated

### Transfer HBAR

Demonstrates: Use of the Hedera network, at a base level.

<!--
[Go to accompanying tutorial](#TODO_LINK). (WIP)
-->

What you will accomplish:

1. Initialise `Client` using the Hedera SDK,
   by reading in credentials from the `.env` file generated earlier.
1. Send a `TransferTransaction` using the Hedera SDK.
   - Note that in Hedera, you can have debits and credits from multiple accounts,
     as long as their total tallies, and all debiting accounts sign the transaction.
     This is unlike in the EVM, where you would need a smart contract
     or some other intermediary to accomplish the same task.
   - `.sign`, `.execute`, and `.getReceipt` are used to complete transaction.
1. Send an `AccountBalanceQuery` using the Hedera SDK.
   - This obtains the fresh balance from one of the recipient accounts.
1. Send an HTTP request to a Mirror Node API to query the transaction
   - The response is parsed to obtain the amounts transferred.
1. View the transfer transaction page in HashScan (the network explorer)

Steps:

1. In the code editor, Open the file `transfer-hbar/script-transfer-hbar.js`.
1. In the terminal, run these commands:
   - `cd transfer-hbar`
   - `./script-transfer-hbar.js`
1. View the summary statistics (optional)
   - The "time to first task completion" displays how long it took
     between starting up the project (the setup script)
     through to completing the first task.
     Note that this does not include the time taken to set up the repo manually (variable),
     or for Gitpod to spin up (up to 10 seconds).
   - The "time taken to complete" displays how long it took
     for this particular script to run.
   - Open the HCS topic and check logs which match you anonymised key.
     Note that the anonymised key is simply a randomly generated hexadecimal string.

### Fungible Token using HTS

Demonstrates: Use of the Hedera Token Service (HTS).

<!--
[Go to accompanying tutorial](#TODO_LINK). (WIP)
-->

What you will accomplish:

1. Initialise `Client` using the Hedera SDK,
   by reading in credentials from the `.env` file generated earlier.
1. Send a `TokenCreateTransaction` using the Hedera SDK.
   - Note that in Hedera, tokens can be created with out using Solidity or smart contracts.
     Instead, you can create HTS tokens using only SDK methods.
     These have equivalent functionality to ERC20 or ERC721 tokens,
     but can be created with much less effort.
   - `.setTokenType` is used to specify that this should be a fungible token.
   - `.setTokenName`, `.setTokenSymbol`, `.setDecimals`, and `.setInitialSupply`
     are used to configure the token.
   - `.sign`, `.execute`, and `.getReceipt` are used to complete transaction.
1. Send an HTTP request to a Mirror Node API to query the transaction
   - The response is parsed to obtain the name and total supply of the token.
1. View the token page in HashScan (the network explorer)

Steps:

1. In the code editor, Open the file `hts-ft/script-hts-ft.js`.
1. In the terminal, run these commands:
   - `cd hts-ft`
   - `./script-hts-ft.js`
1. View the summary statistics (optional)
   - The "time to first task completion" displays how long it took
     between starting up the project (the setup script)
     through to completing the first task.
     Note that this does not include the time taken to set up the repo manually (variable),
     or for Gitpod to spin up (up to 10 seconds).
   - The "time taken to complete" displays how long it took
     for this particular script to run.
   - Open the HCS topic and check logs which match you anonymised key.
     Note that the anonymised key is simply a randomly generated hexadecimal string.

### Topic using HCS

Demonstrates: Use of the Hedera Consensus Service (HCS).

<!--
[Go to accompanying tutorial](#TODO_LINK). (WIP)
-->

What you will accomplish:

1. Initialise `Client` using the Hedera SDK,
   by reading in credentials from the `.env` file generated earlier.
1. Send a `TopicCreateTransaction` using the Hedera SDK.
   - This registers a new topic, which may be thought of as a
     [pub-sub messaging service](https://dev.to/willvelida/the-publisher-subscriber-pattern-pubsub-messaging-10in).
   - `.setTransactionMemo` and `.setTopicMemo` are used to configure the topic.
   - `.sign`, `.execute`, and `.getReceipt` are used to complete transaction.
1. Send a `TopicMessageSubmitTransaction` using the Hedera SDK.
   - This adds a message to the freshly created topic.
   - `.setTransactionMemo`, `.setTopicId`, and `.setMessage` are used to configure the message.
   - `.sign`, `.execute`, and `.getReceipt` are used to complete transaction.
1. Send an HTTP request to a Mirror Node API to query the transaction
   - The response is parsed to obtain the messages in the topic.
1. View the topic page in HashScan (the network explorer)

Steps:

1. In the code editor, Open the file `hcs-topic/script-hcs-topic.js`.
1. In the terminal, run these commands:
   - `cd hcs-topic`
   - `./script-hcs-topic.js`
1. View the summary statistics (optional)
   - The "time to first task completion" displays how long it took
     between starting up the project (the setup script)
     through to completing the first task.
     Note that this does not include the time taken to set up the repo manually (variable),
     or for Gitpod to spin up (up to 10 seconds).
   - The "time taken to complete" displays how long it took
     for this particular script to run.
   - Open the HCS topic and check logs which match you anonymised key.
     Note that the anonymised key is simply a randomly generated hexadecimal string.

### Smart Contract using HSCS

Demonstrates: Use of the Hedera Smart Contract Service (HSCS).

<!--
[Go to accompanying tutorial](#TODO_LINK). (WIP)
-->

What you will accomplish:

1. Observe that the RPC Relay has been set up and running in the background.
1. Initialise `Wallet` and `RpcConnection` using EthersJs,
   by reading in credentials from the `.env` file generated earlier.
1. Send an EVM smart contract deployment transaction using `ContractFactory` via EthersJs
   - The `*.abi` and `*.bin` files output by the Solidity compiler (`solc`) are used as inputs.
   - `.deploy` and `.wait` are used to complete the transaction.
1. View the smart contract in HashScan (the network explorer)
1. Invoke the `introduce` function on the smart contract using `.functions.introduce` via EthersJs.
   - `.wait` is used to complete the transaction.
   - This transaction updates the state of (data stored in) the smart contract.
1. Invoke the `greet` function on the smart contract using `.functions.greet` via EthersJs.
   - There is no transaction involved here,
     as this accesses the state of (data stored in) the smart contract,
     without updating it.

Steps:

1. In the code editor, open the files
   `hscs-smart-contract/script-hscs-smart-contract.js` and
   `hscs-smart-contract/my_contract.sol`.
1. In the terminal, run these commands:
   - `cd hscs-smart-contract`
   - `npm install`
   - `npx solc@0.8.17 --abi --bin my_contract.sol`
   - `./script-hscs-smart-contract.js`
1. View the summary statistics (optional)
   - The "time to first task completion" displays how long it took
     between starting up the project (the setup script)
     through to completing the first task.
     Note that this does not include the time taken to set up the repo manually (variable),
     or for Gitpod to spin up (up to 10 seconds).
   - The "time taken to complete" displays how long it took
     for this particular script to run.
   - Open the HCS topic in HashScan and check logs which match you anonymised key.
     Note that the anonymised key is simply a randomly generated hexadecimal string.

### Tear down

1. If you ran this via Gitpod, be sure to "stop workspace".
   - You may do so via the menu within the browser-based IDE.
   - Alternatively, visit [gitpod.io/workspaces](https://gitpod.io/workspaces)
     to see a list of all workspaces
   - Note that Gitpod has a limited number of hours on their free tier,
     and you pay for hours on their paid tiers,
     so best to avoid an idling workspace.

## TODOs

- [x] npm install for HSCS automate
- [x] for hscs add solc@0.8.17 as dependency
- [x] make log outputs consistent in the HSCS output
- [x] make order of hashscan URL and then mirror node API check consistent across all 4
- [x] solidity file in HSCS HW - update the constant both var name and var value
- [x] update `.env.sample` file to include all fields eventually generated
- [x] update `logger.json.sample` file to include all fields
- [x] rename `hfwId` to `scriptId` consistently
- [ ] separate time taken to complete first run and time taken to complete most recent run
- [x] different icons when logging start, complete, error, and summary
- [x] fix ANSI codes for colour and add BRIGHT (`\x1b[1m`) to make headings bold
- [ ] ideate: commemorative completion task reward
- [x] change literal amounts specified in constants in transfer HBAR script
- [x] use existing accounts instead of lazy account creation in transfer HBAR script
- [x] add note not using "anon" for public transactions


## Author

[Brendan Graetz](https://blog.bguiz.com/)

## Licence

MIT
