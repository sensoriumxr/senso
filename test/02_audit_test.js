const SENSOToken = artifacts.require("SENSOToken")
const SENSOCrowdsale = artifacts.require("SENSOCrowdsale")
const TokenA = artifacts.require("TokenA")
const TokenB = artifacts.require("TokenB")
const utils = require('./utils.js')

contract("SENSOCrowdsale", async accounts => {

  before( async () => {
    crowdsale = await SENSOCrowdsale.deployed()
    token = await SENSOToken.at(await crowdsale.token())
    tokenA = await TokenA.deployed()
    tokenB = await TokenB.deployed()

    constants = {
      totalAmount: 7692000000,
      closedSaleAmount: 2000000000,
      crowdSaleAmount: 3000000000,
      reserveAmount: 2692000000,

      approvalValidTime: 7*24*60*60, // seconds in a week
      tokenApprovalValidTime: 24*60*60, // seconds in a day
      weiInEther: web3.utils.toBN(1e18)
    }

    wallets = {
      admin: accounts[0],

      closedSale: accounts[1],
      tokenSale: crowdsale.address,

      advisory: accounts[7],
      userLoalty: accounts[7],
      partners: accounts[7],

      team: accounts[8],
      safeSupport: accounts[9],
      community: accounts[0],

      collectedFunds: accounts[3],

      investor1: accounts[4],
      investor2: accounts[5],
      investor3: accounts[6],

      noone: accounts[9]
    }
  })

  describe('Initial configuration', async () => {

    it('Can purchase tokens', async () => {
      var amt = 10;
      var amtFrozen = 10;

      await crowdsale.approve(wallets.investor2, amt+amtFrozen, amt+amtFrozen, 50, 1)
      let totalWeiPaid = constants.weiInEther*1
      await utils.shouldChangeBalance(
        async () => {
          await crowdsale.buyTokens(wallets.investor2, {
            from: wallets.investor2,
            value: totalWeiPaid
          })
        }, {
          [token.address]: { [wallets.investor2] : amt },
          'eth': {
            [wallets.collectedFunds] : totalWeiPaid,
            [wallets.investor2] : -totalWeiPaid
          }
        }
      )
    })

    it('Can purchase all remaining tokens', async () => {
      var totalOnSale = (await token.tokensaleAmount()).toNumber() +
        (await token.closedSaleAmount()).toNumber() -
        (await token.totalSupply()).toNumber() -
        (await token.totalFrozenTokens()).toNumber();

      // console.log(totalOnSale)

      await crowdsale.approve(wallets.investor1, totalOnSale, totalOnSale, 0, 0)
      let totalWeiPaid = constants.weiInEther*1
      await utils.shouldChangeBalance(
        async () => {
          await crowdsale.buyTokens(wallets.investor1, {
            from: wallets.investor1,
            value: totalWeiPaid
          })
        }, {
          [token.address]: { [wallets.investor1] : totalOnSale },
          'eth': {
            [wallets.collectedFunds] : totalWeiPaid,
            [wallets.investor1] : -totalWeiPaid
          }
        }
      )
    })

    it('Can NOT purchase if tokensale cap is reached', async () => {
      var amt = 1
      await crowdsale.approve(wallets.investor2, amt, amt, 0, 0)

      let totalWeiPaid = constants.weiInEther*1
      await utils.shouldFail(
        async () => {
          await crowdsale.buyTokens(wallets.investor2, {
            from: wallets.investor2,
            value: totalWeiPaid
          })
        }
      )
    })

    it('Can NOT purchase frozen tokens if tokensale cap is reached', async () => {
      var amt = 1
      await crowdsale.approve(wallets.investor3, amt, amt, 100, 1)

      let totalWeiPaid = constants.weiInEther*1
      await utils.shouldFail(
        async () => {
          await crowdsale.buyTokens(wallets.investor3, {
            from: wallets.investor3,
            value: totalWeiPaid
          })
        }
      )
    })



  })

  describe('Finalization', async () => {

    it('Can finalize', async () => {
      let stopped = await crowdsale.finalized()
      assert.equal(stopped, false)
      var r = await crowdsale.finalize({ from: wallets.admin })
      stopped = await crowdsale.finalized()
      assert.equal(stopped, true)
    })

  })

})


















