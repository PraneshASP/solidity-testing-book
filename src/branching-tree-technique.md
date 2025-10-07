# Branching Tree Technique

Unlike previous chapters, the Branching tree technique is not a testing method. It's a testing methodology. 

Most developers test their smart contracts by implementing a feature first, then adding test cases after. This works for small projects but creates problems as codebases grow.

I'd call the traditional testing as a **reactive** approach. The challenges become more evident as the project matures:

- **Linear and disconnected**: Tests exist as separate functions without a clear relationship, making it difficult to understand their coverage.
- **Difficult to visualize**: Without a systematic approach, the full range of possible states and transitions becomes hard to track.
- **Prone to gaps**: Critical edge cases often go unnoticed when testing isn't planned comprehensively from the start
- **Hard to maintain**: As contracts evolve, understanding which tests cover which scenarios becomes more challenging.

The Branching Tree Technique aims to fix this. It's more of a **proactive** approach. Instead of writing tests after implementation, BTT leans more towards a test-driven development approach encouraging developers to identify all possible branches of execution, states, and edge cases before implementing tests. 

## What is the BTT?

The Branching Tree Technique represents test cases as a hierarchical tree structure where:

- **Nodes** represent states or conditions in your contract
- **Branches** represent different paths or decisions
- **Leaves** represent concrete test cases that should be implemented

This explicit mapping of the testing space brings structure and clarity to what can otherwise be a chaotic process. Instead of thinking about individual test functions in isolation, BTT encourages you to think about the complete state space of your contract.

