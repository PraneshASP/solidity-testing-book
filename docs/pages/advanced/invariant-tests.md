
## Invariant Testing

 We just saw what fuzz tests are and how it can be useful. We mentioned that fuzz tests are "stateless", which means that it can test function in isolation. Invariant tests, on the other hand, are "**stateful**". It aims to verify that the entire system behaves correctly under specified conditions and properties that are supposed to always hold true. It ensures that the state of the contract remains consistent and aligned with its expected properties, irrespective of the sequence of operations performed. **An invariant is something that must always be true about the system, no matter how it is used**. For example, the sum of all token balances in a liquidity pool might always need to equal the pool’s reserves.

![](../images/invariant_animation.gif)

Invariant tests are not limited to testing isolated contract methods but rather observes how different functions interact with each other over time, ensuring that the core requirements of the protocol are respected under all circumstances. It’s particularly powerful in the context of DeFi protocols, where interactions between different methods and contracts must consistently respect system-wide invariants.



## Fuzzing vs. Invariant Testing

While both fuzzing and invariant testing are valuable tools in a developer's arsenal, they serve different purposes and have distinct characteristics:

### Fuzzing

Fuzzing is a targeted approach to testing individual functions or methods:

- It focuses on a specific method of a contract, calling it multiple times with randomized inputs.
- The goal is to find edge cases or unexpected behaviors within a single function.
- Fuzzing is more "surgical" in nature, diving deep into the behavior of individual components.

Example of a fuzz test:

```solidity
function testFuzz_Deposit(uint256 amount) public {
    vm.assume(amount > 0 && amount <= token.balanceOf(user));
    vm.prank(user);
    pool.deposit(amount);
    assertEq(pool.balanceOf(user), amount);
}
```

### Invariant Testing

Invariant testing, on the other hand, takes a holistic approach:

- It verifies that certain properties (invariants) of the system remain true under all possible sequences of operations.
- Invariant tests can call multiple functions in random order with random inputs.
- The focus is on maintaining system-wide consistency rather than the behavior of individual functions.

Example of an invariant:

```solidity
function invariant_totalSupplyEqualsSumOfBalances() public {
    uint256 totalSupply = token.totalSupply();
    uint256 sumOfBalances = 0;
    for (uint256 i = 0; i < users.length; i++) {
        sumOfBalances += token.balanceOf(users[i]);
    }
    assertEq(totalSupply, sumOfBalances);
}
```

## Types of Invariant Testing

### Open Invariant Testing

Open invariant testing is the unrestricted form of invariant testing:

- All public and external functions of the contract under test are exposed to the fuzzer.
- The fuzzer can call any function with any arguments in any order.
- This approach can find complex bugs that arise from unexpected interactions between different parts of the system.
- However, it may also generate many unrealistic scenarios that wouldn't occur in real scenarios.


Example setup:
```solidity
contract OpenInvariantTest is Test {
    LendingPool pool;

    function setUp() public {
        pool = new LendingPool();
        targetContract(address(pool));
    }

    function invariant_totalBorrowsLessThanTotalDeposits() public {
        assert(pool.totalBorrows() <= pool.totalDeposits());
    }
}
```

### Constrained Invariant Testing

Constrained invariant testing uses the ***handler pattern*** to restrict the fuzzer's actions:

- Custom handler contracts define a set of actions that the fuzzer can perform.
- This allows for more realistic test scenarios that better reflect actual usage patterns.
- Handlers can incorporate preconditions and bounds on inputs to prevent unrealistic states.
- While more constrained, this approach can still uncover subtle bugs that might be missed by more targeted tests.

