const SENSOToken = artifacts.require("SENSOToken");
const Migrator = artifacts.require("Migrator");

const TokenCap = 7692000000;
const AdminInitialBalance = 2000000000;
const CurrentSupply = 5915280000;
const TokensToMint = CurrentSupply - AdminInitialBalance;
const FrozenTokens = 188440000 + 1265240000 + 323040000;

const chunks = require('../scripts/deploy/chunks.js');

let token;
let migrator;

const logTx = tx => {
    console.log(`${tx.receipt.transactionHash}. Gas used: ${tx.receipt.gasUsed}`);
}

module.exports = function(deployer, network, accounts) {
    let admin = accounts[0];

    console.log(network);
    console.log(accounts);

    deployer.then(async () => {
        //1 deploy token
        //token = await deployer.deploy(SENSOToken, accounts[0], "0x0000000000000000000000000000000000000000");
        token = await SENSOToken.new(accounts[0], "0x0000000000000000000000000000000000000000", {gas: 2000000});
        console.log('Token address: ' + token.address);

        //2 deploy migrator
        //migrator = await deployer.deploy(Migrator);
        migrator = await Migrator.new({gas: 600000});
        console.log('Migrator address: ' + migrator.address);

        //3 mint tokens
        console.log("Mint additional tokens");
        logTx(await token.mint(admin, TokensToMint, 0, {gas: 60000}));
        
        console.log("Unpause token");
        logTx(await token.unpause({gas: 60000})); 

        console.log("Aprove transfer");
        logTx(await token.approve(migrator.address, CurrentSupply, {gas: 60000}));

        console.log("Making transfer");
        for([i,chunk] of chunks.entries()) {
            console.log('Chunk #', i);
            logTx(await migrator.batchTransfer(token.address, chunk.addresses, chunk.balances)); 
        }

        const adminTokens = await token.balanceOf.call(admin);
        console.log('Admin tokens left');
        console.log(adminTokens.toString())
    });    
};