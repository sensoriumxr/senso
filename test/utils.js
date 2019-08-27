// advance time and block
// source https://medium.com/edgefund/time-travelling-truffle-tests-f581c1964687

advanceTimeAndBlock = async (time) => {
    await advanceTime(time);
    await advanceBlock();

    return Promise.resolve(web3.eth.getBlock('latest'));
}

advanceTime = (time) => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [time],
            id: new Date().getTime()
        }, (err, result) => {
            if (err) { return reject(err); }
            return resolve(result);
        });
    });
}

advanceBlock = () => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_mine",
            id: new Date().getTime()
        }, (err, result) => {
            if (err) { return reject(err); }
            const newBlockHash = web3.eth.getBlock('latest').hash;

            return resolve(newBlockHash)
        });
    });
}

// end of advance time and block

function assertDeltas(before, after, delta) {
  let k1 = Object.keys(before)
  for (var i=0; i<k1.length; i++) {
    let k2 = Object.keys(before[k1[i]])
    for (var j=0; j<k2.length; j++) {
      if (k1[i].toLowerCase() === 'eth') {
        assert.closeTo(after[k1[i]][k2[j]] - before[k1[i]][k2[j]], delta[k1[i]][k2[j]], 2000000000000000) // ignoring ~tx cost
      } else {
        assert.equal(after[k1[i]][k2[j]] - before[k1[i]][k2[j]], delta[k1[i]][k2[j]])
      }
    }
  }
}

async function deltaBalances(delta) {
  res = {}
  let k1 = Object.keys(delta)
  for (var i=0; i<k1.length; i++) {
    let k2 = Object.keys(delta[k1[i]])
    if (!res[k1[i]]) {
      res[k1[i]] = {}
    }
    var fBalance = (x) => -0.1
    if (k1[i].toLowerCase() === 'eth') {
      fBalance = async (x) => web3.eth.getBalance(x)
    } else {
      fBalance = async (x) => {
        let abi = k1[i] === token.address ? token.abi : tokenA.abi
        let c = new web3.eth.Contract(abi, k1[i])
        return await c.methods.balanceOf(x).call()
      }
    }
    for (var j=0; j<k2.length; j++) {
      res[k1[i]][k2[j]] = await fBalance(k2[j])
      // console.log(k1[i], k2[j], res[k1[i]][k2[j]])
    }
  }
  return res
}

async function shouldChangeBalance (f, deltas) {
  before = await  deltaBalances(deltas)
  await f()
  after = await  deltaBalances(deltas)
  assertDeltas(before, after, deltas)
}



async function shouldFail (f) {
  let err = null
  try {
    let b = await f()
  } catch(error) {
    err = error
  }
  assert.ok(err instanceof Error)
}

module.exports = {
    shouldFail: shouldFail,
    shouldChangeBalance: shouldChangeBalance,
    advanceTimeAndBlock: advanceTimeAndBlock
}