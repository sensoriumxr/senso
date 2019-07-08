pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";

import "./SENSOToken.sol";

/**
 * @title SENSOCrowdsale
 * @dev SENSOCrowdsale is an extensively revamped contract based on
 * openzeppelin-solidity/contracts/crowdsale/Crowdsale.sol. Rate and approval
 * is stored per user.
 */
contract SENSOCrowdsale is Ownable, ReentrancyGuard {

    using SafeMath for uint256;
    using SafeERC20 for SENSOToken;
    using SafeERC20 for IERC20;

    // The token being sold
    SENSOToken private _token;

    // Address where funds are collected
    address payable private _wallet;

    // Amount of wei raised
    uint256 private _weiRaised;

    // Stores approvals per user for ether purchase
    mapping (address => Approval) public approvals;
    struct Approval {
        uint256 rate;
        uint256 bestBefore;
    }

    // Stores approvals per user for token purchase
    // wallet => token => approval
    mapping (address => mapping (address => Approval)) public tokenApprovals;

    /**
     * Event for token purchase logging
     * @param purchaser who paid for the tokens
     * @param beneficiary who got the tokens
     * @param value weis paid for purchase
     * @param amount amount of tokens purchased
     */
    event TokensPurchased(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);

    /**
     * Event for token purchase logging when bought with another tokens
     * @param purchaser who paid for the tokens
     * @param beneficiary who got the tokens
     * @param value amount of tokens paid
     * @param amount amount of tokens purchased
     * @param otherToken address of token used for purchase
     */
    event TokensPurchasedWithTokens(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount, IERC20 otherToken);

    /**
     * @dev The rate is the conversion between wei and the smallest and indivisible
     * token unit. So, if you are using a rate of 1 with a ERC20Detailed token
     * with 3 decimals called TOK, 1 wei will give you 1 unit, or 0.001 TOK.
     * @param wallet Address where collected funds will be forwarded to
     * @param closedSale Address of the closed sale wallet. Can transfer funds
     * even if the crowdsale is paused.
     * @param reserve Address of the reseve wallet.
     */
    constructor (address payable wallet, address closedSale, address reserve) public Ownable() {
        require(wallet != address(0), "Crowdsale: wallet is the zero address");
        require(closedSale != address(0), "Crowdsale: closed sale wallet is the zero address");
        require(reserve != address(0), "Crowdsale: reserver wallet is the zero address");

        _token = new SENSOToken(closedSale, address(this), reserve);
        _wallet = wallet;
    }

    /**
     * @dev fallback function ***DO NOT OVERRIDE***
     * Note that other contracts will transfer funds with a base gas stipend
     * of 2300, which is not enough to call buyTokens. Consider calling
     * buyTokens directly when purchasing tokens from a contract.
     */
    function () external payable {
        buyTokens(msg.sender);
    }

    /**
     * @return the token being sold.
     */
    function token() public view returns (SENSOToken) {
        return _token;
    }

    /**
     * @return the address where funds are collected.
     */
    function wallet() public view returns (address payable) {
        return _wallet;
    }

    /**
     * @return the amount of wei raised.
     */
    function weiRaised() public view returns (uint256) {
        return _weiRaised;
    }

    /**
     * @dev low level token purchase ***DO NOT OVERRIDE***
     * This function has a non-reentrancy guard, so it shouldn't be called by
     * another `nonReentrant` function.
     * @param beneficiary Recipient of the token purchase
     */
    function buyTokens(address beneficiary) public nonReentrant payable {
        uint256 weiAmount = msg.value;
        _preValidatePurchase(beneficiary, weiAmount);

        uint256 tokens = _getTokenAmount(weiAmount, beneficiary);

        _weiRaised = _weiRaised.add(weiAmount);

        _deliverTokens(beneficiary, tokens);
        emit TokensPurchased(msg.sender, beneficiary, weiAmount, tokens);

        delete approvals[beneficiary];

        _wallet.transfer(msg.value);
    }

    /**
     * @dev Validation of an incoming purchase. Use require statements to revert state when conditions are not met.
     * Use `super` in contracts that inherit from Crowdsale to extend their validations.
     * Example from CappedCrowdsale.sol's _preValidatePurchase method:
     *     super._preValidatePurchase(beneficiary, weiAmount);
     *     require(weiRaised().add(weiAmount) <= cap);
     * @param beneficiary Address performing the token purchase
     * @param weiAmount Value in wei involved in the purchase
     */
    function _preValidatePurchase(address beneficiary, uint256 weiAmount) internal view {
        require(beneficiary != address(0), "Crowdsale: beneficiary is the zero address");
        require(weiAmount != 0, "Crowdsale: weiAmount is 0");
        _isApproved(msg.sender);
    }

    /**
     * @dev Source of tokens. Override this method to modify the way in which the crowdsale ultimately gets and sends
     * its tokens.
     * @param beneficiary Address performing the token purchase
     * @param tokenAmount Number of tokens to be emitted
     */
    function _deliverTokens(address beneficiary, uint256 tokenAmount) internal {
        _token.mint(beneficiary, tokenAmount);
    }

    /**
     * @dev Override to extend the way in which ether is converted to tokens.
     * @param weiAmount Value in wei to be converted into tokens
     * @return Number of tokens that can be purchased with the specified _weiAmount
     */
    function _getTokenAmount(uint256 weiAmount, address beneficiary) internal view returns (uint256) {
        return weiAmount.mul(approvals[beneficiary].rate).div(1e18);
    }


    // Token purchase section

    /**
     * @dev purchasing tokens with tokens
     * This function has a non-reentrancy guard, so it shouldn't be called by
     * another `nonReentrant` function.
     * @param beneficiary Recipient of the token purchase
     */
    function buyTokensWithTokens(address beneficiary, IERC20 tradedToken, uint256 tokenAmountPaid) public nonReentrant {
        _preValidatePurchase(beneficiary, address(tradedToken), tokenAmountPaid);

        uint256 tokenAmountReceived = _getTokenAmountWithTokens(tokenAmountPaid, beneficiary, address(tradedToken));

        _deliverTokens(beneficiary, tokenAmountReceived);
        emit TokensPurchasedWithTokens(msg.sender, beneficiary, tokenAmountPaid, tokenAmountReceived, tradedToken);

        delete tokenApprovals[beneficiary][address(tradedToken)];

        tradedToken.safeTransferFrom(beneficiary, _wallet, tokenAmountPaid);
    }

    function _preValidatePurchase(address beneficiary, address tradedToken, uint256 tokenAmount) internal view {
        require(beneficiary != address(0), "Crowdsale: beneficiary is the zero address");
        require(tradedToken != address(0), "Crowdsale: tradedToken is the zero address");
        require(tokenAmount != 0, "Crowdsale: tokenAmountPaid is 0");
        _isTokenApproved(msg.sender, tradedToken);
    }

    function _getTokenAmountWithTokens(uint256 tokenAmount, address beneficiary, address tradedToken) internal view returns (uint256) {
        return tokenAmount.mul(tokenApprovals[beneficiary][tradedToken].rate);
    }



    // approvals section start //

    /**
     * @return conversion rate for investor. Throws if there is no approval.
     */
    function getApprovalRate (address beneficiary)
        public view returns (uint256)
    {
        Approval memory approval = _isApproved(beneficiary);
        return approval.rate;
    }

    /**
     * @return expiration date for approval. Throws if there is no approval.
     */
    function getApprovalBestBefore (address beneficiary)
        public view returns (uint256)
    {
        Approval memory approval = _isApproved(beneficiary);
        return approval.bestBefore;
    }

    /**
     * @dev Approves `beneficiary` with `rate`.
     */
    function approve (address beneficiary, uint256 rate)
        public onlyOwner() returns (bool)
    {
        require (_isNotApproved(beneficiary), 'Investor already have an approval');
        approvals[beneficiary] = Approval(rate, block.timestamp + 7 days);
        return true;
    }

    /**
     * @return valid approval if there is one, throws otherwise.
     */
    function _isApproved (address beneficiary)
        internal view returns(Approval memory approval)
    {
        approval = approvals[beneficiary];
        require(approval.bestBefore >= block.timestamp, 'No valid approval');
    }

    /**
     * @return true if there is no valid approval.
     */
    function _isNotApproved (address beneficiary) internal view returns(bool) {
        Approval memory approval = approvals[beneficiary];
        return (approval.bestBefore < block.timestamp);
    }

    /**
     * @return conversion rate for investor. Throws if there is no approval.
     */
    function getTokenApprovalRate (address beneficiary, address tradedToken)
        public view returns (uint256)
    {
        Approval memory approval = _isTokenApproved(beneficiary, tradedToken);
        return approval.rate;
    }

    /**
     * @return expiration date for approval. Throws if there is no approval.
     */
    function getTokenApprovalBestBefore (address beneficiary, address tradedToken)
        public view returns (uint256)
    {
        Approval memory approval = _isTokenApproved(beneficiary, tradedToken);
        return approval.bestBefore;
    }

    /**
     * @dev Approves `beneficiary` with `rate`.
     */
    function tokenApprove (address beneficiary, address tradedToken, uint256 rate)
        public onlyOwner() returns (bool)
    {
        require (_isNotTokenApproved(beneficiary, tradedToken), 'Investor already have an approval');
        tokenApprovals[beneficiary][tradedToken] = Approval(rate, block.timestamp + 7 days);
        return true;
    }

    /**
     * @return valid approval if there is one, throws otherwise.
     */
    function _isTokenApproved (address beneficiary, address tradedToken)
        internal view returns(Approval memory approval)
    {
        approval = tokenApprovals[beneficiary][tradedToken];
        require(approval.bestBefore >= block.timestamp, 'No valid approval');
    }

    /**
     * @return true if there is no valid approval.
     */
    function _isNotTokenApproved (address beneficiary, address tradedToken) internal view returns(bool) {
        Approval memory approval = tokenApprovals[beneficiary][tradedToken];
        return (approval.bestBefore < block.timestamp);
    }

    // approvals section end //

}
