const { assert } = require('chai');

const TokenCap = 7692000000;
const AdminInitialBalance = 2000000000;
const CurrentSupply = 5915280000;
const TokensToMint = CurrentSupply - AdminInitialBalance;
const FrozenTokens = 188440000 + 1265240000 + 323040000;

const NullAddress = '0x0000000000000000000000000000000000000000';
const Token = artifacts.require("SENSOToken");
const Migrator = artifacts.require("Migrator");

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

    // parse csv spreadsheet and check total suuply, 5 blocks of 130 transfers each 

    // check ALL spreadsheet balances;

    // change ownership AND RENOUNCE MINTER, test mint to fail

    // check mint of frozen token amounts (3 separate to be ok), then check cap is reached and none could be minted
});
