import BN from "bn.js";
import {
  createJSONRPCClient,
  Client,
  NonceTxMiddleware,
  SignedTxMiddleware,
  Address,
  LocalAddress,
  CryptoUtils,
  Contracts,
  EthersSigner
} from "loom-js";

import { ethers } from "ethers";
import { coinMultiplier, rinkebyLoomAddress } from "./loom_mainnet";
import {
  IValidator,
  IDelegation,
  ICandidate
} from "loom-js/dist/contracts/dpos2";
import { IWithdrawalReceipt } from "loom-js/dist/contracts/transfer-gateway";
import { sleep } from "loom-js/dist/helpers";

const LoomCoinTransferGateway = Contracts.LoomCoinTransferGateway;
const AddressMapper = Contracts.AddressMapper;
const Coin = Contracts.Coin;
const DPOS = Contracts.DPOS2;

/**
 * Helper object which includes the account client's address
 */
export interface Account {
  client: Client;
  address: Address;
}

/**
 * Given an account object returns the current chain's deployed DPoS contract
 * @param account The user's account object
 */
export const getDAppChainDPOSContract = async (
  account: Account
): Promise<Contracts.DPOS2> => {
  const dpos = await DPOS.createAsync(account.client, account.address);
  return dpos;
};

/**
 * Given an account object returns the current chain's deployed AddressMapper contract
 * @param account The user's account object
 */
export const getDAppChainMapperContract = async (
  account: Account
): Promise<Contracts.AddressMapper> => {
  const mapperContract = await AddressMapper.createAsync(
    account.client,
    account.address
  );
  return mapperContract;
};

/**
 * Given an account object returns the current chain's deployed LoomCoin contract
 * @param account The user's account object
 */
export const getDAppChainLoomContract = async (
  account: Account
): Promise<Contracts.Coin> => {
  const coinContract = await Coin.createAsync(account.client, account.address);
  return coinContract;
};

/**
 * Given an account object returns the current chain's deployed LoomCoin TransferGateway contract
 * @param account The user's account object
 */
export const getDAppChainGatewayContract = async (
  account: Account
): Promise<Contracts.LoomCoinTransferGateway> => {
  const gatewayContract = await LoomCoinTransferGateway.createAsync(
    account.client,
    account.address
  );
  return gatewayContract;
};

/**
 * Connect the user to the DAppChain and returns a read and write account object to be used with other functions.
 *
 * @param endpoint The dappchain's RPC Endpoint (write/read URL must be the same, they get appened with rpc and query respectively)
 * @param privateKeyStr The user's Base64 encoded private key string
 * @param chainId The dappchain's chainId
 */
export const loadDAppChainAccount = (
  endpoint: string,
  privateKeyStr: string,
  chainId: string
): Account => {
  const privateKey = CryptoUtils.B64ToUint8Array(privateKeyStr);
  const publicKey = CryptoUtils.publicKeyFromPrivateKey(privateKey);
  const writer = createJSONRPCClient({
    protocols: [{ url: endpoint + "/rpc" }]
  });
  const reader = createJSONRPCClient({
    protocols: [{ url: endpoint + "/query" }]
  });
  const client = new Client(chainId, writer, reader);
  console.log("Initialized", endpoint);
  client.txMiddleware = [
    new NonceTxMiddleware(publicKey, client),
    new SignedTxMiddleware(privateKey)
  ];

  client.on("error", (msg: any) => {
    console.error("PlasmaChain connection error", msg);
  });

  const dappchainAddress = new Address(
    chainId,
    LocalAddress.fromPublicKey(publicKey)
  );
  return {
    address: dappchainAddress,
    client: client
  };
};

// COIN MAPPINGS

/**
 * Retrieves the  DAppChain LoomCoin balance of a user
 * @param account The user's account object
 * @param address The address to check the balance of. If not provided, it will check the user's balance
 */
export const getDAppChainBalance = async (
  account: Account,
  address: string | undefined
): Promise<BN> => {
  const coinContract = await getDAppChainLoomContract(account);

  // if no address is provided, return our balance
  if (address === undefined) {
    return coinContract.getBalanceOfAsync(account.address);
  }

  const pubKey = CryptoUtils.B64ToUint8Array(address);
  const callerAddress = new Address(
    account.client.chainId,
    LocalAddress.fromPublicKey(pubKey)
  );
  const balance = await coinContract.getBalanceOfAsync(callerAddress);
  return balance;
};

/**
 * Returns the user's pending withdrawal receipt (or null if there's none)
 * @param account The user's account object
 */
export const getPendingWithdrawalReceipt = async (
  account: Account
): Promise<IWithdrawalReceipt | null> => {
  const gateway = await getDAppChainGatewayContract(account);
  return gateway.withdrawalReceiptAsync(account.address);
};

/**
 * Deposits an amount of LOOM tokens to the dappchain gateway and return a signature which can be used to withdraw the same amount from the mainnet gateway.
 *
 * @param wallet Instance of ethers wallet (can be initialized either via metamask or via private key)
 * @param account The user's account object
 * @param amount The amount that will be deposited to the DAppChain Gateway (and will be possible to withdraw from the mainnet)
 */
