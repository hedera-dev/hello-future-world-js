# Hello Future World - Javascript

Demo repo for Hello World sequences to build on Hedera, using Javascript.

> ⚠️ NOTE that this repo is still a work in progress,
> and is therefore incomplete.
> Sections are explicitly marked `(WIP)` as markers/ reminders.

To follow along, please read the **accompanying tutorial** at [docs.hedera.com](#TODO_LINK) (WIP).

You may choose to run this demo repo and follow along the tutorial either,
(a) on your own computer (recommended for experienced developers), or
(b) using Gitpod (recommended for quick/ easy setup).

To run on your own computer, `git clone` this repo,
and follow the instructions in the "pre-requisites" section of the accompanying tutorial.

To run on Gitpod (a cloud development environment), click the button below:

<a href="https://gitpod.io/?autostart=true#https://github.com/hedera-dev/hello-future-world-js" target="_blank" rel="noreferrer">
  <img src="./img/gitpod-open-button.svg" />
</a>

Note that this demo repo is also available in 3 programming languages:

- [Javascript](https://github.com/hedera-dev/hello-future-world-js "Hello Future World - Javascript") (this repo)
- [Java](https://github.com/hedera-dev/hello-future-world-java "Hello Future World - Java") (WIP)
- [Go](https://github.com/hedera-dev/hello-future-world-go "Hello Future World - Go") (WIP)

## Sequences

This repo contains the code required for all of the **Hello World** sequences.
The following sections outline what each sequence will cover.
Each one represents the bare minimum required to use various parts of Hedera technology.
Note that each sequence is intended to be completed in **under 10 minutes** when run via Gitpod.

### Create account

Demonstrates: Use of the Hedera network, at a base level.

[Go to accompanying tutorial](#TODO_LINK). (WIP)

Steps:

1. `AccountCreateTransaction`
1. `TransferTransaction`
1. Mirror Node API for programmatic verification
1. Hashscan for manual verification

### Fungible Token using HTS

Demonstrates: Use of the Hedera Token Service (HTS).

[Go to accompanying tutorial](#TODO_LINK). (WIP)

Steps:

1. `TokenCreateTransaction`
1. Mirror Node API for programmatic verification
1. Hashscan for manual verification

### Topic using HCS

Demonstrates: Use of the Hedera Consensus Service (HCS).

[Go to accompanying tutorial](#TODO_LINK). (WIP)

Steps:

1. `TopicCreateTransaction`
1. `TopicMessageSubmitTransaction`
1. Hashscan for manual verification
1. Mirror Node API for programmatic verification

### Smart Contract using HSCS

Demonstrates: Use of the Hedera Smart Contract Service (HSCS).

[Go to accompanying tutorial](#TODO_LINK). (WIP)

Steps:

1. Write smart contract code in Solidity
1. Compile smart contract using `solc`
1. Smoke test JSON-RPC endpoint
1. Deploy smart contract
1. Invoke smart contract transaction
1. Invoke smart contract query
1. Hashscan for manual verification

## Author

[Brendan Graetz](https://blog.bguiz.com/)

## Licence

MIT
