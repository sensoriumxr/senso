pragma solidity 0.5.11;

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
 * Finalization is based on `FinalizableCrowdsale` with start/end excluded.
 */
contract SENSOCrowdsale is Ownable, ReentrancyGuard {

    using SafeMath for uint256;
    using SafeERC20 for SENSOToken;
    using SafeERC20 for IERC20;

    address private advisoryWallet;
    address private userLoyaltyWallet;
    address private partnersWallet;
    address private teamWallet;
    address private safeSupportWallet;
    address private communityWallet;

    uint256 public constant advisoryAmount =    188440000;
    uint256 public constant userLoyaltyAmount = 403800000;
    uint256 public constant partnersAmount =    323040000;
    uint256 public constant teamAmount =        188440000;
    uint256 public constant safeSupportAmount = 1265240000;
    uint256 public constant communityAmount =   323040000;

    // The token being sold
    SENSOToken private _token;

    // Address where funds are collected
    address payable private _wallet;

    // Amount of wei raised
    uint256 private _weiRaised;

    // Finalization time, 0 if not finalized
    uint256 private _finalizationTime;

    // Amount of tokens raised
    mapping (address => uint256) _tokenRaised;

    // Stores approvals per user for ether purchase
    mapping (address => Approval) public approvals;
    struct Approval {
        uint256 rate;
        uint256 bestBefore;
        uint256 limit;
        uint8 freezeShare;
        uint256 freezeTime;
    }

    // Stores approvals per user for token purchase
    // wallet => token => approval
    mapping (address => mapping (address => Approval)) public tokenApprovals;

    // Stores frozen funds
    // (beneficiary => (unfreezeTime => amount))
    mapping (address => mapping (uint256 => uint256)) public frozenTokens;

    // New approval
    event NewApproval(address indexed beneficiary, uint256 purchaseLimit);

    // New approval for purchasing with specified token
    event NewTokenApproval(address indexed beneficiary, uint256 purchaseLimit, address token);

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
     * Event that fires on token freeze (when someone buys tokens)
     * @param beneficiary who will receive tokens
     * @param frozenUntil earliest possible timestamp of token release
     * @param frozenAmount exact amount of tokens to be released
     */
    event TokensFrozen(address indexed beneficiary, uint256 frozenUntil, uint256 frozenAmount);

    /**
     * Event that fires on token unfreeze
     * @param beneficiary who will receive tokens
     * @param frozenUntil earliest possible timestamp of token release
     * @param frozenAmount exact amount of tokens to be released
     */
    event TokensUnfrozen(address indexed beneficiary, uint256 frozenUntil, uint256 frozenAmount);



    event CrowdsaleFinalized();

    /**
     * @dev The rate is the conversion between wei and the smallest and indivisible
     * token unit. So, if you are using a rate of 1 with a ERC20Detailed token
     * with 3 decimals called TOK, 1 wei will give you 1 unit, or 0.001 TOK.
     * @param wallet Address where collected funds will be forwarded to
     * @param closedSale Address of the closed sale wallet. Can transfer funds
     * even if the crowdsale is paused.
     */
    constructor (address payable wallet, address closedSale,
        address _advisoryWallet,
        address _userLoyaltyWallet,
        address _partnersWallet,
        address _teamWallet,
        address _safeSupportWallet,
        address _communityWallet

        ) public Ownable() {
        require(wallet            != address(0), "Crowdsale: wallet is the zero address");
        require(closedSale        != address(0), "Crowdsale: closed sale wallet is the zero address");

        require(_advisoryWallet    != address(0), "Crowdsale: advisory wallet is the zero address");
        require(_userLoyaltyWallet != address(0), "Crowdsale: userLoyalty wallet is the zero address");
        require(_partnersWallet    != address(0), "Crowdsale: partners wallet is the zero address");
        require(_teamWallet        != address(0), "Crowdsale: team wallet is the zero address");
        require(_safeSupportWallet != address(0), "Crowdsale: safeSupport wallet is the zero address");
        require(_communityWallet   != address(0), "Crowdsale: community wallet is the zero address");

        advisoryWallet = _advisoryWallet;
        userLoyaltyWallet = _userLoyaltyWallet;
        partnersWallet = _partnersWallet;
        teamWallet = _teamWallet;
        safeSupportWallet = _safeSupportWallet;
        communityWallet = _communityWallet;

        _token = new SENSOToken(closedSale, address(this));
        _wallet = wallet;
    }

    /**
     * @dev fallback function ***DO NOT OVERRIDE***
     * Note that other contracts will transfer funds with a base gas stipend
     * of 2300, which is not enough to call buyTokens. Consider calling
     * buyTokens directly when purchasing tokens from a contract.
     */
    function () external payable onlyNotFinalized {
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
     * @return the amount of tokens raised
     * @param tokenTraded address of token
     */
    function tokensRaised(address tokenTraded) public view returns (uint256) {
        return _tokenRaised[tokenTraded];
    }

    /**
     * @dev low level token purchase ***DO NOT OVERRIDE***
     * This function has a non-reentrancy guard, so it shouldn't be called by
     * another `nonReentrant` function.
     * @param beneficiary Recipient of the token purchase
     */
    function buyTokens(address beneficiary) public nonReentrant onlyNotFinalized payable {
        uint256 weiAmount = msg.value;
        (uint256 immediateTokensAmount, uint256 frozenTokensAmount, uint256 freezeTime) =
            _getTokenAmount(weiAmount, beneficiary);

        _preValidatePurchase(beneficiary, weiAmount,
            immediateTokensAmount.add(frozenTokensAmount));

        _weiRaised = _weiRaised.add(weiAmount);

        _deliverTokens(beneficiary, immediateTokensAmount, frozenTokensAmount);
        frozenTokens[beneficiary][freezeTime] = frozenTokens[beneficiary][freezeTime].add(frozenTokensAmount);

        emit TokensPurchased(msg.sender, beneficiary, weiAmount, immediateTokensAmount.add(frozenTokensAmount));
        emit TokensFrozen(beneficiary, freezeTime, frozenTokensAmount);

        delete approvals[beneficiary];

        _wallet.transfer(weiAmount);
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
    function _preValidatePurchase(address beneficiary, uint256 weiAmount, uint256 tokensPurchasedAmound) internal view {
        require(beneficiary != address(0), "Crowdsale: beneficiary is the zero address");
        require(weiAmount != 0, "Crowdsale: weiAmount is 0");
        require(tokensPurchasedAmound.add(_token.totalSupply()).add(_token.totalFrozenTokens()) <= _token.tokensaleAmount().add(_token.closedSaleAmount()));
        _isApproved(msg.sender);
    }

    /**
     * @dev Source of tokens. Override this method to modify the way in which the crowdsale ultimately gets and sends
     * its tokens.
     * @param beneficiary Address performing the token purchase
     * @param tokenAmount Number of tokens to be emitted
     */
    function _deliverTokens(address beneficiary, uint256 tokenAmount, uint256 frozenAmount) internal {
        _token.mint(beneficiary, tokenAmount, frozenAmount);
    }

    /**
     * @dev Override to extend the way in which ether is converted to tokens.
     * @param weiAmount Value in wei to be converted into tokens
     * @return Number of tokens that can be purchased with the specified _weiAmount
     */
    function _getTokenAmount(uint256 weiAmount, address beneficiary) internal view returns (uint256,uint256,uint256) {
        Approval memory approval = approvals[beneficiary];
        uint256 totalTokensAmount = weiAmount.mul(approval.rate).div(1e18);
        uint256 frozenTokensAmount = totalTokensAmount.mul(approval.freezeShare).div(100);
        uint256 immediateTokensAmount = totalTokensAmount.sub(frozenTokensAmount);
        require (totalTokensAmount <= approval.limit, 'SENSOCrowdsale: purchase exceeds approved limit');
        return (immediateTokensAmount, frozenTokensAmount, approval.freezeTime);
    }

    // Token purchase section

    /**
     * @dev purchasing tokens with tokens
     * This function has a non-reentrancy guard, so it shouldn't be called by
     * another `nonReentrant` function.
     * @param beneficiary Recipient of the token purchase
     */
    function buyTokensWithTokens(address beneficiary, IERC20 tradedToken,
        uint256 tokenAmountPaid) public nonReentrant onlyNotFinalized
    {
        (uint256 immediateTokensAmount, uint256  frozenTokensAmount, uint256  freezeTime) =
            _getTokenAmountWithTokens(tokenAmountPaid, beneficiary, address(tradedToken));
        _preValidatePurchase(beneficiary, address(tradedToken), tokenAmountPaid, immediateTokensAmount.add(frozenTokensAmount));

        _tokenRaised[address(tradedToken)] = _tokenRaised[address(tradedToken)].add(tokenAmountPaid);

        _deliverTokens(beneficiary, immediateTokensAmount, frozenTokensAmount);
        frozenTokens[beneficiary][freezeTime] = frozenTokens[beneficiary][freezeTime].add(frozenTokensAmount);

        emit TokensPurchasedWithTokens(msg.sender, beneficiary, tokenAmountPaid, immediateTokensAmount.add(frozenTokensAmount), tradedToken);
        emit TokensFrozen(beneficiary, freezeTime, frozenTokensAmount);

        delete tokenApprovals[beneficiary][address(tradedToken)];

        tradedToken.safeTransferFrom(beneficiary, _wallet, tokenAmountPaid);
    }

    function _preValidatePurchase(address beneficiary, address tradedToken, uint256 tokenAmount, uint256 tokensPurchasedAmound) internal view {
        require(beneficiary != address(0), "Crowdsale: beneficiary is the zero address");
        require(tradedToken != address(0), "Crowdsale: tradedToken is the zero address");
        require(tokenAmount != 0, "Crowdsale: tokenAmountPaid is 0");
        require(tokensPurchasedAmound.add(_token.totalSupply()).add(_token.totalFrozenTokens()) <= _token.tokensaleAmount().add(_token.closedSaleAmount()));
        _isTokenApproved(msg.sender, tradedToken);
    }

    function _getTokenAmountWithTokens(uint256 tokenAmount, address beneficiary, address tradedToken) internal view returns (uint256,uint256,uint256) {
        Approval memory approval = tokenApprovals[beneficiary][tradedToken];
        uint256 totalTokensAmount = tokenAmount.mul(approval.rate);
        uint256 frozenTokensAmount = totalTokensAmount.mul(approval.freezeShare).div(100);
        uint256 immediateTokensAmount = totalTokensAmount.sub(frozenTokensAmount);
        require (totalTokensAmount <= approval.limit, 'SENSOCrowdsale: purchase exceeds approved limit');
        return (immediateTokensAmount, frozenTokensAmount, approval.freezeTime);
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
    function approve (address beneficiary, uint256 rate, uint256 limit, uint8 freezeShare, uint256 freezeTime)
        public onlyOwner() onlyNotFinalized() returns (bool)
    {
        require (_isNotApproved(beneficiary), 'SENSOCrowdsale: Investor already have an approval');
        require (freezeShare < 101, 'SENSOCrowdsale: Freeze share exceeds 100%');
        require ((freezeShare == 0 && freezeTime == 0) || (freezeShare > 0 && freezeTime > 0), 'SENSOCrowdsale: freezeTime and freezeShare are either both set or 0');
        require (rate > 0, 'SENSOCrowdsale: rate can not be 0');
        require (limit > 0, 'SENSOCrowdsale: limit can not be 0');
        require (rate/1e18 <= limit, 'SENSOCrowdsale: rate cannot exceed limit');

        approvals[beneficiary] = Approval(rate, block.timestamp + 7 days, limit, freezeShare, freezeTime);
        emit NewApproval(beneficiary, limit);
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
    function tokenApprove (address beneficiary, address tradedToken, uint256 rate, uint256 limit, uint8 freezeShare, uint256 freezeTime)
        public onlyOwner() onlyNotFinalized() returns (bool)
    {
        require (_isNotTokenApproved(beneficiary, tradedToken), 'Investor already have an approval');
        require (freezeShare < 101, 'Freeze share exceeds 100%');
        require ((freezeShare == 0 && freezeTime == 0) || (freezeShare > 0 && freezeTime > 0), 'SENSOCrowdsale: freezeTime and freezeShare are either both set or 0');
        require (rate > 0, 'SENSOCrowdsale: rate can not be 0');
        require (limit > 0, 'SENSOCrowdsale: limit can not be 0');
        require (rate/1e18 <= limit, 'SENSOCrowdsale: rate cannot exceed limit');

        tokenApprovals[beneficiary][tradedToken] = Approval(rate, block.timestamp + 1 days, limit, freezeShare, freezeTime);
        emit NewTokenApproval(beneficiary, limit, tradedToken);
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


    // Finalization section

    /**
     * @return true if the crowdsale is finalized, false otherwise.
     */
    function finalized() public view returns (bool) {
        return _finalizationTime > 0;
    }

    /**
     * @return finalization time
     */
    function finalizationTime() public view returns (uint256) {
        return _finalizationTime;
    }

    /**
     * @dev Must be called after crowdsale ends, to do some extra finalization
     * work. Calls the contract's finalization function.
     */
    function finalize() onlyOwner onlyNotFinalized public {

        _finalizationTime = block.timestamp;
        _token.mint(_wallet, _token.tokensaleAmount()
            .add(_token.closedSaleAmount())
            .sub(_token.totalFrozenTokens())
            .sub(_token.totalSupply())
            , 0);

        _token.mint(advisoryWallet, advisoryAmount, 0);
        _token.mint(userLoyaltyWallet, userLoyaltyAmount, 0);
        _token.mint(partnersWallet, partnersAmount, 0);
        uint256 freezeTime = 365 days;

        frozenTokens[teamWallet][freezeTime]        = frozenTokens[teamWallet][freezeTime].add(teamAmount);
        frozenTokens[safeSupportWallet][freezeTime] = frozenTokens[safeSupportWallet][freezeTime].add(safeSupportAmount);
        frozenTokens[communityWallet][freezeTime]   = frozenTokens[communityWallet][freezeTime].add(communityAmount);
        emit TokensFrozen(teamWallet, freezeTime, teamAmount);
        emit TokensFrozen(safeSupportWallet, freezeTime, safeSupportAmount);
        emit TokensFrozen(communityWallet, freezeTime, communityAmount);

        _token.unpause();
        emit CrowdsaleFinalized();
    }

    modifier onlyNotFinalized() {
        require (_finalizationTime==0, "SENSOCrowdsale: is finalized");
        _;
    }

    modifier onlyFinalized() {
        require (_finalizationTime>0, "SENSOCrowdsale: is not finalized");
        _;
    }

    /**
     * @dev Releases frozen funds (actually mints new tokens). Can be called by
     * anyone. Can not be called before finalization.
     * @param beneficiary tokens will be released to this account
     * @param unfreezeTime earliest possible release time. Should match exactly the time specified in FundsFrozen event
     */

    function unfreezeTokens(address beneficiary, uint256 unfreezeTime) onlyFinalized public returns(bool) {
        uint256 frozenAmount = frozenTokens[beneficiary][unfreezeTime];

        require(frozenAmount > 0, 'SENSOCrowdsale: no matching approve for beneficiary');
        require(unfreezeTime.add(_finalizationTime) <= block.timestamp, 'SENSOCrowdsale: to early to unfreeze');

        _deliverTokens(beneficiary, frozenAmount, 0);
        delete frozenTokens[beneficiary][unfreezeTime];
        _token.unfreezeTokens(frozenAmount);
        emit TokensUnfrozen(beneficiary, unfreezeTime, frozenAmount);
        return true;
    }

}
