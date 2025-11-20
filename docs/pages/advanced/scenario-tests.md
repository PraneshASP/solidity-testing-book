# Scenario Tests

In our previous chapter, we explored lifecycle testing which examines a contract's behavior from start to finish. Now, let's dive into scenario testing, a closely-related but slightly-distinct approach that allows us to validate specific situations and edge cases that might occur during a contract's operation.

## Wut?

Scenario testing is a testing methodology that focuses on validating how a smart contract behaves in specific situations or "scenarios" that could occur during its operation. Unlike lifecycle tests that follow a linear path from deployment to completion, scenario tests explore different branches of possibility – think of them as "what if" situations that your contract might encounter.

To understand the difference, consider this analogy: If a lifecycle test is like following a character's journey from beginning to end in a book, scenario testing is like exploring all the different paths that character could have taken at each decision point. Each scenario represents a different "story" that could unfold based on different conditions and user actions. 

> As always its essential that you find that 95% of the bugs in your code with as much testing methods as you can so that you can leave that hidden 5% of the bugs for the auditors.

### Why Scenario Testing Matters

As you know, smart contracts often operate in environments where multiple users or other contracts can interact with them in various ways, market conditions can change rapidly, and different combinations of events can occur. Scenario testing helps us:

1. Validate contract behavior in specific situations that might be rare but critical
2. Ensure the contract handles edge cases correctly
3. Verify that different combinations of actions produce expected results
4. Test complex interactions between multiple users or contracts that are not possible in other forms of testing

Let's explore this with our lending contract example from the previous chapter, but this time we'll create multiple scenarios that could occur during its operation.

## Example: Lending Contract

Building on our previous lending contract, let's create scenario tests that explore different situations it might encounter:

```solidity
contract LendingScenarioTest is Test {
    LendingWithLiquidation public lending;
    MockERC20 public token;
    address public user1;
    address public user2;
    address public liquidator;

    function setUp() public {
        token = new MockERC20("Mock Token", "MTK");
        lending = new LendingWithLiquidation(address(token));
        user1 = address(0x1);
        user2 = address(0x2);
        liquidator = address(0x3);
        
        // Initial setup for all users
        token.mint(user1, 1000 ether);
        token.mint(user2, 1000 ether);
        token.mint(liquidator, 1000 ether);
    }

    function test_Scenario_MultipleUsersCompetingForLiquidity() public {
        // Scenario: Two users deposit and try to borrow when there's limited liquidity
        
        // User1 deposits
        vm.startPrank(user1);
        token.approve(address(lending), 500 ether);
        lending.deposit(500 ether);
        vm.stopPrank();

        // User2 deposits
        vm.startPrank(user2);
        token.approve(address(lending), 300 ether);
        lending.deposit(300 ether);
        vm.stopPrank();

        // User1 borrows first
        vm.prank(user1);
        lending.borrow(400 ether);

        // User2 attempts to borrow
        vm.startPrank(user2);
        lending.borrow(240 ether);  // Should succeed (80% of 300)
        
        // Try to borrow more - should fail
        vm.expectRevert("Exceeds borrow limit");
        lending.borrow(1 ether);
        vm.stopPrank();

        assertEq(lending.borrows(user1), 400 ether);
        assertEq(lending.borrows(user2), 240 ether);
    }

    function test_Scenario_CascadingLiquidations() public {
        // Scenario: Multiple positions become liquidatable due to rapid price decline
        
        // Setup initial positions
        vm.startPrank(user1);
        token.approve(address(lending), 500 ether);
        lending.deposit(500 ether);
        lending.borrow(350 ether);  // 70% utilization
        vm.stopPrank();

        vm.startPrank(user2);
        token.approve(address(lending), 300 ether);
        lending.deposit(300 ether);
        lending.borrow(210 ether);  // 70% utilization
        vm.stopPrank();

        // Simulate market crash
        lending.setPrice(0.7 ether);  // 30% price drop

        // Liquidator starts liquidating positions
        vm.startPrank(liquidator);
        token.approve(address(lending), 1000 ether);
        
        uint256 liquidatorInitialBalance = token.balanceOf(liquidator);
        
        lending.liquidate(user1, 100 ether);
        lending.liquidate(user2, 60 ether);
        vm.stopPrank();

        // Verify liquidations
        assertLt(lending.borrows(user1), 350 ether);
        assertLt(lending.borrows(user2), 210 ether);
        assertGt(token.balanceOf(liquidator), liquidatorInitialBalance);
    }

    function test_Scenario_RepayDuringLiquidation() public {
        // Scenario: User attempts to repay while being liquidated
        
        // Setup user's position
        vm.startPrank(user1);
        token.approve(address(lending), 1000 ether);
        lending.deposit(1000 ether);
        lending.borrow(700 ether);  // 70% utilization
        vm.stopPrank();

        // Make position liquidatable
        lending.setPrice(0.75 ether);

        // Start liquidation
        vm.startPrank(liquidator);
        token.approve(address(lending), 300 ether);
        lending.liquidate(user1, 300 ether);
        vm.stopPrank();

        // User attempts to repay during liquidation
        vm.startPrank(user1);
        token.approve(address(lending), 200 ether);
        lending.repay(200 ether);
        vm.stopPrank();

        // Verify final state
        uint256 finalBorrow = lending.borrows(user1);
        assertLt(finalBorrow, 700 ether);
        assertGt(finalBorrow, 0);
    }

    function test_Scenario_MarketRecovery() public {
        // Scenario: Price recovers after partial liquidation
        
        // Setup initial position
        vm.startPrank(user1);
        token.approve(address(lending), 1000 ether);
        lending.deposit(1000 ether);
        lending.borrow(700 ether);
        vm.stopPrank();

        // Price drops and liquidation occurs
        lending.setPrice(0.75 ether);
        
        vm.startPrank(liquidator);
        token.approve(address(lending), 200 ether);
        lending.liquidate(user1, 200 ether);
        vm.stopPrank();

        // Price recovers
        lending.setPrice(1 ether);

        // User should be able to borrow again
        vm.startPrank(user1);
        uint256 borrowBefore = lending.borrows(user1);
        lending.borrow(100 ether);
        assertEq(lending.borrows(user1), borrowBefore + 100 ether);
        vm.stopPrank();
    }
}
```

