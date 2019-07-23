# loom-cli
DPoS / Transfer Gateway CLI

## Install

```
yarn install
yarn build
```

## Generate a Loom Private Key

To generate a Loom private key, run:
```
yarn gen:mainnet-key
```

The private key will be saved into a file called `mainnet_private_key`.

## Generate an Ethereum Private Key

For Ethereum mainnet, run:

```
yarn gen:ethereum-key
```

This command will save the private key into a file called `ethereum_private_key`.


## Export Your Infura API Key

```
export INFURA_API_KEY=<YOUR_INFURA_API_KEY>
```

## Setting Things Up

First, you must map your accounts with:

```
node dist/index.js -c ../configs/mainnet.json map-accounts
```

## Usage


Next, you can use the CLI like this:

```
node dist/index.js -c ../configs/mainnet.json list-validators
```

## General Bindings

- `map-accounts`: Connects the user's dappchain/ethereum keys together. **THIS MUST BE EXECUTED WHEN CONNECTING A NEW KEYPAIR TO THE DAPPCHAIN**
- `coin-balance`: Retrieves the user's DAppChain ERC20 balance. Optionally
  provide `--eth` to show the Ethereum balance instead. Optionally provide `--account` to retrieve another user's balance.
- `resolve <contractName>`: Retrieve the `contractName`'s dappchain address from the address mapper

## Transfer Gateway Bindings

- `deposit <amount>`: Deposits `amount` LOOM tokens to the gateway. If not
  enough tokens approved before hand, it will also approve the missing amount
- `withdraw <amount>`: Withdraws `amount` LOOM tokens from the gateway.
- `resume-withdrawal`: Resumes an interrupted withdrawal that didn't consume
  the last withdrawal receipt
- `receipt`: Retrieves the currently pending withdrawal receipt (or null if
  there is none)

## DPoS Bindings

- `list-validators`: Returns the current DPoS validators
- `list-candidates`: Returns information about the current DPoS candidates +
  their metadata
- `check-delegations -v validatorAddress -d delegatorAddress`: Checks how much LOOM has been delegated by `delegatorAddress` to `validatorAddress`
- `claim-delegations`: Claims the user's rewards. Optionally can supply
  `--account to withdraw to a different address
- `delegate <amount> <validator>`: Lock up `amount` and delegate it to `validator`
- `undelegate <amount> <validator>`: Unbond `amount` from `validator`
