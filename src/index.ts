import program from "commander";
import BN from "bn.js";
import fs from 'fs';
import { ethers } from 'ethers'

import { CryptoUtils, Contracts, Address, LocalAddress, Client, EthersSigner } from "loom-js";
import { createDefaultClient, sleep } from 'loom-js/dist/helpers';

const ERC20ABI = require('loom-js/dist/mainnet-contracts/ERC20.json')
const ERC20GatewayABI = require('loom-js/dist/mainnet-contracts/ERC20Gateway.json')

// LOOM has 18 decimals
const coinMultiplier = new BN(10).pow(new BN(18));

program
  .version("0.1.0")
  .option("-c, --config <path>", "config file absolute path")
  .parse(process.argv);

const config: IConfig = require(program.config);

interface IConfig {
  loomGatewayEthAddress: string;
  dappchainEndpoint: string;
  dappchainPrivateKeyFile: string;
  ethPrivateKeyFile: string;
  chainId: string;
}

interface IUser {
  // Client used to interact with Loom Mainnet
  client: Client;
  // Wallet used to interact with Ethereum Mainnet
  wallet: ethers.Wallet;
  // Address of account on Loom Mainnet that will be used to sign Loom Mainnet txs
  loomAddress: Address;
  // Address of account on Ethereum Mainnet that will be used to sign Ethereum Mainnet txs
  ethAddress: string;
}

const ethEndPoint =  `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`

/**
 * Creates clients to interact with Loom Mainnet and Ethereum Mainnet on behalf of a user.
 *
 * @param config Network and key configuration.
 */
async function createUser(config: IConfig): Promise<IUser> {
  if (!process.env.INFURA_API_KEY) {
    throw new Error("INFURA_API_KEY env var not set")
  }

  const dappchainPrivateKey = fs.readFileSync(config.dappchainPrivateKeyFile, 'utf-8').toString().trim()
  const ethPrivateKey = fs.readFileSync(config.ethPrivateKeyFile, 'utf-8').toString().trim()

  const { client, publicKey } = createDefaultClient(
    dappchainPrivateKey,
    config.dappchainEndpoint,
    config.chainId
  )

  const provider = new ethers.providers.JsonRpcProvider(ethEndPoint)
  const wallet = new ethers.Wallet(ethPrivateKey, provider)
  const ethAddress = await wallet.getAddress()

  return {
    client,
    wallet,
    loomAddress: new Address(client.chainId, LocalAddress.fromPublicKey(publicKey)),
    ethAddress,
  }
};

function formatValueToCrypto(amount: BN) {
  const amountInwei = ethers.utils.bigNumberify(amount.toString())
  const formattedAmount = ethers.utils.formatEther(amountInwei) + ' LOOM'
  return formattedAmount
}

function formatToCrypto (amount: BN, updateAmount: BN, lockTimeTier: number, state: number) {
  const amountInwei = ethers.utils.bigNumberify(amount.toString())
  const formattedAmount = ethers.utils.formatEther(amountInwei) + ' LOOM'

  const updateAmountInWei = ethers.utils.bigNumberify(updateAmount.toString())
  const formattedUpdateAmount = ethers.utils.formatEther(updateAmountInWei) + ' LOOM'

  const tiers = ['2 weeks', '3 months', '6 months', '1 year']
  const tierAsInt = lockTimeTier as number
  const formattedTierName = tiers[tierAsInt]

  const delegationState = ['Bonding', 'Bonded', 'Unbonding', 'Redelegating']
  const delegationStateAsInt = state as number
  const formattedDelegationState = delegationState[delegationStateAsInt]

  return {formattedAmount, formattedUpdateAmount, formattedTierName, formattedDelegationState}
}

/**
 * Maps a Loom account to an Ethereum account if no such mapping exists yet.
 * Throws an error if the Loom account is already mapped to a different Ethereum account.
 *
 * @param loomAddress Address of user account on Loom Mainnet.
 * @param ethAddressStr Address of user account on Ethereum Mainnet.
 * @param client Loom Mainnet client.
 * @param wallet ethers.js wallet for the user's Ethereum Mainnet account.
 */
