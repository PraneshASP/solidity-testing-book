# Lifecycle Tests

To re-iterate: smart contracts are unique software entities that, once deployed, often control significant financial assets and execute critical business logic autonomously. Unlike traditional software that can be patched or updated easily, smart contracts require careful verification of their entire operational lifespan. This chapter explores lifecycle testing, a comprehensive approach to ensuring smart contracts behave correctly throughout their existence. 

> [!INFO]
> I first discovered lifecycle tests for smart contracts from the [maple-core-v2](https://github.com/maple-labs/maple-core-v2/blob/main/tests/e2e/PoolLifecycle.t.sol) repo. They have one of the best test suites out there. I became a fan of it since then. 


**Lifecycle tests are advanced from of end-to-end test which is designed to validate the behavior of a smart contract throughout its entire lifecycle**. They ensure that the contract behaves correctly over time, especially as it moves through different states and handles a sequence of operations that might occur during its lifespan. The main goal is to verify that the contract maintains integrity and correctness throughout all possible state changes.

In smart contracts, this "life story" includes several critical phases:

- Deployment and initialization
- Configuration and setup
- Active operation period
- State transitions and upgrades
- Emergency scenarios

For example, consider a token vesting contract. Its lifecycle begins when deployed, progresses through initialization where beneficiaries and schedules are set, enters an active phase where tokens gradually vest, handles claims throughout its life, and eventually completes when all tokens are distributed. Each of these phases must be thoroughly tested to ensure the contract behaves correctly throughout its existence.

### Why not unit/integration tests?

While unit tests focus on individual functions and integration tests verify component interactions, lifecycle tests examine the evolution of contract's state and behavior during every stage. Think of it this way:
- Unit Tests are like checking individual car parts - the engine, wheels, brakes - in isolation.
- Integration Tests verify these parts work together - the engine powers the wheels, brakes stop the car.
- Lifecycle Tests ensure the car performs correctly throughout its entire lifespan - from factory assembly to years of operation.


### Common Contract Lifecycle Patterns
Smart contracts often follow predictable lifecycle patterns based on their purpose:
- **Time-Based Progression**: Contracts that mature or evolve based on time, like vesting schedules or escrow. These contracts transition through states based on temporal triggers.
- **User-Driven Evolution**: Contracts that progress based on user actions, like governance systems where proposal submission and voting drive state changes.
- **Event-Triggered Changes**: Contracts that respond to external events or oracle data, transitioning states based on market conditions or other triggers.


## Case Study: Token Vesting Contract

Let's take an example of a vesting contract (time-based progression) and see how to implement lifecycle tests for the same.

The token vesting contract manages the gradual release of tokens to beneficiaries over time. 

Let's examine its core requirements and states:

States:
1. Uninitialized: Contract deployed but not configured
2. Initialized: Beneficiary and schedule set
3. Funded: Tokens deposited and ready
4. Vesting: Active vesting period
5. Completed: All tokens distributed

Let's implement the contract:

```solidity
contract Vesting is Ownable {
   
    // Core storage variables
    IERC20 public token;
    address public beneficiary;
    uint256 public vestingStart;
    uint256 public vestingDuration;
    uint256 public totalAmount;
    uint256 public releasedAmount;
    VestingState public state;
    bool public paused;

     enum VestingState { 
        Uninitialized,
        Initialized,
        Funded,
        Vesting,
        Completed
    }
    
    // Modifiers for common state checks
    modifier onlyInState(VestingState requiredState) {
        if (state != requiredState) {
            revert InvalidState(state, requiredState);
        }
        _;
    }
    
    function initialize(
        address _beneficiary,
        uint256 _vestingDuration
    ) external onlyOwner onlyInState(VestingState.Uninitialized) {
        // Validate input parameters
        if (_beneficiary == address(0)) {
            revert ZeroAddress();
        }
        if (_vestingDuration == 0) {
            revert ZeroDuration();
        }
        
        beneficiary = _beneficiary;
        vestingDuration = _vestingDuration;
        state = VestingState.Initialized;
        
        emit VestingInitialized(_beneficiary, _vestingDuration);
    }
    
    function fund(
        IERC20 _token,
        uint256 _amount
    ) external onlyOwner onlyInState(VestingState.Initialized) {
        if (_amount == 0) {
            revert ZeroAmount();
        }
        
        token = _token;
        totalAmount = _amount;
        
        // Attempt token transfer
        bool success = token.transferFrom(msg.sender, address(this), _amount);
        if (!success) {
            revert TransferFailed();
        }
        
        state = VestingState.Funded;
        emit VestingFunded(_amount);
    }
    
    function startVesting() 
        external 
        onlyOwner 
        onlyInState(VestingState.Funded) 
    {
        vestingStart = block.timestamp;
        state = VestingState.Vesting;
    }
    
    function vestedAmount() public view returns (uint256) {
        if (state != VestingState.Vesting) {
            return 0;
        }
        
        if (block.timestamp >= vestingStart + vestingDuration) {
            return totalAmount;
        }
        
        return (totalAmount * (block.timestamp - vestingStart)) / vestingDuration;
    }
    
    function claim() external whenNotPaused onlyBeneficiary {
        if (state != VestingState.Vesting) {
            revert InvalidState(state, VestingState.Vesting);
        }
        
        if (block.timestamp <= vestingStart) {
            revert VestingNotStarted();
        }
        
        uint256 vested = vestedAmount();
        uint256 claimable = vested - releasedAmount;
        
        if (claimable == 0) {
            revert NoTokensAvailable();
        }
        
        releasedAmount += claimable;
        bool success = token.transfer(beneficiary, claimable);
        if (!success) {
            revert TransferFailed();
        }
        
        emit TokensReleased(claimable);
        
        // Check if vesting is complete
        if (releasedAmount == totalAmount) {
            state = VestingState.Completed;
            emit VestingCompleted();
        }
    }
...
}
```

Now let's implement the lifecycle tests for the Vesting contract. We'll make sure that the test calls all the methods:

```solidity
  function testVestingLifecycle() public {
        // Step 1: Verify initial state after deployment
        assertEq(uint256(vesting.state()), uint256(Vesting.VestingState.Uninitialized));
        assertEq(vesting.owner(), admin);
        assertEq(address(vesting.token()), address(0));
        
        // Step 2: Initialize the vesting contract
        vm.startPrank(admin);
        vesting.initialize(beneficiary, VESTING_DURATION);
        vm.stopPrank();
        
        assertEq(vesting.beneficiary(), beneficiary);
        assertEq(vesting.vestingDuration(), VESTING_DURATION);
        assertEq(uint256(vesting.state()), uint256(Vesting.VestingState.Initialized));
        
        // Step 3: Fund the vesting contract
        vm.startPrank(admin);
        token.approve(address(vesting), TOTAL_AMOUNT);
        vesting.fund(token, TOTAL_AMOUNT);
        vm.stopPrank();
        
        assertEq(token.balanceOf(address(vesting)), TOTAL_AMOUNT);
        assertEq(uint256(vesting.state()), uint256(Vesting.VestingState.Funded));
        
        // Step 4: Start vesting period
        vm.prank(admin);
        vesting.startVesting();
        
        assertEq(uint256(vesting.state()), uint256(Vesting.VestingState.Vesting));
        assertEq(vesting.vestingStart(), block.timestamp);
        
        // Step 5: Test partial vesting at 25% duration
        vm.warp(block.timestamp + VESTING_DURATION / 4);
        
        uint256 expectedVested = TOTAL_AMOUNT / 4;  // 25% should be vested
        assertApproxEqRel(vesting.vestedAmount(), expectedVested, 0.01e18);  // 1% tolerance
        
        // Step 6: Make partial claim
        uint256 preClaimBalance = token.balanceOf(beneficiary);
        
        vm.prank(beneficiary);
        vesting.claim();
        
        uint256 claimedAmount = token.balanceOf(beneficiary) - preClaimBalance;
        assertApproxEqRel(claimedAmount, expectedVested, 0.01e18);
        
        // Step 7: Test full vesting completion
        vm.warp(block.timestamp + VESTING_DURATION);  // Move to end of vesting
        
        assertEq(vesting.vestedAmount(), TOTAL_AMOUNT);  // All tokens should be vested
        
        // Step 8: Final claim
        vm.prank(beneficiary);
        vesting.claim();
        
        assertEq(uint256(vesting.state()), uint256(Vesting.VestingState.Completed));
        assertEq(token.balanceOf(beneficiary), TOTAL_AMOUNT);
        assertEq(token.balanceOf(address(vesting)), 0);
        
        // Step 9: Verify post-completion state
        vm.expectRevert(abi.encodeWithSelector(Vesting.InvalidState.selector,4,3));
        vm.prank(beneficiary);
        vesting.claim();
    }
    
```

We can also verify how the contract works under emergency situations with admin intervention:

```solidity
    function testEmergencyControls() public {
        // Setup funded and vesting state
        vm.startPrank(admin);
        vesting.initialize(beneficiary, VESTING_DURATION);
        token.approve(address(vesting), TOTAL_AMOUNT);
        vesting.fund(token, TOTAL_AMOUNT);
        vesting.startVesting();
        vm.stopPrank();
        
        // Move to 25% vested
        vm.warp(block.timestamp + VESTING_DURATION / 4);
        
        // Test pause functionality
        vm.prank(admin);
        vesting.pause();
        
        // Verify claims are blocked
        vm.expectRevert(Vesting.ContractPaused.selector);
        vm.prank(beneficiary);
        vesting.claim();
        
        // Test unpause and claim
        vm.prank(admin);
        vesting.unpause();
        
        vm.prank(beneficiary);
        vesting.claim();
        
        // Verify tokens were claimed
        assertGt(token.balanceOf(beneficiary), 0);
    }
```

Awesome, this approach ensures our vesting contract behaves correctly throughout its entire lifecycle, handling both expected operations and emergency conditions appropriately. Now let's take a quick peek into some best practices I think would be useful when implementing the lifecycle tests. 

## Best practices and Common Pitfalls

#### Test complexity often grows exponentially with contract complexity, so it's good to structure them efficiently

```solidity
contract ComplexLifecycleTest is Test {
    // Break down complex scenarios into smaller, focused tests
    function test_VestingSchedule_LinearVesting() public {
        // Test basic linear vesting
    }
    
    function test_VestingSchedule_WithCliff() public {
        // Test vesting with cliff period
    }
    
    // Use modifiers to enforce test prerequisites
    modifier withFundedContract() {
        _setupFundedState();
        _;
    }
    
    // Parameterize tests for different scenarios
    function test_VestingCalculation(uint256 timeElapsed) public {
        vm.assume(timeElapsed <= vestingDuration);
        // Test calculation with different time periods
    }
}
```

#### Manipulating time is crucial in lifecycle tests.

```solidity
contract TimeAwareLifecycleTest is Test {
    // Define time constants clearly
    uint256 constant DAY = 1 days;
    uint256 constant YEAR = 365 days;
    
    function test_TimeProgression() public {
        // Start from a known timestamp
        vm.warp(1672531200); // Jan 1, 2023
        
        // Use relative time movements
        vm.warp(block.timestamp + 180 days);
        
        // Check time-sensitive calculations
        assertEq(
            vesting.vestedAmount(),
            expectedAmount,
            "Incorrect vesting calculation"
        );
    }
    
    // Test time boundaries
    function test_TimeBoundaries() public {
        // Test at exact boundaries
        vm.warp(vestingStart);
        vm.warp(vestingStart + vestingDuration - 1);
        vm.warp(vestingStart + vestingDuration);
    }
}
```

#### Proper state verification is essential for catching subtle bugs:

```solidity
contract StateVerificationTest is Test {
    // Create a struct for expected state
    struct VestingState {
        uint256 releasedAmount;
        uint256 vestingStage;
        bool isActive;
    }
    
    function verifyState(VestingState memory expected) internal {
        // Comprehensive state verification
        assertEq(
            vesting.releasedAmount(),
            expected.releasedAmount,
            "Released amount mismatch"
        );
        assertEq(
            uint256(vesting.currentStage()),
            expected.vestingStage,
            "Stage mismatch"
        );
        assertEq(
            vesting.isActive(),
            expected.isActive,
            "Active status mismatch"
        );
        
        // Verify invariants
        _verifyInvariants();
    }
    
    function _verifyInvariants() internal {
        // Check fundamental truths that should always hold
        assert(vesting.releasedAmount() <= vesting.totalAmount());
    }
}
```

#### Tests serve as living documentation. Don't be shy to over-document your tests. 

```solidity
/// @title Token Vesting Lifecycle Tests
/// @notice Comprehensive tests for token vesting lifecycle
/// @dev These tests verify the complete contract lifecycle
contract TokenVestingLifecycleTest is Test {

    /// @dev This test progresses through all contract phases
    function test_DetailedLifecycle() public {
        // PHASE 1: Initialization
        /* Detailed explanation of what's being tested and why */
        
        // PHASE 2: Funding
        /* Clear documentation of test progression */
        
        // Clearly document assumptions
        // Document edge cases and why they matter
    }
}
```

- **Time-Related Issues:**
```solidity
// WRONG: Hardcoded timestamps
vm.warp(1672531200);

// RIGHT: Relative time manipulation
vm.warp(block.timestamp + YEAR);
```

- **State Pollution:**
```solidity
// WRONG: Relying on state from previous tests
function test_Second() public {
    // Assumes state from test_First
}

// RIGHT: Each test sets up its own state
function test_Second() public {
    _setupRequiredState();
    // Test logic
}
```

- **Incomplete State Verification:**
```solidity
// WRONG: Partial verification
function test_Claim() public {
    vesting.claim();
    assertEq(token.balanceOf(beneficiary), amount);
}

// RIGHT: Complete state verification
function test_Claim() public {
    vesting.claim();
    verifyState(ExpectedState({
        releasedAmount: amount,
        vestingStage: ACTIVE,
        isActive: true
    }));
}
```

Cool, that's all you have to know to get an essence of what lifecycle testing is and how to implement it. 

Throughout this chapter, we've explored the how to implement lifecycle testing for your protocol. Hopefully you've learned that unit tests verify individual components and integration tests check interactions, lifecycle tests validate the user's and contract's state at every phase. These tests serve as both a safety net and a form of living documentation, helping future developers understand how the contract should evolve over time.

---

*Give yourself a pat on your back if you made it this far* 👏👏.

> I know that's a lot. I recommend you to re-read the chapter at your own pace to get the most out of it. As mentioned earlier, these advanced tests like differential testing, lifecycle tests, etc., are not mandatory to be implemented, but incorporating them will make your auditing very efficient as you'll find most of the bugs hiding in the plain sight. 
> 
> It'll leave the auditors to go deep-in and butcher your code to search for intricate bugs. So it's that additional 1% of the effort that makes quite a big the difference in the securing your codebase. Also, you don't have to implement these tests from day 1. You can always improve your test suite by adding advanced tests post deployment as well. As your protocol accrues more TVL, it gives you a piece of mind and helps you sleep better at nights* 😅. 

Don't go yet, there are more interesting testing patterns like scenario testing, mutation testing are waiting for you. After that we'll also explore formal verification, symbolic testing, branching tree technique and more! See you there 👋

 