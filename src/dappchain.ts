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
import {
  coinMultiplier,
  rinkebyLoomAddress,
  rinkebyGatewayAddress
} from "./loom_mainnet";
import {
  IValidator,
  IDelegation,
  ICandidate
} from "loom-js/dist/contracts/dpos2";
import { sleep } from "loom-js/dist/helpers";

const LoomCoinTransferGateway = Contracts.LoomCoinTransferGateway;
const AddressMapper = Contracts.AddressMapper;
const Coin = Contracts.Coin;
const DPOS = Contracts.DPOS2;

export interface Account {
  client: Client;
  address: Address;
}

export const getDAppChainDPOSContract = async (
  account: Account
): Promise<Contracts.DPOS2> => {
  const dpos = await DPOS.createAsync(account.client, account.address);
  return dpos;
};

export const getDAppChainMapperContract = async (
  account: Account
): Promise<Contracts.AddressMapper> => {
  const mapperContract = await AddressMapper.createAsync(
    account.client,
    account.address
  );
  return mapperContract;
};

export const getDAppChainLoomContract = async (
  account: Account
): Promise<Contracts.Coin> => {
  const coinContract = await Coin.createAsync(account.client, account.address);
  return coinContract;
};

export const getDAppChainGatewayContract = async (
  account: Account
): Promise<Contracts.TransferGateway> => {
  const gatewayContract = await LoomCoinTransferGateway.createAsync(
    account.client,
    account.address
  );
  return gatewayContract;
};

/**
 *
 * @param endpoint
 * @param privateKeyStr
 * @param chainId
 * @return account address / client object
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
 * @param address B64 encoded public key
 */
export const getDAppChainBalance = async (
  account: Account,
  address: string | undefined
) => {
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

export const getPendingWithdrawalReceipt = async (account: Account) => {
  const gateway = await getDAppChainGatewayContract(account);
  return gateway.withdrawalReceiptAsync(account.address);
};

export const depositCoinToDAppChainGateway = async (
  wallet: ethers.Signer,
  account: Account,
  amount: BN,
  timeout: number
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

export const listValidators = async (
  account: Account
): Promise<IValidator[]> => {
  const dpos = await getDAppChainDPOSContract(account);
  return dpos.getValidatorsAsync();
};

export const listCandidates = async (
  account: Account
): Promise<ICandidate[]> => {
  const dpos = await getDAppChainDPOSContract(account);
  return dpos.getCandidatesAsync();
};

export const checkDelegations = async (
  account: Account,
  validator: string,
  delegator: string
): Promise<IDelegation | null> => {
  const dpos = await getDAppChainDPOSContract(account);
  const validatorAddress = prefixAddress(account.client, validator);
  const delegatorAddress = prefixAddress(account.client, delegator);
  const delegation = await dpos.checkDelegationAsync(
    validatorAddress,
    delegatorAddress
  );
  return delegation;
};

export const claimDelegations = async (
  account: Account,
  withdrawalAddress: string
) => {
  const dpos = await getDAppChainDPOSContract(account);
  const address = prefixAddress(account.client, withdrawalAddress);
  return dpos.claimDistributionAsync(address);
};

/**
 *
 * @param account The DAppChain account
 * @param candidate B64 encoded candidate address
 * @param amount
 */
export const delegate = async (
  account: Account,
  candidate: string,
  amount: BN
) => {
  const coin = await getDAppChainLoomContract(account);
  const dpos = await getDAppChainDPOSContract(account);
  const address = prefixAddress(account.client, candidate);
  await coin.approveAsync(address, amount);
  await dpos.delegateAsync(address, amount);
};

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

const prefixAddress = (client: Client, address: string) => {
  return Address.fromString(`${client.chainId}:${address}`);
};

// GENERIC MAPPINGS

/**
 *
 * @param account The output of loadDAppChainAccount
 * @param wallet
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

export const resolveAddressAsync = async (
  account: Account,
  contractName: string
): Promise<Address | null> => {
  return account.client.getContractAddressAsync(contractName);
};
