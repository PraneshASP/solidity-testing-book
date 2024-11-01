# Fuzz tests

As mentioned in the previous section, unit, integration and fork tests are sufficient enough for most protocols to get a decent enough test suite that helps find most of the low hanging bugs. However, there are times when they might not catch every possible bug, especially in complex smart contracts that has functions that involve heavy math. 

While the basic tests can check the obvious scenarios, they might miss unexpected edge cases. What happens if someone inputs a number that's way larger than you anticipated? Or a negative number when only positives make sense?

This is where fuzz tests come in handy. Fuzz testing involves bombarding your functions with a wide range of random, unexpected inputs to see how they react. It's like throwing everything but the kitchen sink at your code to ensure it can handle anything that comes its way.

## Types:
There are 2 types of fuzzing. 
- Stateful
- Stateless

**Stateless** tests are the basic ones. They don't keep track of the state or the sequence of the calls, so they're fast. 

**Stateful** fuzzing are also called **invariant tests** as they make sure the defined invariant holds despite calling multiple methods in random sequence several times. We'll look into Invariant tests in the next chapter. Currently we focus on Stateless fuzz tests. 

![](../images/fuzz-tests.png)

## Example:

Let's look into a simple example to demonstrate how to setup fuzz tests using Foundry and how it can be beneficial in finding hidden bugs.

Consider the following simplified lending protocol implementation:

```solidity
contract SampleLending {
    uint256 public constant FEE_PERCENTAGE = 1000; // 10%
    address public feeReceiver;

    constructor(address _feeReceiver) {
        feeReceiver = _feeReceiver;
    }

    function calculateInterest(uint256 principal, uint256 rate, uint256 time) public pure returns (uint256 interest, uint256 fees) {
        interest = (rate * principal * time) / 10000 / 365 days;
        fees = (FEE_PERCENTAGE * interest) / 10000;
        interest -= fees;
    }

    function repay(address token, uint256 principal, uint256 rate, uint256 time) external {
        (uint256 interest, uint256 fees) = calculateInterest(principal, rate, time);
        IERC20(token).transferFrom(msg.sender, feeReceiver, fees);
    }
}

contract MockToken {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    function mint(address account, uint256 amount) external {
        _balances[account] += amount;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        require(amount > 0, "Cannot transfer zero tokens");
        require(_balances[sender] >= amount, "Insufficient balance");
        require(_allowances[sender][msg.sender] >= amount, "Insufficient allowance");

        _balances[sender] -= amount;
        _balances[recipient] += amount;
        _allowances[sender][msg.sender] -= amount;
        return true;
    }
 }
```

This contract calculates interest and fees for a loan and facilitates repayment. At first glance, it appears to be a straightforward implementation. Let's write some tests to validate the logic.

#### Unit Test:

Unit test for this function would be something like this:

```solidity
function testRepayment() public {
    uint256 principal = 1000 ether;
    uint256 rate = 1000; // 10% APR
    uint256 time = 30 days;

    (uint256 interest, uint256 fees) = protocol.calculateInterest(principal, rate, time);
    assertGt(fees, 0, "Fees should be greater than zero");

    vm.startPrank(address(this));
    token.mint(address(this), fees);
    token.approve(address(protocol), type(uint256).max);
    protocol.repay(address(token), principal, rate, time);
    vm.stopPrank();
}
```

This test passes successfully, giving us a false sense of security. It verifies that the contract works as expected for a specific, "happy path" scenario. 

#### Adding the fuzz test: 

Now, let's consider a fuzz test for the same contract:

```solidity
function testFuzz_Repayment(uint256 principal, uint256 rate, uint256 time) public {
    vm.assume(principal > 0 && principal <= 1e36); // Max 1 billion tokens with 18 decimals
    vm.assume(rate >= 10 && rate <= 100000); // 0.1% to 1000% APR
    vm.assume(time >= 100 && time <= 365 days);

    (uint256 interest, uint256 fees) = protocol.calculateInterest(principal, rate, time);
    
    vm.startPrank(address(this));
    token.mint(address(this), fees);
    token.approve(address(protocol), type(uint256).max);
    
    protocol.repay(address(token), principal, rate, time);
    vm.stopPrank();
}
```

