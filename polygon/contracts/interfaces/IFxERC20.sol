// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

interface IFxERC20 is IERC20 {
    function fxManager() external returns (address);

    function connectedToken() external returns (address);

    // Different signature from Polygon's version
    function initialize(address _connectedToken) external;

    function mint(address user, uint256 amount) external;

    function burn(address user, uint256 amount) external;
}
