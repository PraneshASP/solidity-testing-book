# Unit tests
Unit testing is the simplest form of testing. As the name suggests, each unit test should just test one thing at a time. It involves testing the smallest parts of your code – often individual functions – to ensure they work as expected.

![](../images/unit-tests.png)

#### Key Characteristics:
- **Isolation**: Should focus on a single functionality.
- **Speed**: Should run quickly to facilitate rapid iterations.
- **Independence**: Must not rely on external systems or states.

For example, let's implement unit tests for a simple SetterGetter contract. 

```solidity
contract SetterGetter {
    uint256 public number;

    function setNumber(uint256 newNumber) public {
        number = newNumber;
    }

    function getNumber() public view returns (uint256 _number) {
        _number = number;
    }
}
```

You can see that there are only 2 key methods available in the above contract.
- Setting value to the `number`.
- Retrieving the value stored. 


Unit testing the `setNumber()` method:

```solidity
  function test_setNumber() public {
        getterSetter.setNumber(10);
        assertEq(getterSetter.number(), 10);
    }
```
As mentioned earlier, the above function tests only one functionality: `setNumber()`. Note that in the assertion `getterSetter.number()` is used for validation and not `getterSetter.getNumber()`. Even though it doesn't make a big difference, we are avoiding the assumption that the user defined `getNumber()` method returns the actual value stored in the state `number`. Fewer assumptions help us implement more reliable tests!!


<br>

