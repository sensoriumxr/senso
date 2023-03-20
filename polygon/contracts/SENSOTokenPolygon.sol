// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./ERC1363.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "./interfaces/IFxERC20.sol";
import "./metatx/EIP712MetaTransaction.sol";
import "./SENSOTokenControl.sol";

contract Sensorium is
    ERC1363,
    ERC20Permit,
    SensoriumTokenControl,
    EIP712MetaTransaction,
    IFxERC20
{
    address internal _fxManager;
    address internal _connectedToken;

    // ERC20Permit initializes EIP712 with (<name>, "1")
    constructor() ERC20("Sensorium", "SENSO") ERC20Permit("Sensorium") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
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

    // IFxERC20

    function setFxManager(
        address fxManager_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _fxManager = fxManager_;
    }

    // fxManager returns fx manager
    function fxManager() public view override returns (address) {
        return _fxManager;
    }

    // connectedToken returns root token
    function connectedToken() public view override returns (address) {
        return _connectedToken;
    }

    function initialize(address connectedToken_) external override {
        require(msg.sender == _fxManager, "Invalid sender");
        _connectedToken = connectedToken_;
    }

    function mint(address user, uint256 amount) public override {
        require(msg.sender == _fxManager, "Invalid sender");
        _mint(user, amount);
    }

    function burn(address user, uint256 amount) public override {
        require(msg.sender == _fxManager, "Invalid sender");
        _burn(user, amount);
    }

    // End of IFxERC20

    // The following functions are overrides required by Solidity.

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1363, AccessControl) returns (bool) {
        return
            interfaceId == type(IFxERC20).interfaceId ||
            interfaceId == type(IERC20Permit).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
