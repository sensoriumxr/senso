# SENSO Crowdsale

## Сrowdsale lifecycle

### Deployment

One instance of SENSOCrowdsale smart contract should be deployed. Constructor have 8
parameters:
1. `address wallet` - wallet that collects all funds received during crowdsale
2. `address closedSale` - closed sale stage wallet,
200 000 000 SENSO tokens emitted
3. `address advisory` - advisory wallet,  188 440 000 SENSO tokens minted
4. `address userLoyalty` - userLoyalty wallet,  403 800 000 SENSO tokens minted
5. `address partners` - partners wallet,  323 040 000 SENSO tokens minted
6. `address team` - team wallet,  188 440 000 SENSO tokens minted, frozen for 365 days
7. `address safeSupport` - safeSupport wallet, 1 265 240 000 SENSO tokens minted, frozen for 365 days
8. `address community` - community wallet,  323 040 000 SENSO tokens minted, frozen for 365 days

Constructor parameters can be passed via `truffle migrate`, for example `truffle migrate --reset 0x17335d49cfd4e6cdd4330553854a6fb6ed3453e0,0x09fad4c16957f315184ea638633b6d89bab8dbb7,0x70a73ab08db1483d6443ca4856a3c4740813f6d5,0x4ea9bcc0243ca63151222b2abcd0db3855239101,0x367a4349686b4fe931f012033deede3c9df1257f,0x549445b59ac1adb45bd39bad65243f200ba9d79c,0xd0ea9c112c1349ad76febf9e38c8c043be178cff,0x8b1c6e8ab458a9cfe1d0ca6f199b16b327a20ff8`

The wallet that deployed SENSOCrowdsale is the SENSOCrowdsale admin.

Constructor SENSOCrowdsale deploys SENSOToken contract.

Funds that are frozen on `team`, `safeSupport`, `community` can be released with standard function `unfreezeTokens` (described below).

### Crowdsale stage

After publication SENSOToken contract is on pause. Token transfers are only possible for  `wallet` and `closedSale` wallets.

Crowdsale admin have access to `approve (address beneficiary, uint256 rate, uint256 limit, uint8 freezeShare, uint256 freezeTime)` and
`tokenApprove (address beneficiary, address tradedToken, uint256 rate, uint256 limit, uint8 freezeShare, uint256 freezeTime)`.
New SENSO tokens are emitted for investors as a result of purchas.

Collected funds are transferred to `wallet`. Amount of raised ETH and
tokens could be seen with `tokensRaised(address tokenTraded)` and `weiRaised()`.

#### `approve (address beneficiary, uint256 rate, uint256 limit, uint8 freezeShare, uint256 freezeTime)`

Allows single purchase of SENSO tokens with wallet `beneficiary` at price `rate` SENSO tokens for 1 ETH. Approval is valid for 1 week.

`freezeShare` and `freezeTime` controls freeze.
If both are 0 then there are no freeze. Investor immediately receives all tokens.

`freezeShare` is a share of purchased tokens (in percents) that will be frozen.
Meaninglful values are between 0 and 100.

`freezeTime` is the earliest possible time when funds can be released.

`limit` parameter set maximum number of SENSO tokens that can be purchased with this approval.

#### `tokenApprove (address beneficiary, address tradedToken, uint256 rate, uint256 limit, uint8 freezeShare, uint256 freezeTime)`

Allows single purchase of SENSO tokens with wallet `beneficiary` at price `rate` SENSO tokens for 1 `tradedToken`. Approval is valid for 1 day.

`tradedToken` should be ERC-20 compatible.

Before the purchase investor should `approve` (https://github.com/OpenZeppelin/openzeppelin-solidity/blob/84f85a410f09552a14a015ab63cb35c9a1b744d9/contracts/token/ERC20/IERC20.sol#L50).
It is recommended to use `increaseAllowance` (https://github.com/OpenZeppelin/openzeppelin-solidity/blob/84f85a410f09552a14a015ab63cb35c9a1b744d9/contracts/token/ERC20/ERC20.sol#L114).

`freezeShare` and `freezeTime` controls freeze.
If both are 0 then there are no freeze. Investor immediately receives all tokens.

`freezeShare` is a share of purchased tokens (in percents) that will be frozen.
Meaninglful values are between 0 and 100.

`freezeTime` is the earliest possible time when funds can be released.

`limit` parameter set maximum number of SENSO tokens that can be purchased with this approval.

### Finalization

Admin can stop crowdsale by calling `finalize`. After that, all wallets can transfer.
Also, method `unfreezeTokens` can be called.

During finalization, SENSO tokens emitted for wallets: `advisory`, `userLoyalty`, `partners`, `team`,
`safeSupport`, `community`


### `unfreezeTokens(address beneficiary, uint256 unfreezeTime)`

Releases frozen tokens. Can be called by anyone.

beneficiary - wallet that will receive released tokens
unfreezeTime - freeze time