![https://pbs.twimg.com/media/FnLxl-zaAAEmLEF?format=png&name=small](https://pbs.twimg.com/media/FnLxl-zaAAEmLEF?format=png&name=small)

Example of a handler for constrained invariant testing:

```solidity
contract LendingPoolHandler {
    LendingPool pool;
    address[10] users;

    constructor(LendingPool _pool, address[10] memory _users) {
        pool = _pool;
        users = _users;
    }

    function deposit(uint256 amount, uint256 userIndex) public {
        amount = bound(amount, 1, 1000 ether);
		userIndex = bound(userIndex, 1, 10);
        address user = users[userIndex];
        pool.deposit{value: amount}(user);
    }

    function borrow(uint256 amount, uint256 userIndex) public {
        amount = bound(amount, 1, 100 ether);
        userIndex = bound(userIndex, 1, 10);
        address user = users[userIndex];
        pool.borrow(amount, user);
    }
}
```

In the above contract you can notice that the handler is exposed to the fuzzer rather than the contract under test. This gives us more precise control over the tests. The handlers can also implement bounds if necessary but its not mandatory. Usually its better to start with bounded tests then slowly transition towards unbounded tests depending on the requirements. 

## Exampls
Okay, now let's look into a practical example where invariant tests can be useful.

We have a simple lending protocol implemented in Solidity below:

```solidity
contract LendingProtocol {
    mapping(address => uint256) public deposits;
    mapping(address => uint256) public borrows;
    IERC20 public token;
    uint256 public constant COLLATERAL_FACTOR = 80; // 80% collateral factor
    uint256 public totalDeposits;
    uint256 public totalBorrows;

    constructor(address _token) {
        token = IERC20(_token);
    }

    function deposit(uint256 amount) external {
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        deposits[msg.sender] += amount;
        totalDeposits += amount;
    }

    function borrow(uint256 amount) external {
        uint256 maxBorrow = (deposits[msg.sender] * COLLATERAL_FACTOR) / 100;
        require(borrows[msg.sender] + amount <= maxBorrow, "Exceeds borrow limit");
        borrows[msg.sender] += amount;
        totalBorrows += amount;
        require(token.transfer(msg.sender, amount), "Transfer failed");
    }

    function repay(uint256 amount) external {
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        uint256 actualRepayment = amount > borrows[msg.sender] ? borrows[msg.sender] : amount;
        borrows[msg.sender] -= actualRepayment;
        totalBorrows -= actualRepayment;
        if (amount > actualRepayment) {
            uint256 excess = amount - actualRepayment;
            deposits[msg.sender] += excess;
            totalDeposits += excess;
        }
    }

    function withdraw(uint256 amount) external {
        require(deposits[msg.sender] > 0, "No deposits");
        uint256 requiredCollateral = (borrows[msg.sender] * 100) / COLLATERAL_FACTOR;
        require(deposits[msg.sender] >= requiredCollateral, "insufficient collateral");
        
        uint256 availableToWithdraw = deposits[msg.sender] - requiredCollateral;
        uint256 actualWithdrawal = amount > availableToWithdraw ? availableToWithdraw : amount;
        
        require(actualWithdrawal > 0, "insufficient funds");
        
        deposits[msg.sender] -= actualWithdrawal;
        totalDeposits -= actualWithdrawal;
        require(token.transfer(msg.sender, actualWithdrawal), "Transfer failed");
    }
}
```

The above contract allows users to deposit ERC20 tokens and borrow against their deposits. Key features include:

- **Deposits**: Users can deposit tokens, increasing their balance in the protocol.
- **Borrowing**: Users can borrow up to 80% (`COLLATERAL_FACTOR`) of their deposited amount.
- **Repayment**: Users can repay their loans, reducing their borrow balance.
- **Withdrawal**: Users can withdraw their deposits, but only if it doesn't leave them undercollateralized.

### Defining Invariants

To ensure the protocol functions correctly, we define the following invariants:

1. **User Collateral Always Sufficient**: A user's deposit should always cover their borrow according to the collateral factor.
2. **Total Deposits Greater Than Total Borrows**: The total amount deposited in the protocol should always be greater than or equal to the total amount borrowed.

Here's the invariant test contract:

```solidity
contract LendingProtocolInvariantTest is Test {
    LendingProtocol public protocol;
    MockERC20 public token;
    Handler public handler;

    function setUp() public {
        token = new MockERC20("Test Token", "TEST");
        protocol = new LendingProtocol(address(token));
        handler = new Handler(address(protocol), address(token));
        targetContract(address(handler));
    }

    function invariant_userCollateralAlwaysSufficient() public {
        address[] memory users = handler.getUserList();
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            uint256 userDeposit = protocol.deposits(user);
            uint256 userBorrow = protocol.borrows(user);

            // If user has any borrows, they must maintain sufficient collateral
            if (userBorrow > 0) {
                uint256 requiredDeposit = (userBorrow * 100) / protocol.COLLATERAL_FACTOR();
                assertGe(
                    userDeposit,
                    requiredDeposit,
                    "INVARIANT_INSUFFICIENT_COLLATERAL"
                );
            }
        }
    }

    function invariant_totalDepositsGreaterThanBorrows() public {
        assertGe(
            protocol.totalDeposits(),
            protocol.totalBorrows(),
            "INVARIANT_DEPOSITS_GT_BORROW"
        );
    }
}
```

In the `setup()` function you can see that we use the `targetContract()` cheatcode to inform the fuzzer to only call the functions defined in the handler contract. If not, then all the contract created in the setup function will be fuzzed which will lead to waste of resources. Similarly you can also use the `excludeContract()` cheatcode according to your usecase. 

#### Handler Contract and Actors

As explained earlier, using handler contract is useful in simulating the real world scenario of the users would interact with the contracts. In this case, users should deposit first before borrowing or withdrawing. Similarly, users should first borrow before trying to repay to make sure the tests mimick real world behaviour in the tests. `Actors` are the different addresses that interact with the system.

> Foundry generates different address for each run during the invariant test. To make sure it's utilized in the tests, we should prank the calls with `msg.sender` in the tests. 

```solidity
contract Handler is Test {
    SimpleLendingProtocol public protocol;
    MockERC20 public token;
    mapping(address => bool) public actors;
    address[] public actorList;

    constructor(address _protocol, address _token) {
        protocol = LendingProtocol(_protocol);
        token = MockERC20(_token);
    }

    function deposit(uint256 amount) public {
        amount = bound(amount, 1, 10e20);
        token.mint(msg.sender, amount);
        vm.startPrank(msg.sender);
        token.approve(address(protocol), type(uint256).max);
        protocol.deposit(amount);
        vm.stopPrank();

        if (!actorList[msg.sender]) {
            actorList[msg.sender] = true;
            actors.push(msg.sender);
        }
    }

    function borrow(uint256 amount) public {
        address actor = msg.sender;
        uint256 maxBorrow = (protocol.deposits(actor) * protocol.COLLATERAL_FACTOR()) / 100;
        if (maxBorrow == 0) return;

        amount = bound(amount, 1, maxBorrow);
        vm.startPrank(actor);
        try protocol.borrow(amount) {
            // Borrow succeeded
        } catch {
            // Ignore failed borrows
        }
        vm.stopPrank();

        if (!actorList[actor]) {
            actorList[actor] = true;
            actors.push(actor);
        }
    }

    function withdraw(uint256 amount) public {
        address actor = msg.sender;
        uint256 currentDeposit = protocol.deposits(actor);
        if (currentDeposit == 0) return;

        amount = bound(amount, 1, currentDeposit);
        vm.prank(actor);
        protocol.withdraw(amount);

        if (!actors[actor]) {
            actors[actor] = true;
            actors.push(actor);
        }
    }

    function repay(uint256 amount) public {
        address actor = msg.sender;
        uint256 currentBorrow = protocol.borrows(actor);
        if (currentBorrow == 0) return;

        amount = bound(amount, 1, currentBorrow);
        token.mint(actor, amount);

        vm.startPrank(actor);
        token.approve(address(protocol), amount);
        protocol.repay(amount);
        vm.stopPrank();

        if (!actorList[actor]) {
            actorList[actor] = true;
            actors.push(actor);
        }
    }

    function getUserList() external view returns (address[] memory) {
        return userList;
    }
}
```
In the `Handler` contract, we maintain a list of users with the `actors` array and `actorList` mapping to track all the users who have interacted with the protocol. When a user performs an action (deposit, borrow, withdraw, repay), they are added to the list if they aren't already present. This allows the invariant tests to iterate over all users to verify that the invariants hold for every one. 

This ensures that the system behaves as expected across multiple user interactions.


Based on our test setup, all the functions in the handler contract will be randomly called by the fuzzer. If  you want to restrict the fuzzer to call specific functions you can do that as well. For example, if you want the fuzzer to ignore the `repay()` method, you can do so via the `targetSelector()` cheatcode.

```solidity
bytes4[] memory selectors = new bytes4[](3);
selectors[0] = Handler.deposit.selector;
selectors[1] = Handler.withdraw.selector;
selectors[2] = Handler.borrow.selector;

targetSelector(FuzzSelector({
    addr: address(handler),
    selectors: selectors
}));
```


### Running the Invariant Tests

Having defined the handlers and invariants, let's go ahead and run the invariant tests.

```
forge t --mc LendingProtocolInvariantTest -vv  
```

We can see that the invariant test failed with the error : `INVARIANT_INSUFFICIENT_COLLATERAL`. This is critical as one of the core invariant has been violated. 
```
[FAIL: <empty revert data>]
	 [Sequence]
        sender=0x00000000000000000000002eA38b54cE5a819AF6 addr=[test/invariant/Invariant.t.sol:Handler]0xF62849F9A0B5Bf2913b396098F7c7019b51A820a calldata=deposit(uint256) args=[268086407878502856564320633721989845494868808503440654 [2.68e53]]
        sender=0x00000000000000000000002eA38b54cE5a819AF6 addr=[test/invariant/Invariant.t.sol:Handler]0xF62849F9A0B5Bf2913b396098F7c7019b51A820a calldata=borrow(uint256) args=[1083181390655043523035 [1.083e21]
        sender=0x0000000000000000000000000000000000657374 addr=[test/invariant/Invariant.t.sol:Handler]0xF62849F9A0B5Bf2913b396098F7c7019b51A820a calldata=deposit(uint256) args=[149284093665934295474410336178711275202335643493951105 [1.492e53]]
        sender=0x00000000000000000000002eA38b54cE5a819AF6 addr=[test/invariant/Invariant.t.sol:Handler]0xF62849F9A0B5Bf2913b396098F7c7019b51A820a calldata=withdraw(uint256) args=[2442579456253310227425442841 [2.442e27]]
 invariant_userCollateralAlwaysSufficient() (runs: 1, calls: 1, reverts: 1)
Logs:
  Error: INVARIANT_INSUFFICIENT_COLLATERAL
  Error: a >= b not satisfied [uint]
    Value a: 262567983659900320649
    Value b: 508481869510300963140
```

The invariant test `invariant_userCollateralAlwaysSufficient()` is designed to ensure that each user's deposit always meets or exceeds the required collateral based on their borrow. The test runs multiple random sequences of user interactions to check this condition.

In this case, the test failed, indicating that the invariant was violated. You can also see that the failure output provides a sequence of function calls that led to the violation.

From the above output, here's the sequence that triggered the bug:

1. **Deposit**: A user deposits an amount.
2. **Borrow**: The same user borrows an amount within their allowed limit.
3. **Deposit**: Another deposit is made (could be by the same or a different user).
4. **Withdraw**: The initial user withdraws an amount.

Let's break down this sequence with some example values to better understand what the error is:

1. **User Deposits 500 ETH**

   - **Deposits**: 500 ETH
   - **Borrows**: 0 ETH
   - **Collateral Factor**: 80%
   - **Max Borrow**: (500 * 80%) = 400 ETH

2. **User Borrows 400 ETH**

   - **Deposits**: 500 ETH
   - **Borrows**: 400 ETH
   - **Required Collateral**: (400 * 100) / 80 = 500 ETH
   - **Available to Withdraw**: 500 - 500 = 0 ETH

3. **User Deposits an Additional 100 ETH**

   - **Deposits**: 600 ETH
   - **Borrows**: 400 ETH
   - **Required Collateral**: (400 * 100) / 80 = 500 ETH
   - **Available to Withdraw**: 600 - 500 = 100 ETH

4. **User Withdraws 200 ETH**

   - **Attempting to Withdraw**: 200 ETH
   - **Available to Withdraw**: 100 ETH
   - **Issue**: The `withdraw` function allows withdrawal without properly checking if it leaves the user undercollateralized.
   - **After Withdrawal**:
     - **Deposits**: 600 - 200 = 400 ETH
     - **Borrows**: 400 ETH
     - **Required Collateral**: (400 * 100) / 80 = 500 ETH
     - **Actual Collateral**: 400 ETH
     - **Collateral Deficit**: 500 - 400 = 100 ETH

The user was able to withdraw more than the available amount, leaving their collateral insufficient to cover their borrow.

The invariant test detected that the user's deposit (`a = 262567983659900320649`) was less than the required collateral (`b = 508481869510300963140`). This violates the invariant that the user's deposit must always be greater than or equal to the required collateral.

Voila! The invariant tests helped us catch the bug in our code. 


### Fixing the Bug

#### Original `withdraw` Function

```solidity
function withdraw(uint256 amount) external {
    require(deposits[msg.sender] > 0, "No deposits");
    uint256 actualWithdrawal = amount > deposits[msg.sender] ? deposits[msg.sender] : amount;
    deposits[msg.sender] -= actualWithdrawal;
    totalDeposits -= actualWithdrawal;
    require(token.transfer(msg.sender, actualWithdrawal), "Transfer failed");
}
```

The function does not check if the withdrawal would leave the user's collateral below the required level to secure their borrow.

#### Fixing the `withdraw` Function

To fix this, we need to modify the `withdraw` function to ensure users cannot withdraw collateral that would leave their loans undercollateralized.

```solidity
function withdraw(uint256 amount) external {
    require(deposits[msg.sender] > 0, "No deposits");
    
    // Calculate the required collateral based on current borrows
    uint256 requiredCollateral = (borrows[msg.sender] * 100) / COLLATERAL_FACTOR;
    require(deposits[msg.sender] >= requiredCollateral, "insufficient collateral");
    
    // Calculate the maximum amount that can be withdrawn
    uint256 availableToWithdraw = deposits[msg.sender] - requiredCollateral;
    uint256 actualWithdrawal = amount > availableToWithdraw ? availableToWithdraw : amount;
    
    require(actualWithdrawal > 0, "insufficient funds");
    
    deposits[msg.sender] -= actualWithdrawal;
    totalDeposits -= actualWithdrawal;
    require(token.transfer(msg.sender, actualWithdrawal), "Transfer failed");
}
```

Before allowing a withdrawal, we calculate the `requiredCollateral` based on the user's current borrow. Then, we determine `availableToWithdraw` by subtracting `requiredCollateral` from the user's deposits. So that the user can only withdraw up to `availableToWithdraw`. This should ensure that  the user maintains sufficient collateral after the withdrawal.

After applying the fix, we rerun the tests and get the following output:

```
Ran 2 tests for test/invariant/LendingInvariantTest.t.sol:LendingInvariantTest
[PASS] invariant_totalDepositsGreaterThanBorrows() (runs: 256, calls: 128000, reverts: 0)
[PASS] invariant_userCollateralAlwaysSufficient() (runs: 256, calls: 128000, reverts: 0)
Suite result: ok. 2 passed; 0 failed; 0 skipped; finished in 70.86s (86.28s CPU time)
```

 

The tests now pass with 0 reverts, confirming that the invariants hold and the bug has been fixed.


:::tip

You can set the `show_metrics` flag to `true` in your foundry config file to see the call metrics of your invariant tests. 
```
[PASS] invariant_totalDepositsGreaterThanBorrows() (runs: 256, calls: 128000, reverts: 0)
| Contract | Selector | Calls | Reverts | Discards |
|----------|----------|-------|---------|----------|
| Handler  | borrow   | 25440 |    0    |     0    |
| Handler  | deposit  | 25753 |    0    |     0    |
| Handler  | repay    | 25653 |    0    |     0    |
| Handler  | withdraw | 25766 |    0    |     0    |
```
You can see the no.of calls to each method in our Handler contract. 
:::

### How the Invariant Test Helped Find the Bug

The invariant test was crucial in detecting the subtle bug in the `withdraw` function. Here's how it helped:

- **Automated Detection**: The invariant test automatically ran numerous sequences of user interactions, simulating real-world usage patterns.
- **Sequence Reproduction**: It provided the exact sequence of actions that led to the invariant violation, making it easier to reproduce and analyze the bug.



## Final Thoughts

This example highlights the importance of invariant testing in smart contract development:

- **Detecting Edge Cases**: Invariant tests can uncover issues that may not be evident through standard unit tests, especially with extreme values or unusual sequences of actions.
- **Ensuring Protocol Safety**: By continuously checking critical conditions, invariant tests help ensure the protocol remains secure under all circumstances.
- **Facilitating Debugging**: Providing detailed logs and sequences aids developers in quickly pinpointing and fixing bugs.

By incorporating invariant testing into the development process, we enhance the robustness and reliability of smart contracts, making them safer for users.


## Resources
- https://mirror.xyz/horsefacts.eth/Jex2YVaO65dda6zEyfM_-DXlXhOWCAoSpOx5PLocYgw
- https://allthingsfuzzy.substack.com/p/creating-invariant-tests-for-an-amm
- https://book.getfoundry.sh/forge/invariant-testing#invariant-testing

