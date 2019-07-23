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

    // holds amount of total frozen tokens for cap checks
    uint256 private _totalFrozenTokens;

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

    function mint(address account, uint256 amount, uint256 frozenAmount) public onlyMinter returns (bool) {
        _mint(account, amount, frozenAmount);
        return true;
    }

    /**
     * @dev See `ERC20Mintable.mint`.
     *
     * Requirements:
     *
     * - `value` must not cause the total supply to go over the cap.
     * @param account wallet that will receive tokens
     * @param value amount of tokens to be minted
     * @param frozenValue number of tokens to be counted for freezing
     */
    function _mint(address account, uint256 value, uint256 frozenValue) internal {
        // case: minting `value` tokens taking into account that some amount will be frozen
        // if `frozenValue == 0`, this is unfreezing operation
        // we do not have to do this check again
        if (frozenValue != 0) {
            require(totalSupply().add(_totalFrozenTokens).add(value).add(frozenValue) <= cap(), "ERC20Capped: cap exceeded");
            _totalFrozenTokens += frozenValue;
        }
        super._mint(account, value);
    }


}