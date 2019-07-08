const SENSOToken = artifacts.require("SENSOToken");
// const SENSOCrowdsale = artifacts.require("RateApprovedCrowdsale");
const SENSOCrowdsale = artifacts.require("SENSOCrowdsale");

module.exports = function(deployer, network, accounts) {
    deployer.deploy(SENSOCrowdsale, accounts[3], accounts[1], accounts[2])
};