> 💡 **Random Tip:** 
> 
> Solidity compiler includes a getter method for all the public variables (for simple types like `uint`, `bytes32`, `address`, etc.). So if you need to reduce your contract's bytecode size, you can change the variables' scope to `internal` or `private` and expense only the required values via a getter. You can read more about this [here](https://docs.soliditylang.org/en/latest/contracts.html#getter-functions). 


So it's always a good practice to test the actual state change by reading it directly. By doing so, we are trusting the Solidity's auto-generated getter method rather than the user-defined one. When writing tests, the developer should think like an attacker to figure out what could go wrong with the given function. It's the most difficult part in writing tests: identifying edge cases. This is where some techniques like BTT comes into picture, which we'll cover as a separate chapter. 

> If possible, protocols should avoid asking the developer(s) responsible for developing the feature to test it.  

---

#### Do not over test!
When writing tests, it's easy to go beyond the boundaries and start over testing the functions. By over-testing, I mean, writing tests that adds very little to no value at all. Tests should be meaningful. 

One example would be to pass a value greater than what uint256 can hold and make sure it fails:
- Passing an invalid type as input (string, address, etc.) to make sure it fails.

```solidity
   function testFail_setNumber() public {
        cut.setNumber(type(uint256).max + 1);
    }
```

We already know that Solidity provides overflow protection by default. **The goal is to test the user logic, not the compiler**. Therefore, it's better to avoid these kinds of tests.

---

Okay, now let's get back to our `setNumber()` unit test:


```solidity
  function test_setNumber() public {
        getterSetter.setNumber(10);
        assertEq(getterSetter.number(), 10);
    }
```

Even though, this test works fine in our case, we're making another assumption here that the `setNumber()` actually updates the value. Consider the implementation of the `setNumber()` method as follows:

```solidity
uint256 public number = 10
function setNumber(uint256 value) public {}
```

The previous test works for this too. But is this a valid implementation? No. 

So what do we do about this?

Good question. In order to avoid such scenarios, we need to make sure that the state change actually happens. To test a state change, the best way is to validate the before and after value of the state. So the test would become something like:

```solidity
  function test_setNumber() public {
        uint256 numberBefore = getterSetter.number();
        getterSetter.setNumber(10);
        uint256 numberAfter = getterSetter.number();

        assertEq(numberBefore, 0);
        assertEq(numberAfter, 10);
    }
```

The scenario explained here is quite simple, but it could be more useful if you apply such testing techniques in real-world applications, for example, `transfer()` method of the `ERC20` spec, should reduce the sender's balance while increasing the recipient's balance. But most protocols don't make this explicit check in their `deposit()` method where token transfer takes place. They only check for the recipient's balance after transfer. The more robust check would be to check before and after balances of both the sender and the recipient to avoid the assumption that the underlying token actually follows the ERC20 spec and is not malicious. 


### Implementing test for `getNumber()` method:
For the getter method, the test would be straightforward. 

#### Simpler version (more assumptions):

```solidity
   function test_getNumber_Simple() public {
        getterSetter.setNumber(10);
        assertEq(getterSetter.getNumber(), 10);
    }
```

#### Robust version (less assumptions):

```solidity
    function test_getNumber_Robust() public {
        getterSetter.setNumber(322e26);
        assertEq(getterSetter.getNumber(), 322e26);
        assertEq(getterSetter.getNumber(), getterSetter.number());

        getterSetter.setNumber(0);
        assertEq(getterSetter.getNumber(), 0);
        assertEq(getterSetter.getNumber(), getterSetter.number());
    }
```

I'll leave it to the readers to examine how the latter test is quite stronger than the former. 

All the code snippets in this guide are available on the [GitHub]() for your reference. 

## Mocking:

In some cases, you might need to mock certain calls to unit test the functions. For ex, consider a deposit() function in which some ERC20 tokens are transferred to a Vault contract. Instead of deploying a mock erc20 contract and trying to perform an actual `transferFrom()` call, you can use `vm.mockCall()` cheatcode (from Foundry) and make the `transferFrom()` call to return `true` so that you can go ahead and test the actual logic ignoring the nuances of setting up a token contract. This facilitates the testing of the contract's logic in isolation, bypassing the complexities associated with setting up and interacting with other contracts. 


### `deposit()` method:

```solidity
function deposit(uint256 _amount) external {
        require(token.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        balances[msg.sender] += _amount;
    }
```

### Unit test:

```solidity
// Vault.t.sol
contract VaultTest is Test {
...
address tokenA = makeAddr("TokenA");
...

function test_deposit() external {
    vm.mockCall(address(tokenA), abi.encodeWithSelector(IERC20.transferFrom.selector), abi.encode(true));
    vault.deposit(10);
    assert(vault.balances(address(this))== 10);
  }
}
```

This approach enables focused testing on the contract in question, allowing for a more efficient and targeted validation of its logic and behavior. For comprehensive testing that involves the entire transaction flow and interaction between multiple contracts, [integration tests](./integration-tests.md) should be implemented.

---

## Boundary Testing

Boundary testing focuses on verifying behavior at the exact edges of valid and invalid input ranges. Smart contracts often enforce limits like rate limits, exchange rate caps, allowances and the most critical bugs tend to live right at those thresholds. Testing one unit above and one unit below a boundary gives you high confidence that the check is implemented correctly (using `>` vs `>=`, etc.) with minimal test overhead.

The general pattern is:
1. Call with `limit + 1` and assert the revert.
2. Call with exactly `limit` and assert success.

### Example: Rate Limit Boundary

```solidity
function test_depositERC4626_rateLimitBoundary() external {
    vm.startPrank(relayer);

    mainnetController.mintUSDS(5_000_000e18);

    vm.expectRevert("RateLimits/rate-limit-exceeded");
    mainnetController.depositERC4626(address(susds), 5_000_000e18 + 1);

    mainnetController.depositERC4626(address(susds), 5_000_000e18);

    vm.stopPrank();
}
```

Here, `5_000_000e18` is the configured rate limit. The test confirms that depositing one wei above the limit reverts, while depositing exactly at the limit succeeds. This catches off-by-one errors in the comparison operator used inside the rate-limit check.

### Example: Exchange Rate Boundary

```solidity
function test_depositERC4626_exchangeRateBoundary() external {
    vm.prank(relayer);
    mainnetController.mintUSDS(5_000_000e18);

    vm.startPrank(Ethereum.SPARK_PROXY);
    mainnetController.setMaxExchangeRate(address(susds), susds.convertToShares(5_000_000e18), 5_000_000e18 - 1);
    vm.stopPrank();

    vm.prank(relayer);
    vm.expectRevert("MC/exchange-rate-too-high");
    mainnetController.depositERC4626(address(susds), 5_000_000e18);

    vm.startPrank(Ethereum.SPARK_PROXY);
    mainnetController.setMaxExchangeRate(address(susds), susds.convertToShares(5_000_000e18), 5_000_000e18);
    vm.stopPrank();

    vm.prank(relayer);
    mainnetController.depositERC4626(address(susds), 5_000_000e18);
}
```

This test sets the max allowed assets to `5_000_000e18 - 1`, then attempts a deposit of `5_000_000e18` which should revert because the exchange rate check fails. It then raises the limit to exactly `5_000_000e18` and confirms the same deposit now succeeds.

Notice how both tests follow the same structure: fail at `boundary + 1` (or with a tighter limit), succeed at the exact boundary. This pattern is reusable across any threshold-based guard in your contracts.

> The above test snippets are taken from [spark-alm-controller `4626Calls.t.sol`](https://github.com/sparkdotfi/spark-alm-controller/blob/3dbc7cb01739e91dad61a75cda8d7c84b4474e0b/test/mainnet-fork/4626Calls.t.sol#L76) as suggested by Lucas from [Spark.fi](https://spark.fi).