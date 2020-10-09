const { assert } = require('chai');

const utils = require('./utils');
const TokenCap = 7692000000;
const AdminInitialBalance = 2000000000;
const CurrentSupply = 5915280000;
const TokensToMint = CurrentSupply - AdminInitialBalance;
const FrozenTokens = 188440000 + 1265240000 + 323040000;

const NullAddress = '0x0000000000000000000000000000000000000000';
const Token = artifacts.require("SENSOToken");
const Migrator = artifacts.require("Migrator");

const chunks = require('../scripts/chunks.js');
//const snapshot = require('./scripts/snapshot.js');

contract("Token redeploy", (accounts) => {
    let token;
    let migrator;

    const admin = accounts[0];
    const targetOwner = accounts[1];

    it(`stage 1 - deploy token and migrator, admin should receive ${AdminInitialBalance} tokens`, async () => {
        token = await Token.new(admin, NullAddress);
        migrator = await Migrator.new();
        console.log('Migrator address is ' + migrator.address);

        const balance = await token.balanceOf.call(admin);
        assert.equal(balance, AdminInitialBalance, "Invalid admin balance");                
    });    

    it(`token cap should be equal to ${TokenCap}`, async () => {
        const cap = await token.cap.call();
        assert.equal(cap, TokenCap, "InvalidCap");
    });

    it(`stage 2 - mint tokens to admin, token supply should be equal to current ${CurrentSupply}`, async () => {
        await token.mint(admin, TokensToMint);
        console.log(`Tokens to mint ${TokensToMint}`);
        const supply = await token.totalSupply.call();
        assert.equal(supply, CurrentSupply, "Invalid supply");       
    });

    it("stage 3 - unpause token", async () => {
        await token.unpause();
        const paused = await token.paused.call();
        assert.equal(paused, false, "Token should be unpaused");
    })

    it('admin balance should be equal to total supply', async () => {
        const balance = await token.balanceOf(admin);
        assert.equal(balance, CurrentSupply, "Invalid admin balance");
    });

    it(`sum of the supply and frozen should not exceed the cap`, async () => {
        const supply = await token.totalSupply.call();
        assert.isAtMost(supply.toNumber() + FrozenTokens, TokenCap, "Cap excedeed");
    });

    it('stage 3 - approve migrator for full supply', async () => {        
        await token.approve(migrator.address, CurrentSupply);
        const allowance = await token.allowance.call(admin, migrator.address);

        assert.equal(allowance, CurrentSupply, "Invalid allowance");
    });

    it("stage 4 - transfer, sum of spreadsheet balances should equal current supply", async () => {
        
        let total = 0;
        for(chunk of chunks) {
            total += chunk.balances.reduce((result, current) => result + current, 0);
            console.log('Total sent: ' + total);
            const tx = await migrator.batchTransfer(token.address, chunk.addresses, chunk.balances);
            console.log('Gas used: ' + tx.receipt.gasUsed);
        }
        assert.equal(total, CurrentSupply, "Invalid total transfers");
    });

    it("admin should have 0 tokens", async () => {
        const balance = await token.balanceOf.call(admin);
        assert.equal(balance, 0, "Invalid balance");
    })
    
    it("stage 5 - change pauser and minter", async () => {
        await token.addPauser(targetOwner);
        await token.renouncePauser();

        await token.addMinter(targetOwner);
        await token.renounceMinter();

        const newMinter = await token.isMinter.call(targetOwner);
        const newPauser = await token.isPauser.call(targetOwner);

        assert.equal(newMinter, true, "Invalid minter");
        assert.equal(newPauser, true, "Invalid pauser");

        // utils.shouldFail(async () => {
        //     token.mint(admin, 100);
        // });
    });

    it("stage 6 - mint frozen tokens, cap should be reached", async () => {
        await token.mint('0x832dF7823734DcEC59732e6923d23A39539e45e5', 188440000, 0, {from: targetOwner});
        await token.mint('0xB0C3eEf8177F900779901dF4E71842B3bbDaB907', 1265240000, 0,{from: targetOwner});
        await token.mint('0x7D18385e3ad941609571316696A8823FeF8087BE', 323040000, 0,{from: targetOwner});

        const supply = await token.totalSupply.call();
        assert.equal(supply, TokenCap, "Cap should be reached");
    });    
});
