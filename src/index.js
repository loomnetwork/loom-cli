"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
exports.__esModule = true;
var commander_1 = require("commander");
var bn_js_1 = require("bn.js");
var readFileSync = require('fs').readFileSync;
var loom_js_1 = require("loom-js");
var coinMultiplier = new bn_js_1["default"](10).pow(new bn_js_1["default"](18));
commander_1["default"]
    .version("0.1.0")
    .option("-c, --config <path>", "config file absolute path")
    .parse(process.argv);
var config = require(commander_1["default"].config);
var createUser = function (config) { return __awaiter(_this, void 0, void 0, function () {
    var ethEndPoint, dappchainPrivateKey, ethPrivateKey;
    return __generator(this, function (_a) {
        if (!process.env.INFURA_API_KEY) {
            throw new Error("INFURA_API_KEY env var not set");
        }
        ethEndPoint = "https://rinkeby.infura.io/v3/" + process.env.INFURA_API_KEY;
        dappchainPrivateKey = readFileSync(config.dappchainPrivateKeyFile, 'utf-8').toString().trim();
        ethPrivateKey = readFileSync(config.ethPrivateKeyFile, 'utf-8').toString().trim();
        return [2 /*return*/, loom_js_1.DPOSUserV3.createOfflineUserAsync({
                ethEndpoint: ethEndPoint,
                ethereumPrivateKey: ethPrivateKey,
                dappchainEndpoint: config.dappchainEndpoint,
                dappchainPrivateKey: dappchainPrivateKey,
                chainId: config.chainId,
                gatewayAddress: config.loomGatewayEthAddress,
                version: loom_js_1.GatewayVersion.MULTISIG
            })];
    });
}); };
// DEPOSITS AND WITHDRAWALS (gateway-user)
commander_1["default"]
    .command("coin-balance")
    .description("display the user's balances")
    .action(function (options) {
    return __awaiter(this, void 0, void 0, function () {
        var user, dappchainBalance, mainnetBalance, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, user.getDAppChainBalanceAsync()];
                case 3:
                    dappchainBalance = _a.sent();
                    return [4 /*yield*/, user.ethereumLoom.balanceOf(user.ethAddress)];
                case 4:
                    mainnetBalance = _a.sent();
                    console.log("The account's dappchain balance is\nDappchain: " + dappchainBalance + "\nMainnet:" + mainnetBalance + " ");
                    return [3 /*break*/, 6];
                case 5:
                    err_1 = _a.sent();
                    console.error(err_1);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
});
commander_1["default"]
    .command("deposit <amount>")
    .description("deposit the specified amount of LOOM tokens into the Transfer Gateway")
    .action(function (amount) {
    return __awaiter(this, void 0, void 0, function () {
        var user, e_1, tx, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    // Always try to map accounts before depositing, just in case.
                    return [4 /*yield*/, user.mapAccountsAsync()];
                case 3:
                    // Always try to map accounts before depositing, just in case.
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _a.sent();
                    console.log('GOT ERR', e_1);
                    return [3 /*break*/, 5];
                case 5:
                    _a.trys.push([5, 8, , 9]);
                    return [4 /*yield*/, user.depositAsync(new bn_js_1["default"](amount).mul(coinMultiplier))];
                case 6:
                    tx = _a.sent();
                    return [4 /*yield*/, tx.wait()];
                case 7:
                    _a.sent();
                    console.log(amount + " tokens deposited to Ethereum Gateway.");
                    console.log("Rinkeby tx hash: " + tx.hash);
                    return [3 /*break*/, 9];
                case 8:
                    err_2 = _a.sent();
                    console.error(err_2);
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    });
});
commander_1["default"]
    .command("withdraw <amount>")
    .description("withdraw the specified amount of LOOM tokens via the Transfer Gateway")
    .option("--timeout <number>", "Number of seconds to wait for withdrawal to be processed")
    .action(function (amount, options) {
    return __awaiter(this, void 0, void 0, function () {
        var user, actualAmount, tx, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 5, 6, 7]);
                    actualAmount = new bn_js_1["default"](amount).mul(coinMultiplier);
                    return [4 /*yield*/, user.withdrawAsync(actualAmount)];
                case 3:
                    tx = _a.sent();
                    return [4 /*yield*/, tx.wait()];
                case 4:
                    _a.sent();
                    console.log(amount + " tokens withdrawn from Ethereum Gateway.");
                    console.log("Rinkeby tx hash: " + tx.hash);
                    return [3 /*break*/, 7];
                case 5:
                    err_3 = _a.sent();
                    console.error(err_3);
                    return [3 /*break*/, 7];
                case 6:
                    if (user)
                        user.disconnect();
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
});
commander_1["default"]
    .command("resume-withdrawal")
    .description("Resumes a withdrawal from a pending receipt")
    .action(function () {
    return __awaiter(this, void 0, void 0, function () {
        var user, tx, err_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 6, 7, 8]);
                    return [4 /*yield*/, user.resumeWithdrawalAsync()];
                case 3:
                    tx = _a.sent();
                    if (!tx) return [3 /*break*/, 5];
                    return [4 /*yield*/, tx.wait()];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [3 /*break*/, 8];
                case 6:
                    err_4 = _a.sent();
                    console.error(err_4);
                    return [3 /*break*/, 8];
                case 7:
                    user.disconnect();
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    });
});
commander_1["default"]
    .command("receipt")
    .description("Returns the currently pending receipt")
    .action(function () {
    return __awaiter(this, void 0, void 0, function () {
        var user, receipt, ethNonce, err_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 7, , 8]);
                    return [4 /*yield*/, user.getPendingWithdrawalReceiptAsync()];
                case 3:
                    receipt = _a.sent();
                    if (!receipt) return [3 /*break*/, 5];
                    return [4 /*yield*/, user.ethereumGateway.functions.nonces(user.ethAddress)];
                case 4:
                    ethNonce = _a.sent();
                    console.log("Pending receipt:");
                    console.log("Token owner:", receipt.tokenOwner.toString());
                    console.log("Token address:", user.ethereumLoom.address);
                    console.log("Gateway address:", user.ethereumGateway.address);
                    console.log("Contract:", receipt.tokenContract.toString());
                    console.log("Token kind:", receipt.tokenKind);
                    console.log("Nonce:", receipt.withdrawalNonce.toString());
                    console.log("Contract Nonce:", ethNonce.toString());
                    console.log("Amount:", receipt.tokenAmount.toString());
                    console.log("Signature:", loom_js_1.CryptoUtils.bytesToHexAddr(receipt.oracleSignature));
                    return [3 /*break*/, 6];
                case 5:
                    console.log("No pending receipt");
                    _a.label = 6;
                case 6: return [3 /*break*/, 8];
                case 7:
                    err_5 = _a.sent();
                    console.error(err_5);
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    });
});
// DPOS BINDINGS
commander_1["default"]
    .command("accounts")
    .description("Connects the user's eth/dappchain addresses")
    .action(function () {
    return __awaiter(this, void 0, void 0, function () {
        var user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    try {
                        console.log('Mainnet:', user.ethAddress);
                        console.log('Dappchain', user.loomAddress);
                    }
                    catch (err) {
                        console.error(err);
                    }
                    return [2 /*return*/];
            }
        });
    });
});
// DPOS BINDINGS
commander_1["default"]
    .command("map-accounts")
    .description("Connects the user's eth/dappchain addresses")
    .action(function () {
    return __awaiter(this, void 0, void 0, function () {
        var user, err_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    console.log('trying to map acc');
                    return [4 /*yield*/, user.mapAccountsAsync()];
                case 3:
                    _a.sent();
                    console.log('mapped acc');
                    return [3 /*break*/, 5];
                case 4:
                    err_6 = _a.sent();
                    console.error(err_6);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
});
// DPOS MAPPINGS
commander_1["default"]
    .command("list-validators")
    .description("Show the current DPoS validators")
    .action(function () {
    return __awaiter(this, void 0, void 0, function () {
        var user, validators, err_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, user.listValidatorsAsync()];
                case 3:
                    validators = _a.sent();
                    console.log("Current validators:");
                    validators.forEach(function (v) {
                        console.log("  Address:", v.address.toString());
                        console.log("  Slash percentage:", v.slashPercentage);
                        console.log("  Delegation total:", v.delegationTotal.toString());
                        console.log("\n");
                    });
                    return [3 /*break*/, 5];
                case 4:
                    err_7 = _a.sent();
                    console.error(err_7);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
});
commander_1["default"]
    .command("list-candidates")
    .description("Show the current DPoS candidates (along with their metadata)")
    .action(function () {
    return __awaiter(this, void 0, void 0, function () {
        var user, candidates, err_8;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, user.listCandidatesAsync()];
                case 3:
                    candidates = _a.sent();
                    console.log("Current candidates:");
                    candidates.forEach(function (c) {
                        console.log("  Pubkey:", loom_js_1.CryptoUtils.Uint8ArrayToB64(c.pubKey));
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
                    return [3 /*break*/, 5];
                case 4:
                    err_8 = _a.sent();
                    console.error(err_8);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
});
commander_1["default"]
    .command("list-all-delegations")
    .description("Shows all delegations that are active for each validator")
    .action(function () {
    return __awaiter(this, void 0, void 0, function () {
        var user, delegations, err_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, user.listAllDelegationsAsync()];
                case 3:
                    delegations = _a.sent();
                    console.log("Delegations:");
                    delegations.forEach(function (d) {
                        var dArray = d.delegationsArray;
                        console.log("  Total Amount delegated: " + d.delegationTotal);
                        console.log("  Validator: " + dArray[0].validator.local.toString());
                        dArray.forEach(function (delegation) {
                            console.log("    Delegator: " + delegation.delegator.local.toString());
                            console.log("    Update Validator: " + (delegation.updateValidator
                                ? delegation.updateValidator.local.toString()
                                : "None"));
                            console.log("    Index: " + delegation.index);
                            console.log("    Amount: " + delegation.amount);
                            console.log("    Update Amount: " + delegation.updateAmount);
                            console.log("    Locktime: " + delegation.lockTime);
                            console.log("    Locktime Tier: " + delegation.lockTimeTier);
                            console.log("    Referrer: " + (delegation.referrer ? delegation.referrer : "None"));
                            console.log("    State: " + delegation.state);
                            console.log("\n");
                        });
                    });
                    return [3 /*break*/, 5];
                case 4:
                    err_9 = _a.sent();
                    console.error(err_9);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
});
commander_1["default"]
    .command("list-delegations <validator>")
    .description("Shows all delegations of a validator")
    .action(function (validator) {
    return __awaiter(this, void 0, void 0, function () {
        var user, d, dArray, err_10;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, user.listDelegationsAsync(validator)];
                case 3:
                    d = _a.sent();
                    dArray = d.delegationsArray;
                    console.log("  Total Amount delegated: " + d.delegationTotal);
                    console.log("  Validator: " + dArray[0].validator.local.toString());
                    dArray.forEach(function (delegation) {
                        console.log("    Delegator: " + delegation.delegator.local.toString());
                        console.log("    Update Validator: " + (delegation.updateValidator
                            ? delegation.updateValidator.local.toString()
                            : "None"));
                        console.log("    Index: " + delegation.index);
                        console.log("    Amount: " + delegation.amount);
                        console.log("    Update Amount: " + delegation.updateAmount);
                        console.log("    Locktime: " + delegation.lockTime);
                        console.log("    Locktime Tier: " + delegation.lockTimeTier);
                        console.log("    Referrer: " + (delegation.referrer ? delegation.referrer : "None"));
                        console.log("    State: " + delegation.state);
                        console.log("\n");
                    });
                    return [3 /*break*/, 5];
                case 4:
                    err_10 = _a.sent();
                    console.error(err_10);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
});
commander_1["default"]
    .command("my-delegations")
    .description("display the user's delegations to all candidates")
    .action(function () {
    return __awaiter(this, void 0, void 0, function () {
        var user, delegations, _i, _a, delegation, err_11;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _b.sent();
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, user.checkAllDelegationsAsync()];
                case 3:
                    delegations = _b.sent();
                    for (_i = 0, _a = delegations.delegationsArray; _i < _a.length; _i++) {
                        delegation = _a[_i];
                        console.log("  Validator: " + delegation.delegator.toString());
                        console.log("  Delegator: " + delegation.validator.toString());
                        console.log("  Amount: " + delegation.amount);
                        console.log("  Update Amount: " + delegation.updateAmount);
                        console.log("  Locktime: " + delegation.lockTime);
                        console.log("  Locktime Tier: " + delegation.lockTimeTier);
                        console.log("  State: " + delegation.state);
                    }
                    return [3 /*break*/, 5];
                case 4:
                    err_11 = _b.sent();
                    console.error(err_11);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
});
commander_1["default"]
    .command("time-until-elections")
    .description("displays the time until elections")
    .action(function () {
    return __awaiter(this, void 0, void 0, function () {
        var user, time, err_12;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, user.getTimeUntilElectionsAsync()];
                case 3:
                    time = _a.sent();
                    console.log(time + " seconds until elections");
                    return [3 /*break*/, 5];
                case 4:
                    err_12 = _a.sent();
                    console.error(err_12);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
});
commander_1["default"]
    .command("check-delegations")
    .description("Check how much has a delegator bonded to a candidate/valdidator")
    .option("-v, --validator <dappchain b64 address>")
    .option("-d, --delegator <dappchain b64 address>")
    .action(function (option) {
    return __awaiter(this, void 0, void 0, function () {
        var user, delegations, err_13;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, user.checkDelegationsAsync(option.validator, option.delegator)];
                case 3:
                    delegations = _a.sent();
                    console.log("Delegated from " + option.delegator + " to " + option.validator);
                    console.log("Amount: " + delegations.amount);
                    console.log("Weighted Amount: " + delegations.weightedAmount + "\n");
                    delegations.delegationsArray.forEach(function (delegation) {
                        console.log("  Validator: " + delegation.delegator.toString());
                        console.log("  Delegator: " + delegation.validator.toString());
                        console.log("  Amount: " + delegation.amount);
                        console.log("  Update Amount: " + delegation.updateAmount);
                        console.log("  Locktime: " + delegation.lockTime);
                        console.log("  Locktime Tier: " + delegation.lockTimeTier);
                        console.log("  State: " + delegation.state);
                        console.log("  Index: " + delegation.index);
                        console.log("  Referrer: " + (delegation.referrer ? delegation.referrer : "None"));
                        console.log("\n");
                    });
                    return [3 /*break*/, 5];
                case 4:
                    err_13 = _a.sent();
                    console.error(err_13);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
});
commander_1["default"]
    .command("check-rewards")
    .description("Get back the user rewards")
    .action(function () {
    return __awaiter(this, void 0, void 0, function () {
        var user, rewards, err_14;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, user.checkAllDelegationsAsync()];
                case 3:
                    rewards = _a.sent();
                    console.log("User unclaimed rewards: " + rewards);
                    return [3 /*break*/, 5];
                case 4:
                    err_14 = _a.sent();
                    console.error(err_14);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
});
commander_1["default"]
    .command("claim-rewards")
    .description("Get back the user rewards")
    .action(function () {
    return __awaiter(this, void 0, void 0, function () {
        var user, rewards, err_15;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, user.claimDelegatorRewardsAsync()];
                case 3:
                    rewards = _a.sent();
                    console.log("User claimed back rewards: " + rewards + ". They will be available in your balance after elections.");
                    return [3 /*break*/, 5];
                case 4:
                    err_15 = _a.sent();
                    console.error(err_15);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
});
commander_1["default"]
    .command("delegate <amount> <validator> <tier> [referrer]")
    .description("Delegate `amount` to a candidate / validator")
    .action(function (amount, validator, tier, referrer) {
    return __awaiter(this, void 0, void 0, function () {
        var user, actualAmount, err_16;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    actualAmount = new bn_js_1["default"](amount).mul(coinMultiplier);
                    console.log("Delegating " + actualAmount.toString() + " to validator");
                    return [4 /*yield*/, user.delegateAsync(validator, actualAmount, parseInt(tier), referrer)];
                case 3:
                    _a.sent();
                    console.log("Delegated " + actualAmount.toString() + " to validator");
                    return [3 /*break*/, 5];
                case 4:
                    err_16 = _a.sent();
                    console.error(err_16);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
});
commander_1["default"]
    .command("redelegate <amount> <formerValidator> <validator> <index>")
    .description("Instantly redelegates an amount from a delegation to another validator")
    .action(function (amount, formerValidator, validator, index) {
    return __awaiter(this, void 0, void 0, function () {
        var user, actualAmount, err_17;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    actualAmount = new bn_js_1["default"](amount).mul(coinMultiplier);
                    console.log("Redelegating " + actualAmount.toString() + " from " + formerValidator + " to " + validator);
                    return [4 /*yield*/, user.redelegateAsync(formerValidator, validator, actualAmount, index)];
                case 3:
                    _a.sent();
                    console.log("Delegated " + actualAmount.toString() + " to validator");
                    return [3 /*break*/, 5];
                case 4:
                    err_17 = _a.sent();
                    console.error(err_17);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
});
commander_1["default"]
    .command("undelegate <amount> <validator> <index>")
    .option("-v, --validator <dappchain b64 address>")
    .action(function (amount, validator, index) {
    return __awaiter(this, void 0, void 0, function () {
        var user, err_18;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(config)];
                case 1:
                    user = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, user.undelegateAsync(validator, new bn_js_1["default"](amount).mul(coinMultiplier), index)];
                case 3:
                    _a.sent();
                    console.log("Undelegated " + amount + " LOOM to " + validator);
                    return [3 /*break*/, 5];
                case 4:
                    err_18 = _a.sent();
                    console.error(err_18);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
});
commander_1["default"].version("0.1.0").parse(process.argv);
