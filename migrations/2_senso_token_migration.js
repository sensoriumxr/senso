const SENSOToken = artifacts.require("SENSOToken");
// const SENSOCrowdsale = artifacts.require("RateApprovedCrowdsale");
const SENSOCrowdsale = artifacts.require("SENSOCrowdsale");

module.exports = function(deployer, network, accounts) {
    const args = process.argv.slice()

    if (args.length < 5) {
        console.log('deploying contracts with test parameters (development mode)')
        deployer.deploy(SENSOCrowdsale, accounts[3], accounts[1]
            , accounts[7], accounts[7], accounts[7]
            , accounts[8], accounts[9], accounts[0])
    } else {
        console.log('deploying contracts with test parameters (production mode)')
        const ws = args[4].split(',')
        if (ws.length != 8) {
            console.error('Invocation error: expecting to get exactly 8 wallets, got', ws.length)
        }
        deployer.deploy(SENSOCrowdsale, ws[0], ws[1], ws[2], ws[3], ws[4],
            ws[5], ws[6], ws[7])
    }
};
