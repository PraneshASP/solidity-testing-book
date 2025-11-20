# Bonus: Building a Scenario Test Runner

In our previous section, we explored scenario testing using straight forward foundry tests where each scenario is written as a separate test function. While this approach works, it can lead to repetitive code and makes it harder for non-technical stakeholders to understand and contribute to test scenarios. Overtime the tests may get very large, and it'll be difficult to maintain. 

So in this bonus 🍬 chapter I'll showcase a more intuitive approach for defining and running scenario tests. I call it the **Scenario tests runner.**

## From Traditional to Declarative Scenarios

Consider how we wrote scenarios in our previous approach:

```solidity
function test_Scenario_MultipleUsersCompetingForLiquidity() public {
    // Setup initial state
    vm.startPrank(user1);
    token.approve(address(lending), 500 ether);
    lending.deposit(500 ether);
    vm.stopPrank();

    vm.startPrank(user2);
    token.approve(address(lending), 300 ether);
    lending.deposit(300 ether);
    vm.stopPrank();

    // More actions...
}

function test_Scenario_CascadingLiquidations() public {
    // Different but similar setup
    vm.startPrank(user1);
    token.approve(address(lending), 500 ether);
    lending.deposit(500 ether);
    vm.stopPrank();

    // More actions...
}
```

Notice the repetitive patterns? Each scenario:
1. Sets up initial state
2. Performs a series of actions
3. Validates final state
4. Requires Solidity knowledge to write or modify

We can transform these into declarative scenarios using a test runner:

```json
{
  "description": "Multiple users competing for liquidity",
  "actions": [
    {
      "action": "deposit",
      "caller": "user1",
      "params": {
        "amount": "500000000000000000000"
      }
    },
    {
      "action": "deposit",
      "caller": "user2",
      "params": {
        "amount": "300000000000000000000"
      }
    }
  ],
  "expectedFinalState": {
    "totalDeposits": "800000000000000000000",
    "user1": {
      "deposits": "500000000000000000000"
    },
    "user2": {
      "deposits": "300000000000000000000"
    }
  }
}
```

This approach offers several immediate benefits:
1. Scenarios are human-readable
2. No code duplication
3. Non-developers can write and review scenarios
4. Scenarios serve as documentation

## Architecture of the Runner

![](../images/scenario-runner.png)

The Scenario Runner is built on a few key principles:

1. **Separation of Concerns**: The runner separates the scenario definition (what to test) from the execution logic (how to test)
2. **Extensibility**: New actions can be added without modifying the core runner
3. **Validation**: Both input scenarios and execution results are validated
4. **Reusability**: Common setup and teardown logic is handled automatically

Let's break down the key components:

### Core Components

1. **Scenario Parser**: Loads and validates JSON scenario files
2. **Action Router**: Maps action types to their handlers
3. **State Validator**: Verifies system state after scenario execution
4. **Address Book**: Manages test addresses and roles

### Action Handlers

Each action type (deposit, borrow, etc.) has its own handler that knows how to:
1. Parse action parameters
2. Execute the action
3. Log relevant information
4. Handle potential errors

Here's how we implement an action handler:

```solidity
function handleDeposit(string memory caller, uint256 amount) internal {
    address callerAddr = addressBook[caller];
    
    // Handle token approval and deposit
    vm.startPrank(callerAddr);
    token.approve(address(lending), amount);
    lending.deposit(amount);
    vm.stopPrank();
    
    console.log("Deposit processed:", amount);
}
```

### State Validation

The runner validates the final state against expected values:

```solidity
function validateFinalState(string memory statePath) internal {
    console.log("\nValidating final state...");

    // Validate total protocol state
    uint256 expectedTotalDeposits = vm.parseJsonUint(
        json, 
        string.concat(statePath, ".totalDeposits")
    );
    assertEq(
        lending.totalDeposits(),
        expectedTotalDeposits,
        "Total deposits mismatch"
    );

    // Validate individual user states
    string[] memory users = new string[](2);
    users[0] = "user1";
    users[1] = "user2";

    for(uint i = 0; i < users.length; i++) {
        try vm.parseJsonUint(
            json, 
            string.concat(statePath, ".", users[i], ".deposits")
        ) returns (uint256 deposits) {
            validateUserState(users[i], deposits);
        } catch {
            continue;
        }
    }
}
```

I really like scenario testing via custom runners for each project as it helps me navigate multiple test paths. Other than that it could also provide other benefits such as:

1. Product owners and testers can write scenarios in a readable JSON format. These scenarios serve as both specifications and tests, ensuring alignment between business requirements and implementation.

2. Each scenario file serves as living documentation. New team members can understand system behavior by reading through scenario files:

```json
{
  "description": "Market stress test - Multiple users competing for liquidity",
  "actions": [
    {
      "action": "deposit",
      "caller": "user1",
      "params": { "amount": "500000000000000000000" }
    },
    // ... more actions ...
  ]
}
```

3. When bugs are discovered in production, they can be immediately translated into scenario tests:

```json
{
  "description": "Bug #123 - Liquidation during price recovery",
  "actions": [
    // Steps to reproduce the bug
  ],
  "expectedFinalState": {
    // The correct state after fix
  }
}
```

4. Since scenarios are data, we can generate them programmatically:

```solidity
function generateStressScenarios() public {
    uint256[] memory prices = [1e18, 0.9e18, 0.8e18, 0.7e18];
    for(uint i = 0; i < prices.length; i++) {
        generateScenario(prices[i]);
    }
}
```

### Tips to build your own runner:

1. Each scenario should have a clear description and purpose
2. Keep actions focused and single-purpose
3. Verify all relevant state changes
4. Include scenarios that test error conditions
5. Start with simple scenarios and build up to complex ones


> **The current approach is a very basic one, to build a more advanced scenario test runner refer to [Maple V2's implementation](https://github.com/maple-labs/maple-core-v2/blob/3a49435209614ded4c34c4bbd57e2ceb59a1d3e0/scenarios/Scenarios.t.sol)**


## Conclusion

The Scenario Runner pattern bridges the gap between business requirements and technical implementation, making tests more maintainable, readable, and valuable as documentation. By separating what from the how, it enables non-technical stakeholders to contribute directly to the testing process while maintaining the rigorous validation necessary for the protocol. The JSON scenarios become a shared language that everyone can understand and contribute to, making your testing process more inclusive and effective.