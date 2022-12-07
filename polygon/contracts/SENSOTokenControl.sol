// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./ERC1363.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract SensoriumTokenControl is Pausable, AccessControl {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // Pause whole contract
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // Separate ERC1363

    /**
     * @dev Emitted when the ERC1363 pause is triggered by `account`.
     */
    event ERC1363Paused(address account);

    /**
     * @dev Emitted when the ERC1363 pause is lifted by `account`.
     */
    event ERC1363Unpaused(address account);

    bool private _erc1363Paused;

    /**
     * @dev Modifier to make a function callable only when the ERC1363 implementation is not paused.
     *
     * Requirements:
     *
     * - The ERC1363 implementation must not be paused.
     */
    modifier whenERC1363NotPaused() {
        _requireERC1363NotPaused();
        _;
    }

    /**
     * @dev Returns true if ERC1363 implementation is paused, and false otherwise.
     */
    function erc1363Paused() public view virtual returns (bool) {
        return _erc1363Paused;
    }

    /**
     * @dev Throws if the contract is paused.
     */
    function _requireERC1363NotPaused() internal view virtual {
        require(!erc1363Paused(), "Pausable: ERC1363 paused");
    }

    function pauseERC1363() public onlyRole(PAUSER_ROLE) {
        _erc1363Paused = true;
        emit ERC1363Paused(_msgSender());
    }

    function unpauseERC1363() public onlyRole(PAUSER_ROLE) {
        _erc1363Paused = false;
        emit ERC1363Unpaused(_msgSender());
    }

    // Separate ERC2612

    /**
     * @dev Emitted when the ERC2612 pause is triggered by `account`.
     */
    event ERC2612Paused(address account);

    /**
     * @dev Emitted when the ERC2612 pause is lifted by `account`.
     */
    event ERC2612Unpaused(address account);

    bool private _erc2612Paused;

    /**
     * @dev Modifier to make a function callable only when the ERC2612 implementation is not paused.
     *
     * Requirements:
     *
     * - The ERC2612 implementation must not be paused.
     */
    modifier whenERC2612NotPaused() {
        _requireERC2612NotPaused();
        _;
    }

    /**
     * @dev Returns true if ERC2612 implementation is paused, and false otherwise.
     */
    function erc2612Paused() public view virtual returns (bool) {
        return _erc2612Paused;
    }

    /**
     * @dev Throws if the contract is paused.
     */
    function _requireERC2612NotPaused() internal view virtual {
        require(!erc2612Paused(), "Pausable: ERC2612 paused");
    }

    function pauseERC2612() public onlyRole(PAUSER_ROLE) {
        _erc2612Paused = true;
        emit ERC2612Paused(_msgSender());
    }

    function unpauseERC2612() public onlyRole(PAUSER_ROLE) {
        _erc2612Paused = false;
        emit ERC2612Unpaused(_msgSender());
    }
}