In this example, we've created several scenario tests that explore different situations:

1. Multiple users competing for limited liquidity
2. Cascading liquidations during a market crash
3. User attempting to repay while being liquidated
4. Market recovery after partial liquidation

Each scenario focuses on a specific situation that could occur in the real world, testing how the contract handles these complex interactions.

## Best Practices for Scenario Testing

### 1. Identify Critical Scenarios

Think about situations that could stress your system:
- Multiple users interacting simultaneously
- Edge cases in market conditions
- Resource competition
- Emergency situations
- Recovery scenarios

### 2. Document Scenarios Clearly

Tests are the living documentation for your code. It's crucial to maintain them with clear documentation. There's nothing wrong in over-commenting, so don't be shy. 

Below is an example from `maple-core-v2` scenario tests.

```solidity

// Although the values here don't revert, if they were a bit higher, they would in the `getNextPaymentBreakdown` function.
// Currently, the way out of the situation would be to either:
// 1. Refinance using a custom fixedTermRefinancer that can manually alter the storage of the interest rate.
// 2. Close the loan, paying only the closing interest.

close(loan1);

// TotalAssets went down due to the loan closure.
assertEq(poolManager.totalAssets(), 4_000_000e6 + 90_000e6);  // 1% of 1_000_000e6, removing management fees

// Loan Manager should be in a coherent state
assertFixedTermLoanManager({
    loanManager:       loanManager,
    accruedInterest:   0,
    accountedInterest: 0,
    principalOut:      0,
    issuanceRate:      0,
    domainStart:       start + 800_000,
    domainEnd:         start + 800_000,
    unrealizedLosses:  0
});
```

### 3. Validate State Transitions

```solidity
// Create helper functions to verify system state
function verifyUserPosition(
    address user,
    uint256 expectedDeposit,
    uint256 expectedBorrow
) internal {
    assertEq(lending.deposits(user), expectedDeposit);
    assertEq(lending.borrows(user), expectedBorrow);
    // Add other relevant checks
}
```

## Common Pitfalls to Avoid

1. **Isolated Scenarios**: Don't test scenarios in isolation when they might interact in reality

```solidity
// WRONG: Testing liquidations without considering market conditions
function test_Scenario_Liquidation() public {
    // Direct liquidation setup without market context
}

// RIGHT: Include market context
function test_Scenario_LiquidationInVolatileMarket() public {
    // Setup market conditions
    // Simulate price volatility
    // Then test liquidation
}
```

2. **Oversimplified Scenarios**: Ensure scenarios reflect real-world complexity

```solidity
// WRONG: Oversimplified market crash scenario
lending.setPrice(0 ether);  // Unrealistic

// RIGHT: Realistic market movement
lending.setPrice(0.8 ether);  // 20% drop
// Test system behavior
lending.setPrice(0.6 ether);  // Further 20% drop
// Test system behavior again
```

3. **Missing State Verification**: Always verify the complete state after scenario execution

```solidity
// WRONG: Partial verification
function test_Scenario() public {
    // Execute scenario
    assertEq(lending.borrows(user), expectedBorrow);
}

// RIGHT: Complete verification
function test_Scenario() public {
    // Execute scenario
    verifySystemState({
        userBorrow: expectedBorrow,
        totalBorrows: expectedTotalBorrows,
        userDeposit: expectedDeposit,
        totalDeposits: expectedTotalDeposits
    });
}
```

## Conclusion

Scenario testing complements lifecycle testing by exploring specific situations and edge cases that might occur during a contract's operation. While lifecycle tests give us confidence in the overall flow of our contract, scenario tests help us understand how it behaves in specific situations.

Remember that good scenario tests:
- Are based on realistic situations
- Test complex interactions between multiple components
- Verify the complete state after execution
- Document the scenario's purpose and expectations clearly

As your contract becomes more complex, maintaining a comprehensive suite of scenario tests becomes increasingly important. They serve as both a safety net and documentation, helping new or future contributors and auditors understand the various situations your contract is designed to handle.

In the next chapter, we'll explore [mutation testing](./mutation-tests.md), where we deliberately introduce changes to our contract code to verify that our tests can catch potential bugs and vulnerabilities.