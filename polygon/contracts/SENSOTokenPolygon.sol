// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./ERC1363.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./metatx/EIP712MetaTransaction.sol";
import "./interfaces/IChildToken.sol";

contract Sensorium is
    ERC1363,
    Pausable,
    AccessControl,
    EIP712MetaTransaction,
    IChildToken
{
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    constructor(address childChainManager)
        ERC20("Sensorium", "SENSO")
        EIP712MetaTransaction("Sensorium", "1.0.0")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(DEPOSITOR_ROLE, childChainManager);
    }

    // This is to support Native meta transactions
    // never use msg.sender directly, use _msgSender() instead
    function _msgSender() internal view override returns (address) {
        return msgSender();
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }

    /**
     * @notice called when token is deposited on root chain
     * @dev Should be callable only by ChildChainManager
     * Should handle deposit by minting the required amount for user
     * Make sure minting is done only by this function
     * @param user user address for whom deposit is being done
     * @param depositData abi encoded amount
     */
    function deposit(address user, bytes calldata depositData)
        external
        override
        onlyRole(DEPOSITOR_ROLE)
    {
        uint256 amount = abi.decode(depositData, (uint256));
        _mint(user, amount);
    }

    /**
     * @notice called when user wants to withdraw tokens back to root chain
     * @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
     * @param amount amount of tokens to withdraw
     */
    function withdraw(uint256 amount) external {
        _burn(_msgSender(), amount);
    }

    // The following functions are overrides required by Solidity.

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1363, AccessControl)
        returns (bool)
    {
        return
            interfaceId == type(IChildToken).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
