# Formal Verification

Okay this one is gonna be much detailed than other chapters as there's a quite a bit to cover. Feel free to read this chapter at your own pace. 

At some cases, “tests pass” might not be just enough for the code owners to get a good night's sleep - they want a proof that certain bad states are unreachable. This is where formal verification helps. In this chapter we introduce the workflow with the Certora Prover and CVL (Certora Verification Language), write a minimal spec, run it, interpret results, and close with practical tips you can apply on real codebases. 

:::tip
There are other tools for formal verification too, similar to Solidity Compiler's [SMTChecker](https://docs.soliditylang.org/en/latest/smtchecker.html), etc., but we only over Certora as it is widely used. Most principles explained here will apply for other tools too. 
:::
---

When you write smart contracts, you're not just writing code that needs to work today, you're creating software programs that will handle real money, potentially forever. Traditional testing approaches, while valuable, can only check specific scenarios you think to test. Formal verification offers the mathematical proof that certain properties hold for all possible inputs and sequences of operations. Think of it as the difference between testing whether your door lock works with your key versus mathematically proving that no other key in existence can open it.

## Understanding Formal Verification (100ft view)

Before diving into tools and syntax, let me explain what formal verification actually means in practical terms. When you write a unit test, you're essentially asking "does my function work correctly when I call it with these specific values?" You might test depositing 100 tokens, then 1000 tokens, then edge cases like zero or maximum values. Each test gives you one data point of confidence. But between those data points lie infinite other possibilities that remain untested.

Formal verification inverts this approach entirely. Instead of providing specific inputs and checking outputs, you write logical statements (the "spec") about what must always be true, and a mathematical engine called a theorem prover attempts to either prove these statements hold for all possible inputs or finds a specific counterexample that violates them. When the prover succeeds in verification, you haven't just tested thousands of scenarios, you've obtained a mathematical proof that covers the entire input space within the model's bounds.