async function mapAccountsAsync(
  loomAddress: Address, ethAddressStr: string, client: Client, wallet: ethers.Wallet
): Promise<void> {
  const ethAddress = Address.fromString(`eth:${ethAddressStr}`);
  const mapper = await Contracts.AddressMapper.createAsync(client, loomAddress);
  if (await mapper.hasMappingAsync(loomAddress)) {
    const mapping = await mapper.getMappingAsync(loomAddress);
    if (!mapping.to.equals(ethAddress)) {
      throw new Error(
        `Can't map ${mapping.from.toString()} to ${ethAddress} it's already mapped to ${mapping.to.toString()}`
      )
    }
    return
  }

  const signer = new EthersSigner(wallet)
  console.log(`Mapping ${loomAddress} to ${ethAddress}...`)
  await mapper.addIdentityMappingAsync(loomAddress, ethAddress, signer)
  console.log('Mapping complete')
}

/**
 * Deposits LOOM tokens to the Loom Mainnet Gateway and return a signature which can be used to
 * withdraw the same amount from the Ethereum Mainnet Gateway.
 *
 * @param gateway Contract binding for Loom Mainnet Gateway.
 * @param amount The amount that should be deposited to the Loom Mainnet Gateway.
 * @param loomEthAddressStr LOOM token contract address on Ethereum Mainnet.
 * @param user User making the deposit.
 * @returns Hex-encoded string representing the signed receipt.
 */
async function depositToLoomGatewayAsync(
  gateway: Contracts.LoomCoinTransferGateway, amount: BN, loomEthAddressStr: string, user: IUser,
): Promise<string> {
  let pendingReceipt = await gateway.withdrawalReceiptAsync(user.loomAddress);
  let signature: Uint8Array
  if (pendingReceipt === null) {
    const dappchainLoom = await Contracts.Coin.createAsync(user.client, user.loomAddress);
    console.log(`Approving ${amount.toString()}...`);
    await dappchainLoom.approveAsync(gateway.address, amount);
    const userEthAddress = Address.fromString(`eth:${user.ethAddress}`);
    const loomEthAddress = Address.fromString(`eth:${loomEthAddressStr}`);
    console.log(`Transferring ${amount.div(coinMultiplier).toString()} to Loom Mainnet Gateway...`);
    await gateway.withdrawLoomCoinAsync(amount, loomEthAddress, userEthAddress);
    console.log(`Transfer complete, waiting for signed receipt...`);

    while (pendingReceipt === null || pendingReceipt.oracleSignature.length === 0) {
      pendingReceipt = await gateway.withdrawalReceiptAsync(user.loomAddress);
      await sleep(2000);
    }
  }
  signature = pendingReceipt.oracleSignature
  return CryptoUtils.bytesToHexAddr(signature)
}

// DEPOSIT AND WITHDRAWAL commands

program
  .command("coin-balance")
  .description("display the user's balances")
  .action(async function(options) {
    const user = await createUser(config);
    try {
      const dappchainLoom = await Contracts.Coin.createAsync(user.client, user.loomAddress);
      const ethereumGateway = new ethers.Contract(config.loomGatewayEthAddress, ERC20GatewayABI, user.wallet);
      const loomEthAddress = await ethereumGateway.functions.loomAddress();
      const ethereumLoom = new ethers.Contract(loomEthAddress, ERC20ABI, user.wallet);

      const loomMainnetBalance = await dappchainLoom.getBalanceOfAsync(user.loomAddress);
      const loomEthereumBalance = await ethereumLoom.balanceOf(user.ethAddress);
      console.log(
        `Loom Mainnet balance: ${loomMainnetBalance}\nEthereum Mainnet balance: ${loomEthereumBalance}`
      );
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect()
      }
    }
  });

