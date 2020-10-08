pragma solidity 0.5.11;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
contract Migrator is Ownable {
	using SafeERC20 for IERC20;
	function batchTransfer(IERC20 erc20, address[] memory addrs, uint[] memory values) public onlyOwner {
		require( addrs.length == values.length, "addrs and vals mismatch");
		for(uint i=0; i<addrs.length; i++ ) {
			erc20.safeTransferFrom(msg.sender, addrs[i], values[i]);
		}
	}
} 