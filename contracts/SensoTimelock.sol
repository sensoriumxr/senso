pragma solidity 0.5.11;

import 'openzeppelin-solidity/contracts/token/ERC20/TokenTimelock.sol';

contract SensoTimelock is TokenTimelock {
    constructor (IERC20 token, address beneficiary, uint256 releaseTime) 
        public TokenTimelock(token, beneficiary, releaseTime) {    
    }
}