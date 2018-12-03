# loom-cli
DPoS / Transfer Gateway CLI

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

