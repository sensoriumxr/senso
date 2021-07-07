const Timelock = artifacts.require("SensoTimelock");

module.exports = async function(deployer, network, accounts) {
    const Token = "0xF1C83f5F244133d5b7759ace119b3e436d4f1477";//accounts[2];

    const Beneficiary = "0xb6d225EA81e1c9e483294053B2Ca737bbe8d009e";//accounts[1];
    const ReleaseTime = 1625644740;

    console.log('Migrating to network: ' + network);
    
    const timelock = await Timelock.new(Token, Beneficiary, ReleaseTime)

    console.log("Timelock address is " + timelock.address);

    console.log('Beneficiary: ' + await timelock.beneficiary());
    console.log('Locked until: ' + await timelock.releaseTime());
}