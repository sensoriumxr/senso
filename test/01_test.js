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

    it('Total supply is 769 200 000', async () => {
      let b = (await token.totalSupply()).toNumber()
      assert.equal(b, constants.totalAmount - constants.crowdSaleAmount - constants.reserveAmount)
    })
 
    it('Closed sale balance is 200 000 000', async () => {
      let b = (await token.balanceOf(wallets.closedSale)).toNumber();
      assert.equal(b, constants.closedSaleAmount)
    })
 
    it('Reserve is 269 200 000', async () => {
      let b1 = (await crowdsale.advisoryAmount()).toNumber()
      let b2 = (await crowdsale.userLoyaltyAmount()).toNumber()
      let b3 = (await crowdsale.partnersAmount()).toNumber()
      let b4 = (await crowdsale.teamAmount()).toNumber()
      let b5 = (await crowdsale.safeSupportAmount()).toNumber()
      let b6 = (await crowdsale.communityAmount()).toNumber()
      assert.equal(b1+b2+b3+b4+b5+b6, constants.reserveAmount)
    })
 
  })

  describe('Tokensale stage', async () => {

    it('Closed sale wallet can transfer', async () => {
      let amt = 1
      await utils.shouldChangeBalance(
        () => token.transfer(wallets.investor1, amt,
          { from: wallets.closedSale }),
        {
          [token.address] : {
            [wallets.closedSale] : -amt,
            [wallets.investor1]  : amt
          }
        }
      )
    })

    it('advisory can NOT transfer', async () => {
      await utils.shouldFail( () => token.transfer(wallets.investor1, amt,
        { from: wallets.advisory }))
    })

    it('userLoalty can NOT transfer', async () => {
      await utils.shouldFail( () => token.transfer(wallets.investor1, amt,
        { from: wallets.userLoalty }))
    })

    it('partners can NOT transfer', async () => {
      await utils.shouldFail( () => token.transfer(wallets.investor1, amt,
        { from: wallets.partners }))
    })

    it('team can NOT transfer', async () => {
      await utils.shouldFail( () => token.transfer(wallets.investor1, amt,
        { from: wallets.team }))
    })

    it('safeSupport can NOT transfer', async () => {
      await utils.shouldFail( () => token.transfer(wallets.investor1, amt,
        { from: wallets.safeSupport }))
    })

    it('community can NOT transfer', async () => {
      await utils.shouldFail( () => token.transfer(wallets.investor1, amt,
        { from: wallets.community }))
    })

    it('Investor can NOT transfer', async () => {
      await utils.shouldFail( () => token.transfer(wallets.investor1, amt,
        { from: wallets.tokenSale }))
    })

  })

  describe('Approvals', async () => {

    it('Cannot buy before approval', async () => {
      await utils.shouldFail(async () => crowdsale.buyTokens(wallets.investor1,
        { from: wallets.investor1 }) )
    })

    describe('Initial approval (no freeze)', async () => {

      it('Can approve', async () => {
        let rate = 100
        var b = (await crowdsale.approve(wallets.investor2, rate, 999999, 0, 0)).receipt.blockNumber
        var ts = (await web3.eth.getBlock(b)).timestamp;
        await utils.shouldFail(async () => crowdsale.getApprovalRate(wallets.investor1))
        let rate2 = (await crowdsale.getApprovalRate(wallets.investor2)).toNumber()
        assert.equal(rate2, rate)
        let bestBefore2 = (await crowdsale.getApprovalBestBefore(wallets.investor2)).toNumber()
        assert.closeTo(bestBefore2, ts+constants.approvalValidTime, 5)
      })

      it('Can not approve second time', async () => {
        await utils.shouldFail(async () => crowdsale.approve(wallets.investor2, 1, 999999, 0, 0))
      })

      it('Can not approve with 0 limit', async () => {
        await utils.shouldFail(async () => crowdsale.approve(wallets.investor1, 1, 0, 0, 0))
      })

      it('Can approve another investor', async () => {
        let rate = 5
        var b = (await crowdsale.approve(wallets.investor1, rate, 10, 0, 0)).receipt.blockNumber
        var ts = (await web3.eth.getBlock(b)).timestamp;
        let rate1 = (await crowdsale.getApprovalRate(wallets.investor1)).toNumber()
        assert.equal(rate1, rate)
        let rate2 = (await crowdsale.getApprovalRate(wallets.investor2)).toNumber()
        assert.equal(rate2, 100) // magic constant from previous test
        let bestBefore1 = (await crowdsale.getApprovalBestBefore(wallets.investor2)).toNumber()
        assert.closeTo(bestBefore1, ts+constants.approvalValidTime, 5)
      })

      it('Can not buy more than approved', async () => {
        let rate = 5
        let amt = 20
        let totalWeiPaid = constants.weiInEther*amt/rate
        await utils.shouldFail(
          async () => {
            await crowdsale.buyTokens(wallets.investor1, {
              from: wallets.investor1,
              value: totalWeiPaid
            })
          }
        )
      })

      it('Can buy', async () => {
        let rate = 5
        let amt = 10
        let totalWeiPaid = constants.weiInEther*amt/rate
        await utils.shouldChangeBalance(
          async () => {
            await crowdsale.buyTokens(wallets.investor1, {
              from: wallets.investor1,
              value: totalWeiPaid
            })
          }, {
            [token.address]: { [wallets.investor1] : amt },
            'eth': {
              [wallets.collectedFunds] : totalWeiPaid,
              [wallets.investor1] : -totalWeiPaid
            }
          }
        )
      })

      // it('Cannot be purchased by a random person', async () => {
      //   utils.shouldFail(async () => crowdsale.buyTokens(wallets.noone, {
      //     from: wallets.noone,
      //     value: 10*constants.weiInEther
      //   }))
      // })

      it('Cannot be purchased by a random person in favour of someone approved', async () => {
        await utils.shouldFail(async () => crowdsale.buyTokens(wallets.investor2, {
          from: wallets.noone,
          value: 10*constants.weiInEther
        }))
      })

      // it('Cannot be purchased by an approved account in favour of random person', async () => {
      //   utils.shouldFail(async () => crowdsale.buyTokens(wallets.noone, {
      //     from: wallets.investor2,
      //     value: 10*constants.weiInEther
      //   }))
      // })

      it('Rate is zeroed after the purchase', async () => {
        await utils.shouldFail(async () => crowdsale.getApprovalRate(wallets.investor1))
      })

      it('Best before is zeroed after the purchase', async () => {
        await utils.shouldFail(async () => crowdsale.getApprovalBestBefore(wallets.investor1))
      })

      it('Can not buy again', async () => {
        await utils.shouldFail(async () => crowdsale.buyTokens(
          wallets.investor1, {
            from: wallets.investor1,
            value: constants.weiInEther*amt/rate
          })
        )
      })

      it('Another investor can buy', async () => {
        let rate = 100
        let amt = 33
        await utils.shouldChangeBalance(
          async () => {
            await crowdsale.buyTokens(wallets.investor2, {
              from: wallets.investor2,
              value: constants.weiInEther*amt/rate
            })
          }, {
            [token.address]: { [wallets.investor2] : amt }
          }
        )
      })

    })

    describe('Initial approval (with freeze)', async () => {

      it('Can NOT approve with no freeze time', async () => {
        await utils.shouldFail(async () => crowdsale.approve(wallets.investor2, rate, 999999, 10, 0))
      })

      it('Can NOT approve with no share', async () => {
        await utils.shouldFail(async () => crowdsale.approve(wallets.investor2, rate, 999999, 0, 10))
      })

      it('Can NOT approve with frozen share exceeeds 100%', async () => {
        await utils.shouldFail(async () => crowdsale.approve(wallets.investor2, rate, 999999, 101, 10))
      })

      it('Can approve', async () => {
        let rate = 100
        let freezeShare = 10
        let freezeTime = 1
        var b = (await crowdsale.approve(wallets.investor3, rate, 999999, freezeShare, freezeTime)).receipt.blockNumber
        var ts = (await web3.eth.getBlock(b)).timestamp;
        await utils.shouldFail(async () => crowdsale.getApprovalRate(wallets.investor1))
        let rate2 = (await crowdsale.getApprovalRate(wallets.investor3)).toNumber()
        assert.equal(rate2, rate)
        let bestBefore2 = (await crowdsale.getApprovalBestBefore(wallets.investor3)).toNumber()
        assert.closeTo(bestBefore2, ts+constants.approvalValidTime, 5)
      })

      it('Can buy with frozen amount', async () => {
        let rate = 100
        let amt = 10
        let freezeShare = 10
        let freezeTime = 1
        let totalWeiPaid = constants.weiInEther*amt/rate
        await utils.shouldChangeBalance(
          async () => {
            await crowdsale.buyTokens(wallets.investor3, {
              from: wallets.investor3,
              value: totalWeiPaid
            })
          }, {
            [token.address]: { [wallets.investor3] : amt*(100-freezeShare)/100 },
            'eth': {
              [wallets.collectedFunds] : totalWeiPaid,
              [wallets.investor3] : -totalWeiPaid
            }
          }
        )
      })

      it('have correct number of frozen tokens', async () => {
        let amt = 10
        let freezeTime = 1
        let freezeShare = 0.1
        let frozen = (await crowdsale.frozenTokens(wallets.investor3, freezeTime)).toNumber()
        assert.equal(frozen, freezeShare*amt)
      })

      it('Can approve 2nd time', async () => {
        let rate = 100
        let freezeShare = 20
        let freezeTime = 1
        var b = (await crowdsale.approve(wallets.investor3, rate, 999999, freezeShare, freezeTime)).receipt.blockNumber
        var ts = (await web3.eth.getBlock(b)).timestamp;
        await utils.shouldFail(async () =>  crowdsale.getApprovalRate(wallets.investor1))
        let rate2 = (await crowdsale.getApprovalRate(wallets.investor3)).toNumber()
        assert.equal(rate2, rate)
        let bestBefore2 = (await crowdsale.getApprovalBestBefore(wallets.investor3)).toNumber()
        assert.closeTo(bestBefore2, ts+constants.approvalValidTime, 5)
      })

      it('Can buy with frozen amount 2nd time', async () => {
        let rate = 100
        let amt = 10
        let freezeShare = 20
        let freezeTime = 1
        let totalWeiPaid = constants.weiInEther*amt/rate
        await utils.shouldChangeBalance(
          async () => {
            await crowdsale.buyTokens(wallets.investor3, {
              from: wallets.investor3,
              value: totalWeiPaid
            })
          }, {
            [token.address]: { [wallets.investor3] : amt*(100-freezeShare)/100 },
            'eth': {
              [wallets.collectedFunds] : totalWeiPaid,
              [wallets.investor3] : -totalWeiPaid
            }
          }
        )
      })

      it('frozen tokens stacks', async () => {
        let freezeTime = 1
        let frozen = (await crowdsale.frozenTokens(wallets.investor3, freezeTime)).toNumber()
        assert.equal(frozen, 10*0.1 + 10*0.2)
      })

      it('Can approve 3rd time', async () => {
        let rate = 100
        let freezeShare = 20
        let freezeTime = 10
        var b = (await crowdsale.approve(wallets.investor3, rate, 999999, freezeShare, freezeTime)).receipt.blockNumber
        var ts = (await web3.eth.getBlock(b)).timestamp;
        await utils.shouldFail(async () =>  crowdsale.getApprovalRate(wallets.investor1))
        let rate2 = (await crowdsale.getApprovalRate(wallets.investor3)).toNumber()
        assert.equal(rate2, rate)
        let bestBefore2 = (await crowdsale.getApprovalBestBefore(wallets.investor3)).toNumber()
        assert.closeTo(bestBefore2, ts+constants.approvalValidTime, 5)
      })

      it('Can buy with frozen amount 3nd time', async () => {
        let rate = 100
        let amt = 10
        let freezeShare = 20
        let freezeTime = 10
        let totalWeiPaid = constants.weiInEther*amt/rate
        await utils.shouldChangeBalance(
          async () => {
            await crowdsale.buyTokens(wallets.investor3, {
              from: wallets.investor3,
              value: totalWeiPaid
            })
          }, {
            [token.address]: { [wallets.investor3] : amt*(100-freezeShare)/100 },
            'eth': {
              [wallets.collectedFunds] : totalWeiPaid,
              [wallets.investor3] : -totalWeiPaid
            }
          }
        )
      })

      it('frozen tokens with different freeze time are fine living together', async () => {
        let freezeTime1 = 1
        let frozen1 = (await crowdsale.frozenTokens(wallets.investor3, freezeTime1)).toNumber()
        assert.equal(frozen1, 10*0.1 + 10*0.2)
        let freezeTime2 = 10
        let frozen2 = (await crowdsale.frozenTokens(wallets.investor3, freezeTime2)).toNumber()
        assert.equal(frozen2, 10*0.2)
      })

    })

    describe('Second approval', async () => {

      it('Can be approved second time with another rate', async () => {
        let rate = 12
        var b = (await crowdsale.approve(wallets.investor1, rate, 999999, 0, 0)).receipt.blockNumber
        var ts = (await web3.eth.getBlock(b)).timestamp;
        let rate1 = (await crowdsale.getApprovalRate(wallets.investor1)).toNumber()
        assert.equal(rate1, rate)
        let bestBefore1 = (await crowdsale.getApprovalBestBefore(wallets.investor1)).toNumber()
        assert.closeTo(bestBefore1, ts+constants.approvalValidTime, 5)
      })

      it('Can buy using new approval', async () => {
        let rate = 12
        let amt = 7
        await utils.shouldChangeBalance(
          async () => {
            await crowdsale.buyTokens(wallets.investor1, {
              from: wallets.investor1,
              value: constants.weiInEther*amt/rate
            })
          }, {
            [token.address] : { [wallets.investor1] : amt }
          }
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
      await utils.shouldFail(async () => crowdsale.buyTokensWithTokens(
        wallets.noone, tokenA.address, 10, {
          from: wallets.noone
        })
      )
    })

    it('Can not approve with 0 limit', async () => {
      await utils.shouldFail(async () => crowdsale.tokenApprove(wallets.investor1, tokenA.address, 1, 0, 0, 0))
    })

    it('Can approve', async () => {
      let rate = 3
      var b = (await crowdsale.tokenApprove(wallets.investor1, tokenA.address, rate, 3, 0, 0)).receipt.blockNumber
      var ts = (await web3.eth.getBlock(b)).timestamp;
      await utils.shouldFail(async () => crowdsale.getApprovalRate(wallets.investor2))
      let rate1 = (await crowdsale.getTokenApprovalRate(wallets.investor1, tokenA.address)).toNumber()
      assert.equal(rate1, rate)
      let bestBefore1 = (await crowdsale.getTokenApprovalBestBefore(wallets.investor1, tokenA.address)).toNumber()
      assert.closeTo(bestBefore1, ts+constants.tokenApprovalValidTime, 5)
    })

    it('Can not buy with more than approved', async () => {
      let rate = 3
      let amt = 30
      await tokenA.approve(crowdsale.address, amt/rate, { from: wallets.investor1 })
      await utils.shouldFail(
        async () => {
          await crowdsale.buyTokensWithTokens(wallets.investor1, tokenA.address, amt/rate, {
            from: wallets.investor1
          })
        }
      )
    })

    it('Can buy with tokens', async () => {
      let rate = 3
      let amt = 3
      await tokenA.approve(crowdsale.address, amt/rate, { from: wallets.investor1 })
      await utils.shouldChangeBalance(
        async () => {
          await crowdsale.buyTokensWithTokens(wallets.investor1, tokenA.address, amt/rate, {
            from: wallets.investor1
          })
        }, {
          [token.address] : {
            [wallets.investor1] : amt
          },
          [tokenA.address] : {
            [wallets.collectedFunds] : amt/rate,
            [wallets.investor1] : -amt/rate
          }
        }
      )
    })

    it('Rate is zeroed after the purchase', async () => {
      await utils.shouldFail(async () => crowdsale.getTokenApprovalRate(wallets.investor1, tokenA.address))
    })

    it('Best before is zeroed after the purchase', async () => {
      await utils.shouldFail(async () => crowdsale.getTokenApprovalBestBefore(wallets.investor1, tokenA.address))
    })

    it('Cannot buy again', async () => {
      await tokenA.approve(crowdsale.address, 1000, { from: wallets.noone })
      await utils.shouldFail(async () => crowdsale.buyTokensWithTokens(
        wallets.noone, tokenA.address, 10, {
          from: wallets.investor1
        })
      )
    })

    it('Can approve again', async () => {
      let rate = 2
      var b = (await crowdsale.tokenApprove(wallets.investor1, tokenA.address, rate, 999999, 0, 0)).receipt.blockNumber
      var ts = (await web3.eth.getBlock(b)).timestamp;
      await utils.shouldFail(async () => crowdsale.getApprovalRate(wallets.investor2))
      let rate1 = (await crowdsale.getTokenApprovalRate(wallets.investor1, tokenA.address)).toNumber()
      assert.equal(rate1, rate)
      let bestBefore1 = (await crowdsale.getTokenApprovalBestBefore(wallets.investor1, tokenA.address)).toNumber()
      assert.closeTo(bestBefore1, ts+constants.tokenApprovalValidTime, 5)
    })

    it('Can approve another investor', async () => {
      let rate = 1
      var b = (await crowdsale.tokenApprove(wallets.investor2, tokenB.address, rate, 999999, 0, 0)).receipt.blockNumber
      var ts = (await web3.eth.getBlock(b)).timestamp;
      await utils.shouldFail(async () => crowdsale.getApprovalRate(wallets.investor2))
      let rate1 = (await crowdsale.getTokenApprovalRate(wallets.investor2, tokenB.address)).toNumber()
      assert.equal(rate1, rate)
      let bestBefore1 = (await crowdsale.getTokenApprovalBestBefore(wallets.investor2, tokenB.address)).toNumber()
      assert.closeTo(bestBefore1, ts+constants.tokenApprovalValidTime, 5)
    })

    it('Cannot buy with another token', async () => {
      await tokenA.approve(crowdsale.address, 1000, { from: wallets.investor2 })
      await utils.shouldFail(async () => crowdsale.buyTokensWithTokens(
        wallets.investor2, tokenA.address, 10, {
          from: wallets.investor2
        })
      )
    })

    it('Can not buy when purchase exceeds token balance', async () => {
      let tokenBalancePlusOne = (await tokenB.balanceOf(wallets.investor2)).toNumber() + 1
      await utils.shouldFail(async () => crowdsale.buyTokensWithTokens(
        wallets.investor2, tokenB.address, tokenBalancePlusOne, {
          from: wallets.investor2
        })
      )
    })

  })


  describe('Crowdsale finalization', async () => {

    it('Cannot be finalized by random person', async () => {
      await utils.shouldFail(async () => crowdsale.finalize({ from: wallets.noone }) )
    })

    it('Can be finalized by crowdsale owner', async () => {
      let stopped = await crowdsale.finalized()
      assert.equal(stopped, false)
      var r = await crowdsale.finalize({ from: wallets.admin })
      // constants.frozenReserveFreezeTime = r.logs[0].args[1].toNumber()
      stopped = await crowdsale.finalized()
      assert.equal(stopped, true)
    })

    it('Advisory can transfer', async () => {
      let amt = 1
      await utils.shouldChangeBalance(
        () => token.transfer(wallets.investor1, amt,
          { from: wallets.advisory }),
        {
          [token.address] : {
            [wallets.advisory] : -amt,
            [wallets.investor1]  : amt
          }
        }
      )
    })

    it('UserLoalty can transfer', async () => {
      let amt = 1
      await utils.shouldChangeBalance(
        () => token.transfer(wallets.investor1, amt,
          { from: wallets.userLoalty }),
        {
          [token.address] : {
            [wallets.userLoalty] : -amt,
            [wallets.investor1]  : amt
          }
        }
      )
    })

    it('Partners can transfer', async () => {
      let amt = 1
      await utils.shouldChangeBalance(
        () => token.transfer(wallets.investor1, amt,
          { from: wallets.partners }),
        {
          [token.address] : {
            [wallets.partners] : -amt,
            [wallets.investor1]  : amt
          }
        }
      )
    })

    it('Team can not unfreeze', async () => {
      let amt = 1
      await utils.shouldFail(
        () => token.unfreezeTokens(wallets.team, 365*24*60*60, { from: wallets.team })
      )
    })

    it('Team can transfer', async () => {
      let amt = 1
      await utils.shouldFail(
        () => token.transfer(wallets.investor1, amt, { from: wallets.team })
      )
    })

    it('SafeSupport can transfer', async () => {
      let amt = 1
      await utils.shouldFail(
        () => token.transfer(wallets.investor1, amt, { from: wallets.safeSupport })
      )
    })

    it('Community can transfer', async () => {
      let amt = 1
      await utils.shouldFail(
        () => token.transfer(wallets.investor1, amt, { from: wallets.community })
      )
    })




    it('Closed sale can transfer', async () => {
      let amt = 1
      await utils.shouldChangeBalance(
        () => token.transfer(wallets.investor1, amt,
          { from: wallets.closedSale }),
        {
          [token.address] : {
            [wallets.closedSale] : -amt,
            [wallets.investor1]  : amt
          }
        }
      )
    })

    it('Investor can transfer', async () => {
      let amt = 1
      await utils.shouldChangeBalance(
        () => token.transfer(wallets.investor1, amt,
          { from: wallets.investor2 }),
        {
          [token.address] : {
            [wallets.investor2] : -amt,
            [wallets.investor1]  : amt
          }
        }
      )
    })

    it('Can not buy', async () => {
      await utils.shouldFail(async () => crowdsale.buyTokens(
        wallets.investor1, {
          from: wallets.investor1,
          value: constants.weiInEther
        })
      )
    })

    it('Can not buy with tokens', async () => {
      await utils.shouldFail(async () => crowdsale.buyTokensWithTokens(wallets.investor1, tokenA.address, 100, {
          from: wallets.investor1
        })
      )
    })

    it('Can not approve', async () => {
      await utils.shouldFail(async () => crowdsale.approve(wallets.investor1, 1, 999999, 0, 0))
    })

    it('Investor can unfreeze tokens', async () => {
      let amt = 3
      let freezeTime = 1

      await utils.advanceTimeAndBlock(freezeTime);

      await utils.shouldChangeBalance(
        () => crowdsale.unfreezeTokens(wallets.investor3, freezeTime),
        {
          [token.address] : {
            [wallets.investor3] : amt,
          }
        }
      )
    })

    it('Investor can not unfreeze twice', async () => {
      let amt = 2
      let freezeTime = 1

      await utils.shouldFail(async () => crowdsale.unfreezeTokens(wallets.investor3, freezeTime))
    })

    it('Investor can not unfreeze tokens before freeze time', async () => {
      let amt = 2
      let freezeTime = 10

      await utils.shouldFail(async () => crowdsale.unfreezeTokens(wallets.investor3, freezeTime))
    })

    it('Investor can unfreeze second frozen part after waiting appropriate time', async () => {
      let amt = 2
      let freezeTime = 10

      await utils.advanceTimeAndBlock(freezeTime);

      await utils.shouldChangeBalance(
        () => crowdsale.unfreezeTokens(wallets.investor3, freezeTime),
        {
          [token.address] : {
            [wallets.investor3] : amt,
          }
        }
      )
    })

    describe('12 months wait...', async () => {

      it('Team can transfer', async () => {
        // console.log(constants)

        await utils.advanceTimeAndBlock(365*24*60*60)


        await crowdsale.unfreezeTokens(wallets.team, 365*24*60*60)
        await crowdsale.unfreezeTokens(wallets.safeSupport, 365*24*60*60)
        await crowdsale.unfreezeTokens(wallets.community, 365*24*60*60)

        let amt = 1
        await utils.shouldChangeBalance(
          () => token.transfer(wallets.investor1, amt,
            { from: wallets.team }),
          {
            [token.address] : {
              [wallets.team] : -amt,
              [wallets.investor1]  : amt
            }
          }
        )
      })

      it('SafeSupport can transfer', async () => {
        let amt = 1
        await utils.shouldChangeBalance(
          () => token.transfer(wallets.investor1, amt,
            { from: wallets.safeSupport }),
          {
            [token.address] : {
              [wallets.safeSupport] : -amt,
              [wallets.investor1]  : amt
            }
          }
        )
      })

      it('Community can transfer', async () => {
        let amt = 1
        await utils.shouldChangeBalance(
          () => token.transfer(wallets.investor1, amt,
            { from: wallets.community }),
          {
            [token.address] : {
              [wallets.community] : -amt,
              [wallets.investor1]  : amt
            }
          }
        )
      })


    })

  })

})


















