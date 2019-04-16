import program from "commander";
import BN from "bn.js";

import { DPOSUserV3 as DPOSUser, CryptoUtils, GatewayVersion } from "loom-js";
import { ICandidate } from "loom-js/dist/contracts/dpos";
const coinMultiplier = new BN(10).pow(new BN(18));

program
  .version("0.1.0")
  .option("-c, --config <path>", "config file absolute path")
  .parse(process.argv);

const config = require(program.config);

const createUser = async (config: any): Promise<DPOSUser> => {
  return DPOSUser.createOfflineUserAsync({
    ethEndpoint: config.ethEndpoint,
    ethereumPrivateKey: config.ethPrivateKey,
    dappchainEndpoint: config.dappchainEndpoint,
    dappchainPrivateKey: config.dappchainPrivateKey,
    chainId: config.chainId,
    gatewayAddress: config.loomGatewayEthAddress,
    version: GatewayVersion.MULTISIG
  });
};

// DEPOSITS AND WITHDRAWALS (gateway-user)

program
  .command("coin-balance")
  .description("display the user's balances")
  .action(async function(options) {
    const user = await createUser(config);
    try {
      const dappchainBalance = await user.getDAppChainBalanceAsync();
      const mainnetBalance = await user.ethereumLoom.balanceOf(user.ethAddress);
      console.log(
        `The account's dappchain balance is\nDappchain: ${dappchainBalance}\nMainnet:${mainnetBalance} `
      );
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("deposit <amount>")
  .description(
    "deposit the specified amount of LOOM tokens into the Transfer Gateway"
  )
  .action(async function(amount: string) {
    const user = await createUser(config);
    // Always try to map accounts before depositing, just in case.
    try {
      await user.mapAccountsAsync();
    } catch (err) {}

    try {
      const tx = await user.depositAsync(new BN(amount).mul(coinMultiplier));
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
    const user = await createUser(config);
    try {
      const actualAmount = new BN(amount).mul(coinMultiplier);
      const tx = await user.withdrawAsync(actualAmount);
      await tx.wait();
      console.log(`${amount} tokens withdrawn from Ethereum Gateway.`);
      console.log(`Rinkeby tx hash: ${tx.hash}`);
    } catch (err) {
      console.error(err);
    } finally {
      if (user) user.disconnect();
    }
  });

program
  .command("resume-withdrawal")
  .description("Resumes a withdrawal from a pending receipt")
  .action(async function() {
    const user = await createUser(config);
    try {
      const tx = await user.resumeWithdrawalAsync();
      if (tx) {
        await tx.wait();
      }
    } catch (err) {
      console.error(err);
    } finally {
      user.disconnect();
    }
  });

program
  .command("receipt")
  .description("Returns the currently pending receipt")
  .action(async function() {
    const user = await createUser(config);
    try {
      const receipt = await user.getPendingWithdrawalReceiptAsync();
      if (receipt) {
        console.log(`Pending receipt:`);
        console.log("Token owner:", receipt.tokenOwner.toString());
        console.log("Contract:", receipt.tokenContract.toString());
        console.log("Token kind:", receipt.tokenKind);
        console.log("Nonce:", receipt.withdrawalNonce.toString());
        console.log("Amount:", receipt.tokenAmount!.toString());
        console.log(
          "Signature:",
          CryptoUtils.bytesToHexAddr(receipt.oracleSignature)
        );
      } else {
        console.log(`No pending receipt`);
      }
    } catch (err) {
      console.error(err);
    }
  });

// DPOS MAPPINGS

program
  .command("list-validators")
  .description("Show the current DPoS validators")
  .action(async function() {
    const user = await createUser(config);
    try {
      const validators = await user.listValidatorsAsync();
      console.log(`Current validators:`);
      validators.forEach(v => {
        console.log("  Pubkey:", CryptoUtils.Uint8ArrayToB64(v.pubKey));
        console.log("  Address:", v.address.toString());
        console.log("  Slash percentage:", v.slashPct);
        console.log("  Delegation total:", v.delegationTotal.toString());
        console.log("\n");
      });
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("list-candidates")
  .description("Show the current DPoS candidates (along with their metadata)")
  .action(async function() {
    const user = await createUser(config);
    try {
      const candidates = await user.listCandidatesAsync();
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
      });
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("list-all-delegations")
  .description("Shows all delegations that are active for each validator")
  .action(async function() {
    const user = await createUser(config);
    try {
      const delegations = await user.listAllDelegationsAsync();
      console.log(`Delegations:`);
      delegations.forEach(d => {
        const dArray = d.delegationsArray;
        console.log(`  Total Amount delegated: ${d.delegationTotal}`);
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
          console.log(`    Index: ${delegation.index}`);
          console.log(`    Amount: ${delegation.amount}`);
          console.log(`    Update Amount: ${delegation.updateAmount}`);
          console.log(`    Locktime: ${delegation.lockTime}`);
          console.log(`    Locktime Tier: ${delegation.lockTimeTier}`);
          console.log(
            `    Referrer: ${
              delegation.referrer ? delegation.referrer : "None"
            }`
          );
          console.log(`    State: ${delegation.state}`);

          console.log("\n");
        });
      });
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("list-delegations <validator>")
  .description("Shows all delegations of a validator")
  .action(async function(validator: string) {
    const user = await createUser(config);
    try {
      const d = await user.listDelegationsAsync(validator);
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
    }
  });

program
  .command("my-delegations")
  .description("display the user's delegations to all candidates")
  .action(async function() {
    const user = await createUser(config);
    try {
      const delegations = await user.checkAllDelegationsAsync();
      for (const delegation of delegations.delegationsArray) {
        console.log(`  Validator: ${delegation.delegator.toString()}`);
        console.log(`  Delegator: ${delegation.validator.toString()}`);
        console.log(`  Amount: ${delegation.amount}`);
        console.log(`  Update Amount: ${delegation.updateAmount}`);
        console.log(`  Locktime: ${delegation.lockTime}`);
        console.log(`  Locktime Tier: ${delegation.lockTimeTier}`);
        console.log(`  State: ${delegation.state}`);
      }
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("time-until-elections")
  .description("displays the time until elections")
  .action(async function() {
    const user = await createUser(config);
    try {
      const time = await user.getTimeUntilElectionsAsync();
      console.log(`${time} seconds until elections`);
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
    const user = await createUser(config);
    try {
      const delegations = await user.checkDelegationsAsync(
        option.validator,
        option.delegator
      );
      console.log(`Delegated from ${option.delegator} to ${option.validator}`);
      console.log(`Amount: ${delegations!.amount}`);
      console.log(`Weighted Amount: ${delegations!.weightedAmount}\n`);

      delegations!.delegationsArray.forEach(delegation => {
        console.log(`  Validator: ${delegation.delegator.toString()}`);
        console.log(`  Delegator: ${delegation.validator.toString()}`);
        console.log(`  Amount: ${delegation.amount}`);
        console.log(`  Update Amount: ${delegation.updateAmount}`);
        console.log(`  Locktime: ${delegation.lockTime}`);
        console.log(`  Locktime Tier: ${delegation.lockTimeTier}`);
        console.log(`  State: ${delegation.state}`);
        console.log(`  Index: ${delegation.index}`);
        console.log(
          `  Referrer: ${delegation.referrer ? delegation.referrer : "None"}`
        );
        console.log(`\n`);
      });
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("check-rewards")
  .description("Get back the user rewards")
  .action(async function() {
    const user = await createUser(config);
    try {
      const rewards = await user.checkRewardsAsync();
      console.log(`User unclaimed rewards: ${rewards}`);
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("claim-rewards")
  .description("Get back the user rewards")
  .action(async function() {
    const user = await createUser(config);
    try {
      const rewards = await user.claimRewardsAsync();
      console.log(
        `User claimed back rewards: ${rewards}. They will be available in your balance after elections.`
      );
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("delegate <amount> <validator> <tier> <referrer>")
  .description("Delegate `amount` to a candidate / validator")
  .action(async function(
    amount: string,
    validator: string,
    tier: string,
    referrer?: string
  ) {
    const user = await createUser(config);
    try {
      const actualAmount = new BN(amount).mul(coinMultiplier);
      console.log(`Delegating ${actualAmount.toString()} to validator`);
      await user.delegateAsync(
        validator,
        actualAmount,
        parseInt(tier),
        referrer
      );
      console.log(`Delegated ${actualAmount.toString()} to validator`);
    } catch (err) {
      console.error(err);
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
      const actualAmount = new BN(amount).mul(coinMultiplier);
      console.log(
        `Redelegating ${actualAmount.toString()} from ${formerValidator} to ${validator}`
      );
      await user.redelegateAsync(
        formerValidator,
        validator,
        actualAmount,
        index
      );
      console.log(`Delegated ${actualAmount.toString()} to validator`);
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("undelegate <amount> <validator> <index>")
  .option("-v, --validator <dappchain b64 address>")
  .action(async function(amount: string, validator: string, index: number) {
    const user = await createUser(config);
    try {
      await user.undelegateAsync(
        validator,
        new BN(amount).mul(coinMultiplier),
        index
      );
      console.log(`Undelegated ${amount} LOOM to ${validator}`);
    } catch (err) {
      console.error(err);
    }
  });

program.version("0.1.0").parse(process.argv);
