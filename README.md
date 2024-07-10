# Base Template for Hedera Tutorial Demo Repos

Intended to be used as a common starting point for demo repos for tutorials.

<a href="https://gitpod.io/?autostart=true#https://github.com/hedera-dev/hedera-tutorial-demo-base-template" target="_blank" rel="noreferrer">
  <img src="./img/gitpod-open-button.svg" />
</a>

## Features

- Installation of bare minimum dependencies
  - Hedera SDK + `.env` file parser
- Script that automates setup of `.env` file
  - Interactive prompts, with sensible defaults
  - Accommodates BIP-39 seed phrase + faucet dispense flow
    - This caters to EVM developers who wish to use their familiar developer tools
  - Accommodates portal account create flow
    - This caters to all developers in general (e.g. web2 developers)
  - Performs basic validation of accounts
    - Fail fast to prevent errors/ head scratching after beginning to do the tutorial
- Script that automates initialisation and running of JSON-RPC relay
  - Needed if tutorial involves the use of HSCS +
    EVM developer tools (harhdat/ foundry/ ethers/ viem/ metamask/ et cetera)
  - Otherwise, this is not necessary, and can be ignored/ or disabled by the tutorial author
- Gitpod configuration
  - Allows developer to run tutorial in a cloud development environment (Gitpod)
  - Needed if developer is working from a non-POSIX compliant machine,
    or is otherwise unable to meet the set up requirements in the pre-requisites
  - Most likely needed if the developer is new to Hedera technology,
    and the intended outcome is a quick turnaround - e.g. Hello World sequence, or POC
  - Otherwise, this is not necessary, and can be ignored/ or disabled by the tutorial author

## Focus

These are the principles for this repo:

- Maximise setup automation
- Minimise steps for developer
- Shortest possible time before developer can work on first step in a tutorial
- Anticipate and counter developer friction points

The performance optimisation for speed can be quantified:

- *20-30 minutes*: Manual set up of prerequisites for an a developer new to Hedera technology
- *5-6 minutes*: Set up via scripts from scratch
- *1-2 minutes*: Set up via scripts with Docker image + Gitpod
  - TODO: custom Docker image instead of base Docker image + steps each run, to further speed this up
- *Immediate*: Time to start the first step in the script
  - Note: The setup still takes 1-2 minutes, but runs in the background and in parallel by design,
    allowing the developer to get on the tutorial steps right away

Developer friction points anticipated include:

- Those identified through a developer friction audit conducted in 2023
- Those identified through a developer usability test conducted in 2024

## Motivation

- A tutorial, at bare minimum, does the following:
  - Lists the pre-requisites which the developer must set up/ satisfy on their computer before proceeding
  - Guide its reader, step-by-step, how to complete a given task
  - Link to a demo repo which demonstrates the task
- This base template for demo repos goes beyond the bare minimum above:
  - Automates the set up of the pre-requisites
  - Provides a configuration for Gitpod, so that set up does not even need to be performed
    by the developer on their own computer
- What this achieves:
  - Reduce developer friction
  - Decrease the amount of time before developer can **start** the first step of the tutorial
  - Decrease the amount of time in total for the developer to **complete** the tutorial
- Main motivation here is **speed**:
  - Faster = Less developer friction
  - Faster = Larger fraction of developers complete the tutorial

## How to use this repo

As a tutorial reader:

1. Open the tutorial repo in Gitpod
   - Option A: Click the large **Open in Gitpod** button at the top of the README of the tutorial repo
   - Option B: Enter `https://gitpod.io/?autostart=false#` followed by the Github URL of the tutorial
     - e.g. if the tutorial repo is `https://github.com/my-username/my-new-tutorial`,
       the URL to navigate to would be `https://gitpod.io/?autostart=false#https://github.com/my-username/my-new-tutorial`
1. Wait for the Gitpod spinner
1. In the VS code terminal, you should see 3 terminals, `rpcrelay_pull`, `rpcrelay_run`, and `main`
1. You do not need to use the `rpcrelay_pull` and `rpcrelay_run` terminals, let them run in the background
1. In the `main` terminal, which is the one that displays by default, a script will interactively prompt you
1. Follow the instructions in the script and copy-paste values or accept its default suggestions
   - Note that the written tutorial should have specific instructions for this
1. After the script has completed, open the `.env` file to inspect its contents
1. If the tutorial involves the use of JSON-RPC, run `./init/05-rpcrelay-smoketest.sh` and check that
   it does output the latest block from Hedera Testnet
1. Congratulations, you can now move on to the tutorial proper! 🎉

As a tutorial author:

1. `git clone` this repo
1. Create a new git remote - e.g. new repo on Github
1. `git rm remote` of the existing git remote (this repo)
1. `git add remote` of the new git remote (your new repo)
1. Add new files necessary for your tutorial
1. Add instructions specific to how to answer the `main` script prompts to
   the `README.md` or wherever the tutorial text is published
   - State how to answer based on the **portal flow** vs the **faucet flow**, at minimum
   - Additionally, state any specific instructions pertaining to the tutorial
1. Update the URL in `href` for the `<a />` tag surrounding the **Open in Gitpod**
   SVG button at the top of `README.md`
1. `git commit` and `git push` to your new git remote (your new repo)
1. Follow the steps in "as a tutorial reader" above, and verify that the tutorial is functional in Gitpod.

## Author

[Brendan Graetz](https://blog.bguiz.com/)

## Licence

MIT
