#!/usr/bin/env node

import program from "commander";
import BN from "bn.js";

import {
  depositCoinToRinkebyGateway,
  getMainnetBalance,
  loadMainnetAccount,
  rinkebyGatewayAddress,
  coinMultiplier,
  withdrawCoinFromRinkebyGateway,
} from "./loom_mainnet";

import {
  getDAppChainBalance,
  loadDAppChainAccount,
  mapAccounts,
  depositCoinToDAppChainGateway,
  listValidators,
  listCandidates,
  checkDelegations,
  claimDelegations,
  delegate,
  undelegate,
  getPendingWithdrawalReceipt,
  resolveAddressAsync
} from "./dappchain";

import { CryptoUtils, Address } from "loom-js";
import { config } from "./trudy";
import { ethers } from "ethers";

// See https://loomx.io/developers/docs/en/testnet-plasma.html#contract-addresses-transfer-gateway
// for the most up to date address.

const chainId = config.chainId;
const ethereumEndpoint = config.ethEndpoint;
const dappchainEndpoint = config.dappchainEndpoint;
const dappchainPrivateKey = config.dappchainPrivateKey;
const ethPrivateKey = config.ethPrivateKey;

// LOOM GATEWAY BINDINGS

program
  .command("deposit <amount>")
  .description(
    "deposit the specified amount of LOOM tokens into the Transfer Gateway"
  )
  .action(async function(amount: string) {
    const wallet = loadMainnetAccount(ethereumEndpoint, ethPrivateKey);
    try {
      const tx = await depositCoinToRinkebyGateway(
        wallet,
        new BN(amount).mul(coinMultiplier)
      );
      await tx.wait();
      console.log(`${amount} tokens deposited to Ethereum Gateway.`);
      console.log(`Rinkeby tx hash: ${tx.hash}`);
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("withdraw <amount>")
  .description(
    "withdraw the specified amount of LOOM tokens via the Transfer Gateway"
  )
  .option(
    "--timeout <number>",
    "Number of seconds to wait for withdrawal to be processed"
  )
  .action(async function(amount: string, options: any) {
    let account;
    try {
      account = loadDAppChainAccount(
        dappchainEndpoint,
        dappchainPrivateKey,
        chainId
      );
      const wallet = loadMainnetAccount(ethereumEndpoint, ethPrivateKey);

      const actualAmount = new BN(amount).mul(coinMultiplier);
      const signature = await depositCoinToDAppChainGateway(
        wallet,
        account,
        actualAmount,
        options.timeout ? options.timeout * 1000 : 120000
      );
      const tx = await withdrawCoinFromRinkebyGateway(
        wallet,
        actualAmount,
        signature
      );
      await tx.wait();
      console.log(`${amount} tokens withdrawn from Ethereum Gateway.`);
      console.log(`Rinkeby tx hash: ${tx.hash}`);
    } catch (err) {
      console.error(err);
    } finally {
      if (account) {
        account.client.disconnect();
      }
    }
  });

program
  .command("resume-withdrawal")
  .description("Resumes a withdrawal from a pending receipt")
  .action(async function() {
    let account;
    try {
      account = loadDAppChainAccount(
        dappchainEndpoint,
        dappchainPrivateKey,
        chainId
      );
      const wallet = loadMainnetAccount(ethereumEndpoint, ethPrivateKey);
      const receipt = await getPendingWithdrawalReceipt(account);
      if (receipt === null) {
        console.log("No pending receipt");
        return;
      }

      const signature = CryptoUtils.bytesToHexAddr(receipt.oracleSignature);
      const amount = receipt.tokenAmount!;
      const tx = await withdrawCoinFromRinkebyGateway(
        wallet,
        amount,
        signature
      );
      await tx.wait();
      console.log(
        `${amount.div(coinMultiplier)} tokens withdrawn from Ethereum Gateway.`
      );
      console.log(`Rinkeby tx hash: ${tx.hash}`);
    } catch (err) {
      console.error(err);
    } finally {
      if (account) {
        account.client.disconnect();
      }
    }
  });

program
  .command("receipt")
  .description("Returns the currently pending receipt")
  .action(async function() {
    const account = loadDAppChainAccount(
      dappchainEndpoint,
      dappchainPrivateKey,
      chainId
    );
    try {
      const receipt = await getPendingWithdrawalReceipt(account);
      if (receipt) {
        console.log(`Pending receipt:`);
        console.log("Token owner:", receipt.tokenOwner.toString())
        console.log("Contract:", receipt.tokenContract.toString())
        console.log("Token kind:", receipt.tokenKind)
        console.log("Nonce:", receipt.withdrawalNonce)
        console.log("Signature:", CryptoUtils.bytesToHexAddr(receipt.oracleSignature))
      } else {
        console.log(`No pending receipt`);
      }
    } catch (err) {
      console.error(err);
    }
  });

// DPOS BINDINGS

program
  .command("list-validators")
  .description("Show the current DPoS validators")
  .action(async function() {
    const account = loadDAppChainAccount(
      dappchainEndpoint,
      dappchainPrivateKey,
      chainId
    );
    try {
      const validators = await listValidators(account);
      console.log(`Current validators:`);
      validators.forEach(v => {
        console.log("  Pubkey:", CryptoUtils.Uint8ArrayToB64(v.pubKey));
        console.log("  Power:", v.power);
      });
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("list-candidates")
  .description("Show the current DPoS candidates (along with their metadata)")
  .action(async function() {
    const account = loadDAppChainAccount(
      dappchainEndpoint,
      dappchainPrivateKey,
      chainId
    );
    try {
      const candidates = await listCandidates(account);
      console.log(`Current candidates:`, candidates);
      candidates.forEach(c => {
        console.log("  Pubkey:", c.pubKey);
        console.log("  Power:", c.address);
      });
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("check-delegations")
  .description(
    "Check how much has a delegator bonded to a candidate/valdidator"
  )
  .option("-v, --validator <dappchain b64 address>")
  .option("-d, --delegator <dappchain b64 address>")
  .action(async function(option) {
    const account = loadDAppChainAccount(
      dappchainEndpoint,
      dappchainPrivateKey,
      chainId
    );
    try {
      const delegation = await checkDelegations(
        account,
        option.validator,
        option.delegator
      );
      console.log(
        `Delegation from ${option.delegator} to ${
          option.validator
        } is: ${delegation}`
      );
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("claim-delegations")
  .description("Get back the user rewards")
  .action(async function() {
    const account = loadDAppChainAccount(
      dappchainEndpoint,
      dappchainPrivateKey,
      chainId
    );
    try {
      const rewards = await claimDelegations(account);
      console.log(`User claimed back rewards: ${rewards}`);
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("delegate <amount>")
  .description("Delegate `amount` to a candidate / validator")
  .option("-v, --validator <dappchain b64 address>")
  .action(async function(amount: string, option) {
    const account = loadDAppChainAccount(
      dappchainEndpoint,
      dappchainPrivateKey,
      chainId
    );
    try {
      await delegate(
        account,
        option.validator,
        new BN(amount).mul(coinMultiplier)
      );
      console.log(`Delegated ${amount} LOOM to ${option.validator}`);
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("undelegate <amount>")
  .description("Undelegate `amount` from a candidate / validator")
  .option("-v, --validator <dappchain b64 address>")
  .action(async function(amount: string, option) {
    const account = loadDAppChainAccount(
      dappchainEndpoint,
      dappchainPrivateKey,
      chainId
    );
    try {
      await undelegate(
        account,
        option.validator,
        new BN(amount).mul(coinMultiplier)
      );
      console.log(`Undelegated ${amount} LOOM to ${option.validator}`);
    } catch (err) {
      console.error(err);
    }
  });

// GENERAL DAPPCHAIN/ETH GETTERS

program
  .command("map-accounts")
  .description("maps accounts")
  .action(async function() {
    let account;
    try {
      const wallet = loadMainnetAccount(ethereumEndpoint, ethPrivateKey);
      account = loadDAppChainAccount(
        dappchainEndpoint,
        dappchainPrivateKey,
        chainId
      );
      await mapAccounts(account, wallet);
    } catch (err) {
      console.error(err);
    } finally {
      if (account) {
        account.client.disconnect();
      }
    }
  });

program
  .command("coin-balance")
  .description(
    "display the current DAppChain ERC20 token balance for an account"
  )
  .option("--eth", "Show the Ethereum ERC20 balance instead")
  .option(
    "-a, --account <dappchain b64 address | ethereum hex address> | gateway",
    "Account address"
  )
  .action(async function(options) {
    try {
      let ownerAddress, balance;
      if (options.eth) {
        // Retrieve mainnet balance
        const wallet = loadMainnetAccount(ethereumEndpoint, ethPrivateKey);
        ownerAddress = await wallet.getAddress();
        if (options.account) {
          ownerAddress =
            options.account === "gateway" // --account can be 'gateway' for convenience
              ? rinkebyGatewayAddress
              : options.account;
        }
        balance = await getMainnetBalance(wallet, ownerAddress)
        balance = balance.div(ethers.utils.parseEther('1'))
      } else {
        // Retrieve dappchain balance
        const account = loadDAppChainAccount(
          dappchainEndpoint,
          dappchainPrivateKey,
          chainId
        );
        ownerAddress = account.address;
        try {
          balance = await getDAppChainBalance(account, options.account);
          balance = balance.div(coinMultiplier)
        } catch (err) {
          throw err;
        } finally {
          account.client.disconnect();
        }
      }
      console.log(`${ownerAddress} balance is ${balance}`);
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("resolve <contractName>")
  .description("Get the contract's address based on name")
  .action(async function(contractName: string) {
    let account;
    try {
      account = loadDAppChainAccount(
        dappchainEndpoint,
        dappchainPrivateKey,
        chainId
      );
      const address = await resolveAddressAsync(account, contractName);
      console.log(`Contract ${contractName}'s address: ${address}`);
    } catch (err) {
      console.error(err);
    }
  });

program.version("0.1.0").parse(process.argv);
