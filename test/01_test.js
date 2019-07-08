const SENSOToken = artifacts.require("SENSOToken")
const SENSOCrowdsale = artifacts.require("SENSOCrowdsale")
const TokenA = artifacts.require("TokenA")
const TokenB = artifacts.require("TokenB")

async function shoudFail (f) {
  let err = null
  try {
    let b = await f()
  } catch(error) {
    err = error
  }
  assert.ok(err instanceof Error)
}

async function shouldChangeBalance (f, deltas) {
  let accs = Object.keys(deltas)
  let before = await balances(accs)
  await f()
  let after = await balances(accs)
  for (var i=0; i<accs.length; i++) {
    let a = accs[i]
    assert.equal(after[a] - before[a], deltas[a])
  }
}

async function balances (accs) {
  var res = {}
  for (var i=0; i<accs.length; i++) {
    res[accs[i]] = (await token.balanceOf(accs[i])).toNumber()
  }
  return res
}

contract("SENSOCrowdsale", async accounts => {

  before( async () => {
    crowdsale = await SENSOCrowdsale.deployed()
    token = await SENSOToken.at(await crowdsale.token())
    tokenA = await TokenA.deployed()
    tokenB = await TokenB.deployed()

    constants = {
      totalAmount: 769200000,
      closedSaleAmount: 200000000,
      crowdSaleAmount: 300000000,
      reserveAmount: 269200000,

      approvalValidTime: 7*24*60*60, // seconds in a week
      weiInEther: 1e18
    }

    wallets = {
      closedSale: accounts[1],
      tokenSale: crowdsale.address,
      reserveSale: accounts[2],

      collectedFunds: accounts[3],

      investor1: accounts[4],
      investor2: accounts[5],

      noone: accounts[9]
    }
  })

  describe('Initial configuration', async () => {

    it('Total supply is 769 200 000', async () => {
      let b = (await token.totalSupply()).toNumber();
      assert.equal(b, constants.totalAmount - constants.crowdSaleAmount)
    })
 
    it('Closed sale balance is 200 000 000', async () => {
      let b = (await token.balanceOf(wallets.closedSale)).toNumber();
      assert.equal(b, constants.closedSaleAmount)
    })
 
    it('Reserve is 269 200 000', async () => {
      let b = (await token.balanceOf(wallets.reserveSale)).toNumber();
      assert.equal(b, constants.reserveAmount)
    })
 
  })

  describe('Tokensale stage', async () => {

    it('Closed sale wallet can transfer', async () => {
      let amt = 1
      await shouldChangeBalance(
        () => token.transfer(wallets.investor1, amt,
          { from: wallets.closedSale }),
        {
          [wallets.closedSale] : -amt,
          [wallets.investor1]  : amt
        }
      )
    })

    it('Reserve can NOT transfer', async () => {
      await shoudFail( () => token.transfer(wallets.investor1, amt,
        { from: wallets.reserveSale }))
    })

    it('Investor can NOT transfer', async () => {
      await shoudFail( () => token.transfer(wallets.investor1, amt,
        { from: wallets.tokenSale }))
    })

  })

  describe('Approvals', async () => {

    it('Cannot buy before approval', async () => {
      shoudFail(async () => await crowdsale.buyTokens(wallets.investor1,
        { from: wallets.investor1 }) )
    })

    describe('Initial approval', async () => {

      it('Can approve', async () => {
        let rate = 100
        var b = (await crowdsale.approve(wallets.investor2, rate)).receipt.blockNumber
        var ts = (await web3.eth.getBlock(b)).timestamp;
        shoudFail(async () => await crowdsale.getApprovalRate(wallets.investor1))
        let rate2 = (await crowdsale.getApprovalRate(wallets.investor2)).toNumber()
        assert.equal(rate2, rate)
        let bestBefore2 = (await crowdsale.getApprovalBestBefore(wallets.investor2)).toNumber()
        assert.closeTo(bestBefore2, ts+constants.approvalValidTime, 5)
      })

      it('Can not approve second time', async () => {
        shoudFail(async () => await crowdsale.approve(wallets.investor2, 1))
      })

      it('Can approve another investor', async () => {
        let rate = 66
        var b = (await crowdsale.approve(wallets.investor1, rate)).receipt.blockNumber
        var ts = (await web3.eth.getBlock(b)).timestamp;
        let rate1 = (await crowdsale.getApprovalRate(wallets.investor1)).toNumber()
        assert.equal(rate1, rate)
        let rate2 = (await crowdsale.getApprovalRate(wallets.investor2)).toNumber()
        assert.equal(rate2, 100) // magic constant from previous test
        let bestBefore1 = (await crowdsale.getApprovalBestBefore(wallets.investor2)).toNumber()
        assert.closeTo(bestBefore1, ts+constants.approvalValidTime, 5)
      })

      it('Can buy', async () => {
        let rate = 66
        let amt = 10
        await shouldChangeBalance(
          async () => {
            await crowdsale.buyTokens(wallets.investor1, {
              from: wallets.investor1,
              value: constants.weiInEther*amt/rate
            })
          }, { [wallets.investor1] : amt }
        )
      })

      // it('Cannot be purchased by a random person', async () => {
      //   shoudFail(async () => crowdsale.buyTokens(wallets.noone, {
      //     from: wallets.noone,
      //     value: 10*constants.weiInEther
      //   }))
      // })

      it('Cannot be purchased by a random person in favour of someone approved', async () => {
        shoudFail(async () => crowdsale.buyTokens(wallets.investor2, {
          from: wallets.noone,
          value: 10*constants.weiInEther
        }))
      })

      // it('Cannot be purchased by an approved account in favour of random person', async () => {
      //   shoudFail(async () => crowdsale.buyTokens(wallets.noone, {
      //     from: wallets.investor2,
      //     value: 10*constants.weiInEther
      //   }))
      // })

      it('Rate is zeroed after the purchase', async () => {
        shoudFail(async () => crowdsale.getApprovalRate(wallets.investor1))
      })

      it('Best before is zeroed after the purchase', async () => {
        shoudFail(async () => crowdsale.getApprovalBestBefore(wallets.investor1))
      })

      it('Can not buy again', async () => {
        shoudFail(async () => await crowdsale.buyTokens(
          wallets.investor1, {
            from: wallets.investor1,
            value: constants.weiInEther*amt/rate
          })
        )
      })

      it('Another investor can buy', async () => {
        let rate = 100
        let amt = 33
        await shouldChangeBalance(
          async () => {
            await crowdsale.buyTokens(wallets.investor2, {
              from: wallets.investor2,
              value: constants.weiInEther*amt/rate
            })
          }, { [wallets.investor2] : amt }
        )
      })

    })

    describe('Second approval', async () => {

      it('Can be approved second time with another rate', async () => {
        let rate = 12
        var b = (await crowdsale.approve(wallets.investor1, rate)).receipt.blockNumber
        var ts = (await web3.eth.getBlock(b)).timestamp;
        let rate1 = (await crowdsale.getApprovalRate(wallets.investor1)).toNumber()
        assert.equal(rate1, rate)
        let bestBefore1 = (await crowdsale.getApprovalBestBefore(wallets.investor1)).toNumber()
        assert.closeTo(bestBefore1, ts+constants.approvalValidTime, 5)
      })

      it('Can buy using new approval', async () => {
        let rate = 12
        let amt = 7
        await shouldChangeBalance(
          async () => {
            await crowdsale.buyTokens(wallets.investor1, {
              from: wallets.investor1,
              value: constants.weiInEther*amt/rate
            })
          }, { [wallets.investor1] : amt }
        )
      })

     })

  })


  describe('Purchasing with tokens', async () => {

    it('Minting side tokens', async () => {
      await tokenA.mint(wallets.investor1, 1000)
      await tokenA.mint(wallets.investor2, 100)

      await tokenB.mint(wallets.investor1, 10000)
    })

    it('Cannot be bought if not approved', async () => {
      await tokenA.approve(crowdsale.address, 1000, { from: wallets.noone })
      shoudFail(async () => await crowdsale.buyTokensWithTokens(
        wallets.noone, tokenA.address, 10, {
          from: wallets.noone
        })
      )
    })

    it('Can approve', async () => {
      let rate = 3
      var b = (await crowdsale.tokenApprove(wallets.investor1, tokenA.address, rate)).receipt.blockNumber
      var ts = (await web3.eth.getBlock(b)).timestamp;
      shoudFail(async () => await crowdsale.getApprovalRate(wallets.investor2))
      let rate1 = (await crowdsale.getTokenApprovalRate(wallets.investor1, tokenA.address)).toNumber()
      assert.equal(rate1, rate)
      let bestBefore1 = (await crowdsale.getTokenApprovalBestBefore(wallets.investor1, tokenA.address)).toNumber()
      assert.closeTo(bestBefore1, ts+constants.approvalValidTime, 5)
    })

    it('Can buy with tokens', async () => {
      let rate = 3
      let amt = 33
      await tokenA.approve(crowdsale.address, amt, { from: wallets.investor1 })
      await shouldChangeBalance(
        async () => {
          await crowdsale.buyTokensWithTokens(wallets.investor1, tokenA.address, amt, {
            from: wallets.investor1
          })
        }, { [wallets.investor1] : amt*rate }
      )
    })

    it('Rate is zeroed after the purchase', async () => {
      shoudFail(async () => crowdsale.getTokenApprovalRate(wallets.investor1, tokenA.address))
    })

    it('Best before is zeroed after the purchase', async () => {
      shoudFail(async () => crowdsale.getTokenApprovalBestBefore(wallets.investor1, tokenA.address))
    })

    it('Cannot buy again', async () => {
      await tokenA.approve(crowdsale.address, 1000, { from: wallets.noone })
      shoudFail(async () => await crowdsale.buyTokensWithTokens(
        wallets.noone, tokenA.address, 10, {
          from: wallets.investor1
        })
      )
    })

    it('Can approve again', async () => {
      let rate = 2
      var b = (await crowdsale.tokenApprove(wallets.investor1, tokenA.address, rate)).receipt.blockNumber
      var ts = (await web3.eth.getBlock(b)).timestamp;
      shoudFail(async () => await crowdsale.getApprovalRate(wallets.investor2))
      let rate1 = (await crowdsale.getTokenApprovalRate(wallets.investor1, tokenA.address)).toNumber()
      assert.equal(rate1, rate)
      let bestBefore1 = (await crowdsale.getTokenApprovalBestBefore(wallets.investor1, tokenA.address)).toNumber()
      assert.closeTo(bestBefore1, ts+constants.approvalValidTime, 5)
    })

    it('Can approve another investor', async () => {
      let rate = 1
      var b = (await crowdsale.tokenApprove(wallets.investor2, tokenB.address, rate)).receipt.blockNumber
      var ts = (await web3.eth.getBlock(b)).timestamp;
      shoudFail(async () => await crowdsale.getApprovalRate(wallets.investor2))
      let rate1 = (await crowdsale.getTokenApprovalRate(wallets.investor2, tokenB.address)).toNumber()
      assert.equal(rate1, rate)
      let bestBefore1 = (await crowdsale.getTokenApprovalBestBefore(wallets.investor2, tokenB.address)).toNumber()
      assert.closeTo(bestBefore1, ts+constants.approvalValidTime, 5)
    })

    it('Cannot buy with another token', async () => {
      await tokenA.approve(crowdsale.address, 1000, { from: wallets.investor2 })
      shoudFail(async () => await crowdsale.buyTokensWithTokens(
        wallets.investor2, tokenA.address, 10, {
          from: wallets.investor2
        })
      )
    })

    it('Can not when purchase exceeds token balance', async () => {
      let tokenBalancePlusOne = (await tokenB.balanceOf(wallets.investor2)).toNumber() + 1
      shoudFail(async () => await crowdsale.buyTokensWithTokens(
        wallets.investor2, tokenB.address, tokenBalancePlusOne, {
          from: wallets.investor2
        })
      )
    })

  })


  describe('Crowdsale stopped', async () => {

    it('Cannot be stopped by random person', async () => {
      shoudFail(async () => crowdsale.pause({ from: wallets.noone }) )
    })

    it('Can be stopped by crowdsale owner', async () => {
      shoudFail(async () => crowdsale.pause() )
    })

  })

})


