program
  .command("deposit <amount>")
  .description(
    "deposit the specified amount of LOOM tokens into the Transfer Gateway"
  )
  .action(async function(amount: string) {
    const user = await createUser(config);
    try {
      // Ensure accounts are mapped before depositing.
      await mapAccountsAsync(user.loomAddress, user.ethAddress, user.client, user.wallet);
    } catch (e) {
      console.log('GOT ERR', e);
    }

    try {
      const ethereumGateway = new ethers.Contract(config.loomGatewayEthAddress, ERC20GatewayABI, user.wallet);
      const loomEthAddress = await ethereumGateway.functions.loomAddress();
      const ethereumLoom = new ethers.Contract(loomEthAddress, ERC20ABI, user.wallet);

      console.log('Checking current allowance...');
      const currentApproval = await ethereumLoom.functions.allowance(
        user.ethAddress,
        config.loomGatewayEthAddress
      );
      const currentApprovalBN = new BN(currentApproval.toString());
      console.log(`Current allowance is ${currentApprovalBN.div(coinMultiplier).toString()}`);

      let amountBN = new BN(amount).mul(coinMultiplier);
      // If current allowance is smaller than necessary then re-approve the full amount
      if (amountBN.gt(currentApprovalBN)) {
        console.log(`Approving transfer of ${amount} LOOM...`);
        let tx = await ethereumLoom.functions.approve(config.loomGatewayEthAddress, amountBN.toString());
        console.log('Waiting for tx confirmation...')
        await tx.wait();
      }
      console.log(`Depositing ${amount} LOOM to Ethereum Gateway...`)
      const tx = await ethereumGateway.functions.depositERC20(
        amountBN.toString(),
        ethereumLoom.address
      );
      console.log('Waiting for tx confirmation...')
      await tx.wait();
      console.log(`${amount} tokens deposited to Ethereum Gateway.`);
      console.log(`Ethereum tx hash: ${tx.hash}`);
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
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
    const user = await createUser(config);
    try {
      const ethereumGateway = new ethers.Contract(config.loomGatewayEthAddress, ERC20GatewayABI, user.wallet);
      const loomEthAddress: string = await ethereumGateway.functions.loomAddress();
      const dappchainGateway = await Contracts.LoomCoinTransferGateway.createAsync(user.client, user.loomAddress);
      const amountBN = new BN(amount).mul(coinMultiplier);
      const sig = await depositToLoomGatewayAsync(dappchainGateway, amountBN, loomEthAddress, user);
      console.log('Withdrawing from Ethereum Gateway...');
      const tx = await ethereumGateway.functions.withdrawERC20(amountBN.toString(), sig, loomEthAddress);
      console.log('Waiting for tx confirmation...');
      await tx.wait();
      console.log(`${amount} tokens withdrawn from Ethereum Gateway.`);
      console.log(`Ethereum tx hash: ${tx.hash}`);
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
    }
  });

program
  .command("resume-withdrawal")
  .description("Resumes a withdrawal from a pending receipt")
  .action(async function() {
    const user = await createUser(config);
    try {
      const dappchainGateway = await Contracts.LoomCoinTransferGateway.createAsync(user.client, user.loomAddress);
      let receipt = await dappchainGateway.withdrawalReceiptAsync(user.loomAddress);
      if (receipt === null) {
        console.log('No withdrawal receipt found');
        return;
      }
      if (receipt.oracleSignature.length === 0) {
        console.log("Withdrawal receipt hasn't been signed yet, try again later.");
        return;
      }
      const sig = CryptoUtils.bytesToHexAddr(receipt.oracleSignature);
      if (!receipt.tokenAmount || receipt.tokenAmount.isZero()) {
        console.log("Withdrawal receipt contains an invalid amount.");
      }

      console.log(`Withdrawing ${receipt.tokenAmount!.div(coinMultiplier).toString()} LOOM from Ethereum Gateway...`);
      const ethereumGateway = new ethers.Contract(config.loomGatewayEthAddress, ERC20GatewayABI, user.wallet);
      const loomEthAddress: string = await ethereumGateway.functions.loomAddress();
      const tx = await ethereumGateway.functions.withdrawERC20(receipt.tokenAmount!.toString(), sig, loomEthAddress);
      console.log('Waiting for tx confirmation...');
      await tx.wait();
      console.log(`Withdrawal complete, Ethereum tx hash: ${tx.hash}`);
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
    }
  });

program
  .command("receipt")
  .description("Returns the currently pending receipt")
  .action(async function() {
    const user = await createUser(config);
    try {
      const dappchainGateway = await Contracts.LoomCoinTransferGateway.createAsync(user.client, user.loomAddress);
      const receipt = await dappchainGateway.withdrawalReceiptAsync(user.loomAddress);
      if (receipt) {
        const ethereumGateway = new ethers.Contract(config.loomGatewayEthAddress, ERC20GatewayABI, user.wallet);
        const loomEthAddress = await ethereumGateway.functions.loomAddress();
        const ethNonce = await ethereumGateway.functions.nonces(user.ethAddress);
        console.log(`Pending receipt:`);
        console.log("Token owner:", receipt.tokenOwner.toString());
        console.log("Token address:", loomEthAddress)
        console.log("Gateway address:", ethereumGateway.address)
        console.log("Contract:", receipt.tokenContract.toString());
        console.log("Token kind:", receipt.tokenKind);
        console.log("Nonce:", receipt.withdrawalNonce.toString());
        console.log("Contract Nonce:", ethNonce.toString());
        console.log("Amount:", receipt.tokenAmount!.toString());
        console.log("Signature:", CryptoUtils.bytesToHexAddr(receipt.oracleSignature));
      } else {
        console.log(`No pending receipt`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
    }
  });

// DPOS commands

program
  .command("map-accounts")
  .description("Creates a mapping between a user's Loom Mainnet & Ethereum Mainnet accounts")
  .action(async function() {
    const user = await createUser(config)
    try {
      await mapAccountsAsync(user.loomAddress, user.ethAddress, user.client, user.wallet);
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
    }
  });

program
  .command("list-validators")
  .description("Show the current DPoS validators")
  .action(async function() {
    const user = await createUser(config);
    try {
      const dpos = await Contracts.DPOS3.createAsync(user.client, user.loomAddress);
      const validators = await dpos.getValidatorsAsync();
      console.log(`Current validators:`);
      validators.forEach(v => {
        console.log(`  Address: ${v.address.toString()}`);
        console.log(`  Slash percentage: ${v.slashPercentage.toString()}`);
        console.log(`  Delegation total: ${v.delegationTotal.toString()}`);
        console.log("\n");
      });
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
    }
  });

program
  .command("list-candidates")
  .description("Show the current DPoS candidates (along with their metadata)")
  .action(async function() {
    const user = await createUser(config);
    try {
      const dpos = await Contracts.DPOS3.createAsync(user.client, user.loomAddress);
      const candidates = await dpos.getCandidatesAsync();
      console.log(`Current candidates:`);
      candidates.forEach(c => {
        console.log("  Pubkey:", CryptoUtils.Uint8ArrayToB64(c.pubKey));
        console.log("  Address:", c.address.toString());
        console.log("  Fee:", c.fee);
        console.log("  New Fee:", c.newFee);
        console.log("  Fee State:", c.candidateState);
        console.log("  Whitelist Amount:", c.whitelistAmount.toString());
        console.log("  Whitelist Tier:", c.whitelistLocktimeTier.toString());
        console.log("  Description:", c.description);
        console.log("  Name:", c.name);
        console.log("  Website:", c.website);
        console.log("\n");
      });
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
    }
  });

program
  .command("list-all-delegations")
  .description("Shows all delegations that are active for each validator")
  .action(async function() {
    const user = await createUser(config);
    try {
      const dpos = await Contracts.DPOS3.createAsync(user.client, user.loomAddress);
      const delegations = await dpos.getAllDelegations();
      console.log(`Delegations:`);
      delegations.forEach(d => {
        const dArray = d.delegationsArray;
        const delegationTotal = formatValueToCrypto(d.delegationTotal)
        console.log(`  Total Amount delegated: ${delegationTotal}`);
        console.log(`  Validator: ${dArray[0].validator.local.toString()}`);

        dArray.forEach(delegation => {
          console.log(
            `    Delegator: ${delegation.delegator.local.toString()}`
          );
          console.log(
            `    Update Validator: ${
            delegation.updateValidator
              ? delegation.updateValidator!.local.toString()
              : "None"
            }`
          );
          const {formattedAmount, formattedUpdateAmount, formattedTierName, formattedDelegationState} = formatToCrypto(
            delegation.amount,
            delegation.updateAmount,
            delegation.lockTimeTier,
            delegation.state
          )
          console.log(`    Index: ${delegation.index}`);
          console.log(`    Amount: ${formattedAmount}`);
          console.log(`    Update Amount: ${formattedUpdateAmount}`);
          console.log(`    Locktime: ${delegation.lockTime}`);
          console.log(`    Locktime Tier: ${formattedTierName}`);
          console.log(
            `    Referrer: ${
            delegation.referrer ? delegation.referrer : "None"
            }`
          );
          console.log(`    State: ${formattedDelegationState}`);

          console.log("\n");
        });
      });
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
    }
  });

program
  .command("list-delegations <validator>")
  .description("Shows all delegations of a validator")
  .action(async function(validator: string) {
    const user = await createUser(config);
    try {
      const validatorAddress = Address.fromString(`${user.client.chainId}:${validator}`);
      const dpos = await Contracts.DPOS3.createAsync(user.client, user.loomAddress);
      const d = await dpos.getDelegations(validatorAddress);
      const dArray = d.delegationsArray;
      console.log(`  Total Amount delegated: ${d.delegationTotal}`);
      console.log(`  Validator: ${dArray[0].validator.local.toString()}`);

      dArray.forEach(delegation => {
        console.log(`    Delegator: ${delegation.delegator.local.toString()}`);
        console.log(
          `    Update Validator: ${
          delegation.updateValidator
            ? delegation.updateValidator!.local.toString()
            : "None"
          }`
        );
        console.log(`    Index: ${delegation.index}`);
        console.log(`    Amount: ${delegation.amount}`);
        console.log(`    Update Amount: ${delegation.updateAmount}`);
        console.log(`    Locktime: ${delegation.lockTime}`);
        console.log(`    Locktime Tier: ${delegation.lockTimeTier}`);
        console.log(
          `    Referrer: ${delegation.referrer ? delegation.referrer : "None"}`
        );
        console.log(`    State: ${delegation.state}`);

        console.log("\n");
      });
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
    }
  });

program
  .command("my-delegations")
  .description("display the user's delegations to all candidates")
  .action(async function() {
    const user = await createUser(config);
    try {
      const dpos = await Contracts.DPOS3.createAsync(user.client, user.loomAddress);
      const delegations = await dpos.checkAllDelegationsAsync(user.loomAddress);
      if (delegations.delegationsArray.length === 0) {
        console.log("No delegations found");
        return
      }

      for (const delegation of delegations.delegationsArray) {
        const {formattedAmount, formattedUpdateAmount, formattedTierName, formattedDelegationState} = formatToCrypto(
          delegation.amount,
          delegation.updateAmount,
          delegation.lockTimeTier,
          delegation.state
        )
        console.log(`  Validator: ${delegation.delegator.toString()}`);
        console.log(`  Delegator: ${delegation.validator.toString()}`);
        console.log(`  Amount: ${formattedAmount}`);
        console.log(`  Update Amount: ${formattedUpdateAmount}`);
        console.log(`  Locktime: ${delegation.lockTime}`);
        console.log(`  Locktime Tier: ${formattedTierName}`);
        console.log(`  State: ${formattedDelegationState}`);
        console.log('***********\n')
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
    }
  });

program
  .command("time-until-elections")
  .description("displays the time until elections")
  .action(async function() {
    const user = await createUser(config);
    try {
      const dpos = await Contracts.DPOS3.createAsync(user.client, user.loomAddress);
      const time = await dpos.getTimeUntilElectionAsync();
      console.log(`${time} seconds until elections`);
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
    }
  });

program
  .command("check-delegations")
  .description(
    "Check how much has a delegator bonded to a candidate/validator"
  )
  .option("-v, --validator <hex-address>")
  .option("-d, --delegator <hex-address>")
  .action(async function(option) {
    const user = await createUser(config);
    try {
      const validatorAddress = Address.fromString(`${user.client.chainId}:${option.validator}`);
      // If the delegator address isn't specified assume the user is the delegator
      const delegatorAddress = option.delegator ? Address.fromString(`${user.client.chainId}:${option.delegator}`) : user.loomAddress;
      const dpos = await Contracts.DPOS3.createAsync(user.client, user.loomAddress);
      const delegations = await dpos.checkDelegationAsync(validatorAddress, delegatorAddress);
      console.log(`Delegated from ${delegatorAddress.toString()} to ${validatorAddress.toString()}`);
      const amount = formatValueToCrypto(delegations!.amount)
      console.log(`Amount: ${amount}`);
      const weightedAmount = formatValueToCrypto(delegations!.weightedAmount)
      console.log(`Weighted Amount: ${weightedAmount}\n`);


      delegations!.delegationsArray.forEach(delegation => {
        const {formattedAmount, formattedUpdateAmount, formattedTierName, formattedDelegationState} = formatToCrypto(
          delegation.amount,
          delegation.updateAmount,
          delegation.lockTimeTier,
          delegation.state
        )

        console.log(`  Validator: ${delegation.validator.toString()}`);
        console.log(`  Delegator: ${delegation.delegator.toString()}`);
        console.log(`  Amount: ${formattedAmount}`);
        console.log(`  Update Amount: ${formattedUpdateAmount}`);
        console.log(`  Locktime: ${delegation.lockTime}`);
        console.log(`  Locktime Tier: ${formattedTierName}`);
        console.log(`  State: ${formattedDelegationState}`);
        console.log(`  Index: ${delegation.index}`);
        console.log(
          `  Referrer: ${delegation.referrer ? delegation.referrer : "None"}`
        );
        console.log(`\n`);
      });
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
    }
  });

program
  .command("check-rewards")
  .description("Get back the user rewards")
  .action(async function() {
    const user = await createUser(config);
    try {
      const dpos = await Contracts.DPOS3.createAsync(user.client, user.loomAddress);
      const rewards = await dpos.checkAllDelegationsAsync(user.loomAddress);
      // FIXME: this output isn't very useful
      console.log(`User unclaimed rewards: ${rewards}`);
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
    }
  });

program
  .command("claim-rewards")
  .description("Get back the user rewards")
  .action(async function() {
    const user = await createUser(config);
    try {
      const dpos = await Contracts.DPOS3.createAsync(user.client, user.loomAddress);
      const rewards = await dpos.claimDelegatorRewardsAsync();
      console.log(
        `User claimed back rewards: ${rewards}. They will be available in your balance after elections.`
      );
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
    }
  });

program
  .command("delegate <amount> <validator> <tier> [referrer]")
  .description("Delegate `amount` to a candidate / validator")
  .action(async function(
    amount: string,
    validator: string,
    tier: string,
    referrer?: string
  ) {
    const user = await createUser(config);
    try {
      const dpos = await Contracts.DPOS3.createAsync(user.client, user.loomAddress);
      const validatorAddress = Address.fromString(`${user.client.chainId}:${validator}`);
      const actualAmount = new BN(amount).mul(coinMultiplier);
      const dappchainLoom = await Contracts.Coin.createAsync(user.client, user.loomAddress);
      // TODO: should check the user has a sufficient amount of LOOM first
      console.log(`Approving transfer of ${amount} LOOM...`);
      await dappchainLoom.approveAsync(dpos.address, actualAmount);
      console.log(`Delegating ${amount} LOOM to validator...`);
      await dpos.delegateAsync(
        validatorAddress,
        actualAmount,
        parseInt(tier),
        referrer
      );
      console.log(`Delegated ${amount} LOOM to validator ${validator}`);
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
    }
  });

program
  .command("redelegate <amount> <formerValidator> <validator> <index>")
  .description(
    "Instantly redelegates an amount from a delegation to another validator"
  )
  .action(async function(
    amount: string,
    formerValidator: string,
    validator: string,
    index: number
  ) {
    const user = await createUser(config);
    try {
      const dpos = await Contracts.DPOS3.createAsync(user.client, user.loomAddress);
      const formerValidatorAddress = Address.fromString(`${user.client.chainId}:${formerValidator}`);
      const validatorAddress = Address.fromString(`${user.client.chainId}:${validator}`);
      const actualAmount = new BN(amount).mul(coinMultiplier);
      console.log(`Redelegating ${amount} LOOM from ${formerValidator} to ${validator}`);
      await dpos.redelegateAsync(
        formerValidatorAddress,
        validatorAddress,
        actualAmount,
        index
      );
      console.log(`Delegated ${amount} LOOM to validator ${validator}`);
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
    }
  });

program
  .command("undelegate <amount> <validator> <index>")
  .action(async function(amount: string, validator: string, index: number) {
    const user = await createUser(config);
    try {
      const dpos = await Contracts.DPOS3.createAsync(user.client, user.loomAddress);
      const validatorAddress = Address.fromString(`${user.client.chainId}:${validator}`);
      const actualAmount = new BN(amount).mul(coinMultiplier);
      await dpos.unbondAsync(validatorAddress, actualAmount, index);
      console.log(`Undelegated ${amount} LOOM to validator ${validator}`);
    } catch (err) {
      console.error(err);
    } finally {
      if (user.client) {
        user.client.disconnect();
      }
    }
  });

program.version("0.1.0").parse(process.argv);