This fuzz test generates random values for `principal`, `rate`, and `time` within reasonable bounds. By doing so, we can use a vast range of possible inputs, helping us identify edge cases.

Running the fuzz test reveals an important issue: the contract fails  when the calculated fees/interests are zero. 
The output would be something like this:
```
[FAIL. Reason: revert: Cannot transfer zero tokens; counterexample: calldata=0x92d09fa000000000000000000000000000000000000000000000000000000000000003b1000000000000000000000000000000000000000000000000000000000000028f0000000000000000000000000000000000000000000000000000000000001613 args=[945, 655, 5651]] testFuzz_Repayment(uint256,uint256,uint256) (runs: 0, μ: 0, ~: 0)
Logs:
  Principal: 945
  Rate: 655
  Time: 5651
  Fees: 0
  Interest: 0

```

This occurs because some ERC20 token implementations (similar to our `MockToken`) revert on zero-value transfers (like fee-on-transfer tokens), a behavior our contract doesn't account for.

The root of the problem lies in the `repay` function:

```solidity
function repay(address token, uint256 principal, uint256 rate, uint256 time) external {
    (uint256 interest, uint256 fees) = calculateInterest(principal, rate, time);
    IERC20(token).transferFrom(msg.sender, feeReceiver, fees);
}
```

This function unconditionally attempts to transfer fees, even when they amount to zero. While this works fine with many ERC20 implementations, it fails with tokens that explicitly disallow zero-value transfers.

####  Implementing the Fix

To resolve this issue, we need to add a check before attempting the fee transfer:

```solidity
function repay(address token, uint256 principal, uint256 rate, uint256 time) external {
    (uint256 interest, uint256 fees) = calculateInterest(principal, rate, time);
    if (fees > 0) {
        IERC20(token).transferFrom(msg.sender, feeReceiver, fees);
    }
}
```

This simple check ensures that we only attempt to transfer fees when they are non-zero, thereby avoiding potential reverts with certain ERC20 implementations.

### Tuning the fuzz tests (bounded tests):
You can notice the test uses multiple `vm.assume()` cheatcodes. It is a feature provided by foundry to constrain inputs to realistic ranges.
- Prevents overflow: By limiting `amount` to 1e36 (1 billion ETH), we avoid overflow in most cases. 
- Realistic scenarios: The bounds ensure we're testing with values that could occur in the real world. 
- Focused testing: We ensure we're testing the full range of relevant inputs, including edge cases. 
- Efficiency: Every test run uses meaningful inputs, making better use of the testing time.

When we don't properly tune inputs for fuzz testing, false positives become more likely, as tests might often fail due to unrelated issues like overflows rather than the actual bug we're looking for. Important bugs can be missed if edge cases, such as small values or unusual rates, aren't adequately covered. Also untuned fuzz tests often waste CPU resources on unrealistic scenarios, making the process inefficient.

In conclusion, tuning inputs in fuzz testing is crucial for:

1.  Ensuring realistic and meaningful test scenarios
2.  Efficiently covering the input space, including edge cases
3.  Avoiding false positives due to overflow or other irrelevant issues
4.  Making the best use of limited testing resources

By carefully constraining our inputs using `bound` or `assume`, we can create more effective fuzz tests that are better at catching subtle bugs while avoiding wasted cycles on unrealistic scenarios.

The above example illustrates the value of adding fuzz testing in the test suite. While the unit test gave us a false sense of security, the fuzz test uncovered a subtle yet important bug that was hiding in the plain sight.

> [!TIP]
>Key Takeaways :
>1. Uncovering edge cases: By exploring a wide range of inputs, fuzz tests can reveal issues that occur only under specific, often unexpected conditions.
>2. Improving code robustness: Addressing issues found by fuzz tests often leads to more resilient and flexible code.
>3. Complementing unit tests: While unit tests verify specific scenarios, fuzz tests provide a broader coverage of possible inputs and states.
>4. Tuning: The fuzz tests are more likely to catch the edge cases when the parameter ranges are tuned properly.

 As smart contract developers, we must embrace fuzz testing as an integral part of our testing strategy. It serves as a powerful tool to enhance the security and reliability of our contracts.
 

### Useful resources:
- [Exploiting precision loss using Fuzz testing](https://dacian.me/exploiting-precision-loss-via-fuzz-testing)