It was first [introduced by Paul R Berg in 2022](https://x.com/PaulRBerg/status/1679914755014942720), co-founder of Sablier Labs in their Sablier V2 Codebase. 

BTT operates by creating a specification in a .tree file, using a tree-like structure denoted by ASCII characters such as `├` and `└` for branches. The specification outlines:

- Contract State: Defined using "given," which prepares the contract state in advance (e.g., "Given the contract is initialized").
- Function Parameters and Execution Modes: Specified with "when," covering user-controlled inputs or execution modes (e.g., "When input is valid").
- Expected Behaviors: Described with "it," stating the expected outcome or assertion (e.g., "It should return true").

## Benefits and Advantages

BTT fundamentally changes how we approach Solidity testing:

1. **Improved coverage**: By explicitly modeling the state space, you're less likely to miss important test cases
2. **Documentation**: The tree structure serves as living documentation of your contract's behavior
3. **Easier maintenance**: When contract logic changes, you can update the tree rather than hunting through disconnected tests
4. **collaboration**: Team members can better understand and contribute to testing efforts with a visual representation
5. **Automation**: The structured format supports automated test generation, reducing manual effort and potential errors, with tools like Bulloak facilitating this process.

## Comparison with other frameworks:
The below table was taken from Paul's BTT Presentation:

| Framework         | Level         | Effectiveness | Learning Curve |
|-------------------|---------------|---------------|----------------|
| BTT               | Entry-level   | Moderate      | Low            |
| Cucumber Gherkin  | Medium-level  | Moderate      | Medium         |
| Certora           | Senior-level  | High          | High           |
| TLA+              | Senior-level  | High          | High           |

## Implementing BTT with Bulloak

Bulloak is an tool that automates the generation of Solidity test files from a BTT specification. Here's how it works:

1. You create a `.tree` file that specifies your test structure
2. Bulloak parses this file and generates scaffolded test files
3. You fill in the implementation details for each test case


For instance, an example specification might look like:

```tree
FooTest
└── When stuff is called
    └── When a condition is met
        └── It should revert.
            └── Because we shouldn't allow it.
```

This structure is then processed by tools like Bulloak, which generates a skeleton Solidity test file. 

```solidity
// $ bulloak scaffold foo.tree

pragma solidity 0.8.0;

contract FooTest {
    modifier whenStuffIsCalled() {
        _;
    }

    function test_RevertWhen_AConditionIsMet() external whenStuffIsCalled {
        // It should revert.
        // Because we shouldn't allow it.
    }
}
```

The generated code includes test functions for each condition and action, which developers can further refine.

## Case Study: Sablier's BTT Approach

The Sablier protocol provides a really good example of BTT in action. Let's examine their approach to testing the `collectFees` functionality:

### The BTT Tree Structure

Here's how Sablier structures their test cases for the `CollectFees` feature:

```
CollectFees_Integration_Test
├── when provided merkle lockup not valid
│  └── it should revert
└── when provided merkle lockup valid
   ├── when factory admin is not contract
   │  ├── it should transfer fee to the factory admin
   │  ├── it should decrease merkle contract balance to zero
   │  └── it should emit a {CollectFees} event
   └── when factory admin is contract
      ├── when factory admin does not implement receive function
      │  └── it should revert
      └── when factory admin implements receive function
         ├── it should transfer fee to the factory admin
         ├── it should decrease merkle contract balance to zero
         └── it should emit a {CollectFees} event
```

This structure clearly shows the primary branching decisions and expected outcomes for each scenario.

## Branch 1: Invalid Merkle Lockup

The first branch tests what happens when an invalid merkle lockup is provided:

```solidity
function test_RevertWhen_ProvidedMerkleLockupNotValid() external {
    vm.expectRevert();
    merkleFactory.collectFees(ISablierMerkleBase(users.eve));
}
```

This test directly verifies that the contract properly rejects invalid inputs. Notice how the function name explicitly corresponds to the branch in the tree, making the relationship obvious.

## Understanding Custom Modifiers for Branching

Before looking at the next branches, it's important to understand how Sablier uses custom modifiers to represent branches in the tree. 

```solidity
    modifier whenCallerAdmin() {
        // Make the Admin the caller in the rest of this test suite.
        resetPrank({ msgSender: users.admin });
        _;
    }

    modifier whenCallerCampaignOwner() {
        resetPrank({ msgSender: users.campaignOwner });
        _;
    }

    modifier whenProvidedMerkleLockupValid() {
        _;
    }
```

These modifiers encapsulate the preconditions for each test path, creating a direct mapping between the tree structure and the test code. 

## Branch 2: Valid Merkle Lockup with Non-Contract Admin

The next branch tests what happens when the merkle lockup is valid and the factory admin is not a contract:

```solidity
function test_WhenFactoryAdminIsNotContract() external whenProvidedMerkleLockupValid {
    testCollectFees(users.admin);
}
```

This test uses the `whenProvidedMerkleLockupValid` (empty) modifier. It then delegates to a helper function `testCollectFees` to check the expected behaviors for this scenario.

## Shared Test Helper for Common Assertions

Sablier uses a helper function to encapsulate assertions that are reused across multiple test cases:

```solidity
function testCollectFees(address admin) private {
    // Load the initial ETH balance of the admin.
    uint256 initialAdminBalance = admin.balance;
    // It should emit a {CollectFees} event.
    vm.expectEmit({ emitter: address(merkleFactory) });
    emit ISablierMerkleFactory.CollectFees({ admin: admin, merkleBase: merkleBase, feeAmount: defaults.FEE() });
    // Make Alice the caller.
    resetPrank({ msgSender: users.eve });
    merkleFactory.collectFees(merkleBase);
    // It should decrease merkle contract balance to zero.
    assertEq(address(merkleBase).balance, 0, "merkle lockup ETH balance");
    // It should transfer fee to the factory admin.
    assertEq(admin.balance, initialAdminBalance + defaults.FEE(), "admin ETH balance");
}
```

This helper performs three key assertions matching our tree's leaf nodes:
1. Verifies the correct event is emitted
2. Confirms the merkle contract balance is zeroed
3. Checks that the fee is transferred to the admin

By encapsulating these common assertions, Sablier reduces code duplication while maintaining the conceptual integrity of the tree structure.

## Branch 3: Contract Admin Without Receive Function

The next branch tests what happens when the admin is a contract that doesn't implement a receive function:

```solidity
function test_RevertWhen_FactoryAdminDoesNotImplementReceiveFunction()
    external
    whenProvidedMerkleLockupValid
    whenFactoryAdminIsContract
{
    // Transfer the admin to a contract that does not implement the receive function.
    resetPrank({ msgSender: users.admin });
    merkleFactory.transferAdmin(address(contractWithoutReceiveEth));
    // Make the contract the caller.
    resetPrank({ msgSender: address(contractWithoutReceiveEth) });
    vm.expectRevert(
        abi.encodeWithSelector(
            Errors.SablierMerkleBase_FeeTransferFail.selector,
            address(contractWithoutReceiveEth),
            address(merkleBase).balance
        )
    );
    merkleFactory.collectFees(merkleBase);
}
```

This test uses both the `whenProvidedMerkleLockupValid` and `whenFactoryAdminIsContract` modifiers to establish the parent branch conditions. It then sets up the specific scenario (a contract admin without a receive function) and verifies that the contract reverts with the expected error.

Notice how the test code carefully manages state to create the exact conditions represented by this branch in the tree.

## Branch 4: Contract Admin With Receive Function

The final branch tests what happens when the admin is a contract that implements a receive function:

```solidity
function test_WhenFactoryAdminImplementsReceiveFunction()
    external
    whenProvidedMerkleLockupValid
    whenFactoryAdminIsContract
{
    // Transfer the admin to a contract that implements the receive function.
    resetPrank({ msgSender: users.admin });
    merkleFactory.transferAdmin(address(contractWithReceiveEth));
    testCollectFees(address(contractWithReceiveEth));
}
```

Like the previous test, this one uses both parent branch modifiers. It then sets up the specific scenario (a contract admin with a receive function) and reuses the `testCollectFees` helper to verify the expected behaviors.

## Key Insights 

Sablier's approach demonstrates several powerful techniques for implementing BTT:

1.  The use of modifiers like `whenProvidedMerkleLockupValid` and `whenFactoryAdminIsContract` directly maps the tree structure to code and enforces branch preconditions.

2.   Function names like `test_RevertWhen_FactoryAdminDoesNotImplementReceiveFunction` clearly indicate which branch they're testing.

3.  Each test function carefully sets up the state required for its specific branch, using functions like `resetPrank` and `transferAdmin`.

4.  The `testCollectFees` helper function avoids duplication for common test assertions while preserving the tree structure's integrity.

5.  Every path in the tree is explicitly tested, ensuring comprehensive coverage of all scenarios.


## Learning from Sablier's Approach

For developers looking to implement BTT in their own projects, Sablier's approach suggests several best practices:

1. Create custom modifiers that represent the branches in your tree
2. Name test functions to clearly indicate which branch they represent
3. Use helper functions for common assertions without sacrificing clarity
4. Carefully manage state to ensure each test runs in the correct context
5. Ensure every branch in your tree has corresponding test coverage

By following these patterns, developers can create test suites that are comprehensive, maintainable, and directly traceable to their BTT specifications.

## Conclusion

The Branching Tree Technique represents a significant improvement in how we approach Solidity testing. By explicitly listing the state space of the contracts and generating structured tests, we can achieve better coverage, clearer documentation, and easier maintenance.

Whether you're working on a simple escrow contract or a complex DeFi protocol, BTT can help ensure your contracts behave as expected under all conditions. The visual nature of the approach also makes it easier to communicate testing strategies with team members and stakeholders.

I really recommend you to try BTT on your next project. Start with a simple contract, map out its behavior as a tree, and experience the clarity and confidence that comes from a more structured testing approach. You'll thank yourself for the modelling the tests in a more structured way!



### Resources
- [Paul Berg's Presentation](https://prberg.com/presentations/solidity-summit-2023/)
- [Bulloak repo Discussions](https://github.com/alexfertel/bulloak/discussions/)
- [VSCode Solidity Inspector](https://marketplace.visualstudio.com/items?itemName=PraneshASP.vscode-solidity-inspector) extension for tree files syntax highlighting and [bulloak](https://www.bulloak.dev/) support.
- [BTT Examples](https://github.com/PaulRBerg/btt-examples/tree/main)
