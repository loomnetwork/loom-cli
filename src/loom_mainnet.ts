import { ethers, ContractTransaction } from "ethers";
import BN from "bn.js";
import { config } from "./trudy_loomv2b";
import Web3 from "web3";

// @todo convert to ethers ABI
// import ERC20 from './ERC20.json';
// import ERC20Gateway from './ERC20Gateway.json';
const ERC20 = require("./ERC20.json");
const ERC20Gateway = require("./ERC20Gateway.json");

export const rinkebyGatewayAddress = config.loomGatewayEthAddress;
export const rinkebyLoomAddress = config.loomTokenEthAddress;
export const coinMultiplier = new BN(10).pow(new BN(18));

/**
 * Creates an Ethers wallet instance connected to a private key
 * @param endpoint
 * @param privateKey
 */
export const loadMainnetAccount = (
  endpoint: string = "https://localhost:8545",
  privateKey: string
): ethers.Signer => {
  const provider = new ethers.providers.JsonRpcProvider(endpoint);
  const wallet = new ethers.Wallet(privateKey, provider);
  return wallet;
};

/**
 * Creates an Ethers wallet instance connected to a private key
 * @param endpoint
 * @param privateKey
 */
export const loadMetamaskAccount = (web3: Web3): ethers.Signer => {
  const provider = new ethers.providers.Web3Provider(web3.currentProvider);
  const wallet = provider.getSigner();
  return wallet;
};

/**
 *
 * @param wallet
 */
export const getRinkebyGatewayContract = (
  wallet: ethers.Signer
): ethers.Contract => {
  return new ethers.Contract(rinkebyGatewayAddress, ERC20Gateway, wallet);
};

export const getRinkebyLoomContract = (
  wallet: ethers.Signer
): ethers.Contract => {
  return new ethers.Contract(rinkebyLoomAddress, ERC20, wallet);
};

export const getMainnetBalance = async (
  wallet: ethers.Signer,
  accountAddress: string
): Promise<ethers.utils.BigNumber> => {
  const contract = getRinkebyLoomContract(wallet);
  const balance = await contract.balanceOf(accountAddress);
  return balance;
};

export const depositCoinToRinkebyGateway = async (
  wallet: ethers.Signer,
  amount: BN
): Promise<ethers.ContractTransaction> => {
  const loom = getRinkebyLoomContract(wallet);
  const gateway = getRinkebyGatewayContract(wallet);

  let currentApproval = await loom.allowance(
    await wallet.getAddress(),
    gateway.address
  );
  currentApproval = new BN(currentApproval._hex.split("0x")[1], 16); // ugly way to convert the

  console.log("Current approval:", currentApproval);
  if (amount.gt(currentApproval)) {
    let tx: ContractTransaction = await loom.approve(
      gateway.address,
      amount.sub(currentApproval).toString()
    );
    await tx.wait();
    console.log("Approved an extra", amount.sub(currentApproval));
  }
  return gateway.depositERC20(amount.toString(), loom.address);
};

export const withdrawCoinFromRinkebyGateway = async (
  wallet: ethers.Signer,
  amount: BN,
  sig: string
): Promise<ethers.ContractTransaction> => {
  const gateway = getRinkebyGatewayContract(wallet);
  return gateway.withdrawERC20(amount.toString(), sig, rinkebyLoomAddress);
};