The key insight is that the prover doesn't execute your contract repeatedly with different values. Instead, it performs symbolic execution, treating variables as mathematical symbols and reasoning about all their possible values simultaneously. This is what enables it to make universal statements like "for any amount and any user, this property holds" rather than just "this property holds for amount equals 100 and user equals Alice."

 
| ![space-1.jpg](./images/certora/prover.png) | 
|:--:| 
| *Certora Prover Architecture ([Source](https://hackmd.io/@certora/SJO8BtYpY))* |
## Example: The Funds Manager

Consider we have a fund manager contract The manager system allows creating funds where each fund has exactly one current manager. Managers can transfer their role by nominating a pending manager, who must then claim management. The critical invariant is that each manager can only manage one fund at a time and no manager can be responsible for multiple funds.

> This contract was taken from [Certora's Github.](https://github.com/Certora/tutorials-code/blob/master/lesson4_invariants/manager/Manager.sol)

```solidity
contract Manager is IManager {
     mapping(uint256 => ManagedFund) public funds;
    
     mapping(address => bool) private _isActiveManager;
    
    function isActiveManager(address manager) public view returns (bool) {
        return _isActiveManager[manager];
    }

    function createFund(uint256 fundId) public {
        require(msg.sender != address(0));
        require(funds[fundId].currentManager == address(0));
        require(!isActiveManager(msg.sender));  // prevent managing multiple funds
        funds[fundId].currentManager = msg.sender;
        _isActiveManager[msg.sender] = true;
    }

    function setPendingManager(uint256 fundId, address pending) public {
        require(funds[fundId].currentManager == msg.sender);
        funds[fundId].pendingManager = pending;
    }

    function claimManagement(uint256 fundId) public {
        require(msg.sender != address(0) && funds[fundId].currentManager != address(0));
        require(funds[fundId].pendingManager == msg.sender);
        require(!isActiveManager(msg.sender));  // New manager can't already manage a fund
        
        _isActiveManager[funds[fundId].currentManager] = false;
        funds[fundId].currentManager = msg.sender;
        funds[fundId].pendingManager = address(0);
        _isActiveManager[msg.sender] = true;
    }

    function getCurrentManager(uint256 fundId) public view returns (address) {
        return funds[fundId].currentManager;
    }

    function getPendingManager(uint256 fundId) public view returns (address) {
        return funds[fundId].pendingManager;
    }
}
```
Now we'll introduce some bugs to the above contract to understand how formal verification helps you uncover them. It should give you a broad idea of how to approach formal verification for your contracts. 

I might not deep dive into all the concepts like syntax, keywords, etc., you can always pause and look it from their [docs](https://docs.certora.com/en/latest/) for more clarity.

## Basic Properties

Let's start with a basic spec file. Create `Manager.spec`:

```cvl
methods {
    function getCurrentManager(uint256) external returns (address) envfree;
    function getPendingManager(uint256) external returns (address) envfree;
    function isActiveManager(address) external returns (bool) envfree;
}
```

This methods block declares view functions as `envfree`, meaning they don't need transaction context. So we can call `getCurrentManager(fundId)` instead of `getCurrentManager(e, fundId)`.

Now let's verify a basic property about fund creation:

```cvl
rule createFundSetsManager(uint256 fundId) {
    env e;
    
    // Preconditions: fund doesn't exist yet, caller is not already a manager
    require getCurrentManager(fundId) == 0;
    require !isActiveManager(e.msg.sender);
    
    createFund(e, fundId);
    
    // After creating fund, the caller should be the manager
    assert getCurrentManager(fundId) == e.msg.sender,
        "Creator should become the fund manager";
    
    assert isActiveManager(e.msg.sender),
        "Creator should be marked as active manager";
}
```

This rule checks two things: the fund is created with the correct manager, and the manager is marked as active.

We need to create a config file `ManagerBug1.conf` to initiate the run on certora prover. 

```json
{
    "files": [
        "ManagerBug.sol"
    ],
    "verify": "Manager:Manager.v1.spec",
    "wait_for_results": "all",
    "rule_sanity": "basic",
    "msg": "Funds managers verification"
}
```
We can initiate a run using the following command: 

```bash
certoraRun ManagerBug1.conf
```

You can see it runs fine and no errors on the [output](https://prover.certora.com/output/5903283/0e805a15800242bebdcf66b4a4417ed4?anonymousKey=b5fdbbdeaaab19464037ddb4cbfa21d2a89f4b9a). 

![](./images/certora/certora_run1.png)

Now let's introduce a bug in [ManagerBug1.sol](https://github.com/Certora/tutorials-code/blob/master/lesson4_invariants/manager/ManagerBug1.sol), which is missing one critical requirement:

```solidity
function createFund(uint256 fundId) public {
    require(msg.sender != address(0));
    require(funds[fundId].currentManager == address(0));
    // BUG: Missing this check!
    // require(!isActiveManager(msg.sender));
    funds[fundId].currentManager = msg.sender;
    _isActiveManager[msg.sender] = true;
}
```

Next up let's add an invariant that should catch this bug. The key property is that a manager can only manage one fund. We'll include this with the `uniqueManager` invariant:

```cvl
function isManaged(uint256 fundId) returns bool {
    return getCurrentManager(fundId) != 0;
}

// Two different funds cannot have the same manager
invariant uniqueManager(uint256 fundId1, uint256 fundId2)
    ((fundId1 != fundId2) && isManaged(fundId1)) => (
        getCurrentManager(fundId1) != getCurrentManager(fundId2)
    )
```

This means: "For any two different fund IDs, if the first fund exists, then the managers must be different." 

When you run:

```bash
certoraRun Manager.v2.conf
```
You should see something like this

![](./images/certora/certora_run2-bug1.png)

The prover found a violation! You can see the uniqueManager invariant has failed in the output. The stack trace (in the right side) shows that `Manager.getCurrentManager(fund1) == Manager.getCurrentManager(fund2)` which shouldn't be the case.

This exposes the bug: without checking `!isActiveManager(msg.sender)`, someone can create multiple funds and manage them all, violating the uniqueness requirement.

Now let's add another bug in the contract ([ManagerBug2.sol](https://github.com/Certora/tutorials-code/blob/master/lesson4_invariants/manager/ManagerBug2.sol)), which is even more subtle.

```solidity
function claimManagement(uint256 fundId) public {
    require(msg.sender != address(0) && funds[fundId].currentManager != address(0));
    require(funds[fundId].pendingManager == msg.sender);
    require(!isActiveManager(msg.sender));
    
    _isActiveManager[funds[fundId].currentManager] = false;
    funds[fundId].currentManager = msg.sender;
    funds[fundId].pendingManager = address(0);
    _isActiveManager[msg.sender] == true;  // BUG: == instead of =
}
```

This compiles without error because the comparison returns a boolean that's then discarded. But it means `_isActiveManager[msg.sender]` never gets set to true!

Let's add another invariant to catch this:

```cvl
invariant managerIsActive(uint256 fundId)
    isManaged(fundId) <=> isActiveManager(getCurrentManager(fundId))
```

This uses the bi-implication operator `<=>` which reads "if and only if". It means that: "A fund is managed if and only if its current manager is marked as active." This should always be true ie., whenever a fund exists, its manager should be in the active set, and vice versa.

When you run it, the prover finds that after someone claims management, the fund exists but the new manager is NOT marked as active (`Manager.isActiveManger() == false`)

![](./images/certora/certora_run3-bug2.png)

## Invariants with Ghost Variables

One of the nice features of Certora is using ghost variables to track relationships that aren't explicitly stored in the contract. Let's create an inverse mapping from managers to their funds:

```cvl
methods {
    function getCurrentManager(uint256) external returns (address) envfree;
    function getPendingManager(uint256) external returns (address) envfree;
    function isActiveManager(address) external returns (bool) envfree;
}

/// @title The inverse mapping from managers to fund ids
ghost mapping(address => uint256) managersFunds;

// Hook that watches for changes to the currentManager field
hook Sstore funds[KEY uint256 fundId].(offset 0) address newManager {
    managersFunds[newManager] = fundId;
}
```

The `ghost mapping(address => uint256) managersFunds` creates a specification-only variable that doesn't exist in the actual contract. It maps each manager address to the fundId they manage.

The hook says: "Whenever the contract stores a new value to `funds[fundId].currentManager` (which is at offset 0 in the struct), automatically update our ghost mapping to record that this manager now manages this fund."

Now let's write an invariant using this ghost:

```cvl
/// @title Address zero is never an active manager
invariant zeroIsNeverActive()
    !isActiveManager(0)

/// @title Every active manager has a fund they manage
invariant activeManagesAFund(address manager)
    isActiveManager(manager) => getCurrentManager(managersFunds[manager]) == manager
    {
        preserved {
            requireInvariant zeroIsNeverActive();
        }
    }
```

The `activeManagesAFund` invariant says "If someone is marked as an active manager, then when we look up which fund they manage (using our ghost), that fund's current manager should indeed be them."

Note there's a `preserved` block. It specifies additional requirements that must hold before any function call when checking this invariant. We require that `zeroIsNeverActive()` holds, which helps the prover avoid false counterexamples involving the zero address.

## Using Preserved Blocks for Complex Invariants

The following [spec](https://github.com/Certora/tutorials-code/blob/master/solutions/lesson4_invariants/manager/Manager_unique.spec) shows how to properly verify the uniqueness property with preserved blocks:

```cvl
methods {
    function getCurrentManager(uint256) external returns (address) envfree;
    function getPendingManager(uint256) external returns (address) envfree;
    function isActiveManager(address) external returns (bool) envfree;
}


/// A utility function
/// @return whether the fund exists
function isManaged(uint256 fundId) returns bool {
    return getCurrentManager(fundId) != 0;
}


/// @title A fund's manager is active
invariant managerIsActive(uint256 fundId)
    isManaged(fundId) <=> isActiveManager(getCurrentManager(fundId))
    {
        preserved claimManagement(uint256 fundId2) with (env e) {
            requireInvariant uniqueManager(fundId, fundId2);
        }
    }


/// @title A fund has a unique manager
invariant uniqueManager(uint256 fundId1, uint256 fundId2)
	((fundId1 != fundId2) && isManaged(fundId1)) => (
        getCurrentManager(fundId1) != getCurrentManager(fundId2)
    ) {
        preserved {
            requireInvariant managerIsActive(fundId1);
            requireInvariant managerIsActive(fundId2);
        }
    }
```

The `uniqueManager` invariant has a preserved block that requires `managerIsActive` holds for both funds. This tells the prover: "When checking if uniqueManager is preserved by some function, you can assume that managerIsActive already holds."

The `managerIsActive` invariant has a more specific preserved block just for `claimManagement`. It says: "When checking if managerIsActive is preserved by claimManagement specifically, you can assume uniqueManager holds between the two fund IDs involved."

This creates a mutually reinforcing relationship between the invariants. The prover verifies them together, using each to help prove the other. This is called **inductive reasoning** which means each invariant helps prove the others remain true after any operation.

## Parametric Rules 

Parametric rules is a feature in CVL that allow you to write rules for any method of a contract, not just specific ones. By using undefined method variables (like method f), the Certora Prover simulates the execution of all possible methods, ensuring that a property holds true regardless of which contract method is called. Let's write a parametric rule that checks a general property across all functions:

```cvl
rule onlyAuthorizedCanChangeManager(method f, uint256 fundId) {
    address managerBefore = getCurrentManager(fundId);
    
    env e;
    calldataarg args;
    f(e, args);
    
    address managerAfter = getCurrentManager(fundId);
    
    // If the manager changed, it must have been through specific functions
    assert managerBefore != managerAfter => (
        f.selector == sig:createFund(uint256).selector ||
        f.selector == sig:claimManagement(uint256).selector
    ), "Manager should only change through createFund or claimManagement";
}
```

This rule checks every function in the contract to ensure that only `createFund` and `claimManagement` can change who manages a fund. The `setPendingManager` function shouldn't change the current manager,it only sets the pending one.

### Failure Case for the Parametric Rule

The parametric rule would fail if we had a bug where an unauthorized function modifies the manager. Imagine a version where `setPendingManager` accidentally changes the current manager instead of just the pending one:

```solidity
// Buggy setPendingManager
function setPendingManager(uint256 fundId, address pending) public {
    require(funds[fundId].currentManager == msg.sender);
    // BUG: Accidentally setting currentManager instead of pendingManager
    funds[fundId].currentManager = pending;  
    funds[fundId].pendingManager = pending;
}
```
You can find the full spec ran on the bug-free Manager.sol contract and here are the results

![](./images/certora/final-run-with-parametric.png)

## How to apply this practically?

The Manager example demonstrates all the basic rules, invariants, ghost variables, hooks, preserved blocks, and parametric rules with a practical example to help you understand better. But you can only get good at writing specs by repeated practice.

You must start by understanding your contract's fundamental purpose and identifying what correctness means. Ask yourself what are the **core guarantees** this contract must provide? For a vault, it's preservation of assets and correct accounting. For a governance system, it's preventing unauthorized actions and counting votes correctly. For an auction, it's ensuring the highest bidder wins and funds flow correctly. Write these guarantees down in plain English before starting with the CVL.

Next, identify your contract's important state variables and how they relate to each other. **Draw the relationships**...does the sum of balances need to equal a total? Must certain state variables always get updated together (like balance and supply)? Are there ratios that must be maintained? These relationships become your invariants.

Then, think through your contract's state transitions. What are the major operations users can perform? For each operation, ask: what must be true before this operation (preconditions)? What should change as a result (postconditions)? What should remain unchanged? These questions directly map to CVL rules.

Most importantly, **consider what should never happen**. Users shouldn't lose funds. The contract shouldn't become insolvent. Critical values shouldn't decrease except through specific functions. These negative properties often catch the most serious bugs.

Start with the simplest rules and invariants first. Don't try to verify everything at once. Begin with obvious properties like "deposit increases balance" or "sum of parts equals total." Get these working, understand the tool, then gradually add more sophisticated properties.

#### Found a bug? 

![](./images/certora/meme.jpg)

When you get counterexamples, resist the urge to immediately "fix" the specification. First understand whether the counterexample reveals a real bug in the contract or an incorrect assumption in your specification. Often, the first counterexamples point to edge cases you hadn't considered, and these edge cases frequently represent real vulnerabilities. **Test the tests!**

Use parametric rules to check properties across all functions efficiently. Instead of writing separate rules for how each function affects balances, write one parametric rule and let the prover check it against every function. This scales much better as contracts grow.

Layer your verification. Start with basic safety properties, then add more complex correctness properties, then tackle liveness and performance properties if relevant. Each layer builds confidence incrementally.

## Nah I'm good - already got 100% coverage

Line and branch coverage are good but one shouldn't assume the strength of their test suite just by that single metric. Let me walk through exactly how each testing approach would (or wouldn't) catch the bugs in our Manager example. This concrete comparison shows the fundamental differences.

### Bug 1: Missing `require(!isActiveManager(msg.sender))` in createFund

**Unit Test:**
```solidity
function testCreateMultipleFunds() public {
    vm.prank(alice);
    manager.createFund(1);
    
    vm.prank(alice);
    manager.createFund(2);
    
    // Would need to explicitly check this specific violation
    assertEq(manager.getCurrentManager(1), alice);
    assertEq(manager.getCurrentManager(2), alice);
    // But would you think to assert this is WRONG?
}
```

Unit tests only catch this if you specifically think to write a test that tries creating multiple funds with the same user AND you remember to assert that this should fail. Most developers would write tests for the happy path (user creates one fund successfully) but might not think "what if they create a second fund?"

**Invariant/Fuzz Testing:**
```solidity
function invariant_uniqueManagers() public {
    // How do you even express this?
    // You'd need to iterate all funds and check uniqueness
    // But you don't know which fundIds exist
}
```

Invariant testing struggles here because:
1. You don't know which fund IDs have been created
2. You'd need to track all managers and their funds somehow
3. The property requires quantifying over all pairs of funds

Fuzz testing might eventually stumble upon it if you fuzz "call createFund twice with same user" but only if you set up the test to try that specific sequence.

**Formal Verification:**
```cvl
invariant uniqueManager(uint256 fundId1, uint256 fundId2)
    ((fundId1 != fundId2) && isManaged(fundId1)) => (
        getCurrentManager(fundId1) != getCurrentManager(fundId2)
    )
```

The prover automatically:
- Considers all possible pairs of fund IDs
- Tries all possible sequences of operations
- Finds the minimal counterexample: "Create fund 1, then create fund 2 with same user"
- No need to guess which scenario to test

### Bug 2: Using `==` instead of `=` in claimManagement()

**Unit Testing:**
```solidity
function testClaimManagement() public {
    vm.prank(alice);
    manager.createFund(1);
    
    vm.prank(alice);
    manager.setPendingManager(1, bob);
    
    vm.prank(bob);
    manager.claimManagement(1);
    
    assertEq(manager.getCurrentManager(1), bob); // PASSES
    // But would you check this?
    assertTrue(manager.isActiveManager(bob)); // FAILS - but did you write this?
}
```

Unit tests only catch this if you explicitly check the `isActiveManager` state after claiming. Many developers would only verify that the `currentManager` was updated correctly, missing that the active manager flag wasn't set.

**Fuzz Testing:**

Fuzz testing has the same problem - it would only catch this if you're specifically checking the `isActiveManager` mapping after operations. And even then, you need to know what to check for.

**Formal Verification:**
```cvl
invariant managerIsActive(uint256 fundId)
    isManaged(fundId) <=> isActiveManager(getCurrentManager(fundId))
```

The prover automatically checks this relationship after every single function call. It immediately finds: "After claimManagement, the fund exists but the manager is not marked as active - invariant violated!"

| Approach | Search Space | Coverage | What You Catch | What You Miss |
|----------|--------------|-----------|----------------|---------------|
| Unit Tests | Manual path exploration | Dozens to hundreds of scenarios | Bugs in paths you explicitly test | Paths you didn't think to test |
| Fuzz Tests | Random input space exploration | Thousands to millions of random scenarios | Bugs that appear with reasonable probability | Rare combinations, bugs requiring specific sequences |
| Invariant Tests | Random operation sequences | Thousands of random operation sequences | Property violations in tested sequences | Sequences not randomly generated, complex multi-contract states |
| Formal Verification | Exhaustive symbolic exploration | ALL possible inputs and states (within model bounds) | Any violation of the specified properties | Only what you didn't specify |

The tradeoff is that formal verification requires:
- Steep learning curve for the new specification language (CVL) and tools
- Thinking precisely about properties
- Dealing with false positives from over-approximation

It doesn't mean that formal verification is the best method to find bugs. As mentioned by Leo Alt [in this video](https://www.youtube.com/watch?v=RunMhlTtdKw) "***No single tool or technique can both prove correctness or find bugs consistently. Every method has its own strengths in different contexts, but none is universally reliable.***" So we would need a mix of all to have better confidence in our contract.


## Integrating Formal Verification into dev pipeline

Formal verification can be quite powerful when integrated into your normal development workflow, not treated as a separate audit step at the end. 
- Write specifications alongside your contract code, not after. 
- When you add a new function, immediately write rules about its behavior. This helps you think through the function's semantics clearly and catches bugs while the code is fresh in your mind. 

Run verification regularly, not just before deployment. Make it part of your continuous integration pipeline. A failing verification caught during development is infinitely cheaper than one discovered after deployment. You can even run verification on pull requests automatically. Maintain your specification as living documentation. Unlike comments, formal specifications are machine-checked. They can't become outdated without failing verification. This makes them invaluable for onboarding new team members and reasoning about contract behavior months later.

When specifications fail after changes, this is the system working correctly...you've been notified that a change violated expected properties. Investigate whether the change introduced a bug or whether the specifications need updating to satisfy the intended behavior. 

:::tip
This might not be suitable for all teams and projects as it might be time consuming but if you got that extra time I highly recommend integrating formal verification early on in your development and testing pipeline.
:::

If you don't have enough time to integrate formal verification during development, do it in parallel when the code is under audit (code freeze) or even you can look into formally verifying your contracts post deployment. 

## Conclusion

Instead of wondering whether an edge case exists that breaks your invariants, you can verify your invariants are truly satisfied. The learning curve is quite steep. Formal verification requires thinking precisely about properties and learning new tools and languages. But once tackled the payoff could be huge.

So I suggest you to start small, with simple rules on simple contracts. Build your intuition for how the prover thinks and what makes good specifications. Gradually tackle more complex properties and larger contracts. Over time, you'll develop a mental model for reasoning about contract correctness that makes you a better developer even when you're not actively running the prover. Success requires a deep understanding of both the contracts and the tools themselves.

## For further exploration
- [Leo Alt : Fully Automated Formal Verification: How far can we go?](https://www.youtube.com/watch?v=RunMhlTtdKw)
- [An Introduction to Formal Verification With Certora](https://allthingsfuzzy.substack.com/p/an-introduction-to-formal-verification-019)
- [The Certora Prover Technology: A Gentle Introduction](https://hackmd.io/@certora/SJO8BtYpY)
- [If you wanna deep dive into formal methods (DeFi)](https://github.com/WilfredTA/formal-methods-curriculum/)
- [https://github.com/leonardoalt/ethereum_formal_verification_overview](https://github.com/leonardoalt/ethereum_formal_verification_overview)