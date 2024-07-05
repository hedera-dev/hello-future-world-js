# Base Template for Hedera Tutorial Demo Repos

Intended to be used as a common starting point for demo repos for tutorials.

Features:

- Script that automates setup of `.env` file
  - Accommodates BIP-39 seed phrase + faucet dispense flow
  - Accommodates portal account create flow
  - Performs basic validation
- Script that automates initialisation and running of JSON-RPC relay
- Gitpod configuration
  - Allows user to run tutorial in a cloud development environment
  - Therefore localhost setup of prerequisites is optional
  - Main motivation here is to get developer up and running ASAP
