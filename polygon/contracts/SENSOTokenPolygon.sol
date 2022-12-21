// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./ERC1363.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "./metatx/EIP712MetaTransaction.sol";
import "./interfaces/IChildToken.sol";
import "./SENSOTokenControl.sol";

contract Sensorium is
    ERC1363,
    ERC20Permit,
    SensoriumTokenControl,
    EIP712MetaTransaction,
    IChildToken
{
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    // ERC20Permit initializes EIP712 with (<name>, "1")
    constructor(address childChainManager)
        ERC20("Sensorium", "SENSO")
        ERC20Permit("Sensorium")
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

    // Overrides for pausing

    // ERC20
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }

    // ERC2612
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual override whenERC2612NotPaused {
        return super.permit(owner, spender, value, deadline, v, r, s);
    }

    // ERC1363
    function transferAndCall(
        address to,
        uint256 value,
        bytes memory data
    ) public override whenERC1363NotPaused returns (bool) {
        return super.transferAndCall(to, value, data);
    }

    function transferFromAndCall(
        address from,
        address to,
        uint256 value,
        bytes memory data
    ) public override whenERC1363NotPaused returns (bool) {
        return super.transferFromAndCall(from, to, value, data);
    }

    function approveAndCall(
        address spender,
        uint256 value,
        bytes memory data
    ) public override whenERC1363NotPaused returns (bool) {
        return super.approveAndCall(spender, value, data);
    }

    // End of overrides for pausing

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
            interfaceId == type(IERC20Permit).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
