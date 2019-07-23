# loom-cli
DPoS / Transfer Gateway CLI

## Install

```
yarn install
yarn build
```

## Generate a Loom Private Key

### Testnet

The following command will generate a private key and save it into a file called `extdev_private_key`:

```
yarn gen:extdev-key
```

### Mainnet

For Loom mainnet, run:

```
yarn gen:mainnet-key
```

This time, the private key will be saved into a file called `mainnet_private_key`.

## Generate an Ethereum Private Key

### Rinkeby

The following command will generate a private key and save it into a file called `rinkeby_private_key`:

```
yarn gen:rinkeby-key
```

# Mainnet

For Ethereum mainnet, run:

```
yarn gen:ethereum-key
```

This time, the private key will be saved into a file called `mainnet_private_key`.


## Export Your Infura API Key

```
export INFURA_API_KEY=<YOUR_INFURA_API_KEY>
```

## Usage



Next, you can use the CLI like this:

```
node dist/index.js -c ../configs/<YOUR CONFIG FILE> list-validators
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

## Endpoints

### ethEndpoint:

1. https://rinkeby.infura.io/<APIKey>
2. https://mainnet.infura.io/<APIKey>
3. http://localhost:8545 for local deployments
4. Your node

### dappchainEndpoint:

1. https://plasma.dappchains.com, chainId: default
2. https://test-z-asia1.dappchains.com, chainId: asia1
3. http://localhost:46658, chainId: default
4. Your node

## Keys

The DappChainKey corresponds to the mnemonic `crater now gesture wish very major team share other strike month seminar` for using the dashboard. As a result, if you want to reuse any of the actions that you made with the CLI in the dashboard, you'll have to import the `ethPrivateKey` to metamask, and input that mnemonic in the dashboard when logging in.

The ethereum key is configured to be one with a lot of Ether and Loom tokens for the ganache network that's distributed with `transfer-gateway-v2`

## Loom Gateway Address

That's the address used to interact with the loom gateway. The client software infers the loom token address and the validator manager contract address from that. It's currently set to the address the ERC20Gateway contract gets deployed to when you run the migrations inside `https://www.github.com/loomnetwork/transfer-gateway-v2/mainnet`.
