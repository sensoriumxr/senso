pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Capped.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Pausable.sol';

contract SENSOToken is ERC20Capped, ERC20Pausable {

    /**
     * @dev Emission constants, constraints:
     * tokenCapAmount = closedSaleAmount +
     *                  tokensaleAmount +
     *                  reserveAmount
     */

    uint256 private constant tokenCapAmount =   769200000;
    uint256 private constant closedSaleAmount = 200000000;
    uint256 private constant tokensaleAmount =  300000000;
    uint256 private constant reserveAmount =    269200000;


    /**
     * @dev Admins wallets, used to override pause limitations
     */

    address public closedSaleWallet;
    address public tokensaleWallet;

    constructor ( address _closedSaleWallet,
        address _tokenSaleWallet,
        address _reserveWallet
    ) public ERC20Capped(tokenCapAmount) ERC20Pausable() {
        closedSaleWallet = _closedSaleWallet;
        tokensaleWallet = _tokenSaleWallet;

        mint(_closedSaleWallet, closedSaleAmount);
        // mint(_tokenSaleWallet, tokensaleAmount);
        mint(_reserveWallet, reserveAmount);

        pause();
    }


    /**
     * @dev closedSaleWallet and tokensaleWallet can ignore pause
     */

    modifier whenNotPaused() {
        require(msg.sender == closedSaleWallet ||
            msg.sender == tokensaleWallet ||
            !paused(), "Pausable: paused");
        _;
    }

}