export const depositCoinToDAppChainGateway = async (
  wallet: ethers.Signer,
  account: Account,
  amount: BN
) => {
  const coin = await getDAppChainLoomContract(account);
  const gateway = await getDAppChainGatewayContract(account);

  let pendingReceipt = await getPendingWithdrawalReceipt(account);
  let signature;
  if (pendingReceipt === null) {
    await coin.approveAsync(gateway.address, amount);
    const ethereumAddressStr = await wallet.getAddress();
    const ethereumAddress = Address.fromString(`eth:${ethereumAddressStr}`);
    const loomCoinAddress = Address.fromString(`eth:${rinkebyLoomAddress}`);
    await gateway.withdrawLoomCoinAsync(
      amount,
      loomCoinAddress,
      ethereumAddress
    );
    console.log(
      `${amount
        .div(coinMultiplier)
        .toString()} tokens deposited to DAppChain Gateway...`
    );
    while (
      pendingReceipt === null ||
      pendingReceipt.oracleSignature.length === 0
    ) {
      pendingReceipt = await getPendingWithdrawalReceipt(account);
      await sleep(2000);
    }
  }
  signature = pendingReceipt.oracleSignature;

  return CryptoUtils.bytesToHexAddr(signature);
};

// DPOS MAPPINGS

/**
 *
 * Returns a list of the current validators
 * @param account The user's account object
 */
export const listValidators = async (
  account: Account
): Promise<IValidator[]> => {
  const dpos = await getDAppChainDPOSContract(account);
  return dpos.getValidatorsAsync();
};

/**
 *
 * Returns a list of the current candidates
 * @param account The user's account object
 */
export const listCandidates = async (
  account: Account
): Promise<ICandidate[]> => {
  const dpos = await getDAppChainDPOSContract(account);
  return dpos.getCandidatesAsync();
};

/**
 * Returns the stake a delegator has delegated to a candidate/validator
 *
 * @param account The user's account object
 * @param validator The validator's hex addres
 * @param delegator The delegator's hex address
 */
export const checkDelegations = async (
  account: Account,
  validator: string,
  delegator: string
): Promise<IDelegation | null> => {
  const dpos = await getDAppChainDPOSContract(account);
  const validatorAddress = prefixAddress(account.client, validator);
  const delegatorAddress = delegator
    ? prefixAddress(account.client, delegator)
    : account.address;
  console.log(delegatorAddress);
  const delegation = await dpos.checkDelegationAsync(
    validatorAddress,
    delegatorAddress
  );
  return delegation;
};

/**
 * Claims the user's delegations to a withdrawal address. If no address is provided, withdraws the funds to the user's address.
 * @param account The user's account object
 * @param withdrawalAddress The address where funds will be withdrawn
 */
export const claimDelegations = async (
  account: Account,
  withdrawalAddress: Address
) => {
  const dpos = await getDAppChainDPOSContract(account);
  return dpos.claimDistributionAsync(withdrawalAddress);
};

/**
 * Delegates an amount of LOOM tokens to a candidate/validator
 *
 * @param account The user's account object
 * @param candidate The candidate's hex address
 * @param amount The amount delegated
 */
export const delegate = async (
  account: Account,
  candidate: string,
  amount: BN
) => {
  const coin = await getDAppChainLoomContract(account);
  const dpos = await getDAppChainDPOSContract(account);
  const address = prefixAddress(account.client, candidate);
  console.log(address);
  await coin.approveAsync(dpos.address, amount);
  const allowance = await coin.getAllowanceAsync(dpos.address, address);
  await dpos.delegateAsync(address, amount);
};

/**
 * Undelegates an amount of LOOM tokens from a candidate/validator
 *
 * @param account The user's account object
 * @param candidate The candidate's hex address
 * @param amount The amount to undelegate
 */
export const undelegate = async (
  account: Account,
  candidate: string,
  amount: BN
) => {
  const coin = await getDAppChainLoomContract(account);
  const dpos = await getDAppChainDPOSContract(account);
  const address = prefixAddress(account.client, candidate);
  await dpos.unbondAsync(address, amount);
};

// END DPOS MAPPINGS

/**
 * Helper function to prefix an address with the chainId to get chainId:address format
 */
const prefixAddress = (client: Client, address: string) => {
  return Address.fromString(`${client.chainId}:${address}`);
};

// GENERIC MAPPINGS

/**
 * Maps the user's ETH address to their DAppChain address. This MUST be called before any interaction with the gateways.
 *
 * @param account The user's account object
 * @param wallet The User's ethers wallet
 */
export const mapAccounts = async (account: Account, wallet: ethers.Signer) => {
  const walletAddress = await wallet.getAddress();
  const ethereumAddress = Address.fromString(`eth:${walletAddress}`);
  const mapperContract = await getDAppChainMapperContract(account);

  if (await mapperContract.hasMappingAsync(account.address)) {
    console.log(`${account.address.toString()} is already mapped`);
    return;
  }
  console.log(
    `mapping ${ethereumAddress.toString()} to ${account.address.toString()}`
  );
  const signer = new EthersSigner(wallet);
  await mapperContract.addIdentityMappingAsync(
    account.address,
    ethereumAddress,
    signer
  );
  console.log(`Mapped ${account.address} to ${ethereumAddress}`);
};

/**
 * Returns the address of a contract by its name, if it's registered in the address mapper
 * @param account The user's account object
 * @param contractName The contract name
 */
export const resolveAddressAsync = async (
  account: Account,
  contractName: string
): Promise<Address | null> => {
  return account.client.getContractAddressAsync(contractName);
};
