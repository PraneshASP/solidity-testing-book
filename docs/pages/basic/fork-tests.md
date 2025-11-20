# Fork tests

Fork tests are very similar to Integration tests. Fork tests ensure that our contracts works together as expected but in a live environment without or less mocking. This helps us mimic the behavior of the smart contracts post deployment, helping us catch any unexpected behavior. 

While mocks can help you test basic interactions quickly, they often don’t capture real-world behavior, meaning critical bugs can slip through unnoticed. This is where fork tests come in.

![](../images/fork-tests.png)

In this chapter, we'll walk through a simple example of how fork tests can be helpful. For this example, we can consider a simple `LiquidityAdder` contract that has a function to add liquidity. 

```solidity
contract LiquidityAdder {
    IUniswapV2Router02 public uniswapRouter;

    constructor(address _uniswapRouter) {
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired
    ) external returns (uint amountA, uint amountB, uint liquidity) {
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountADesired);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountBDesired);

        IERC20(tokenA).approve(address(uniswapRouter), amountADesired);
        IERC20(tokenB).approve(address(uniswapRouter), amountBDesired);

        return uniswapRouter.addLiquidity(
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            0,
            0,
            msg.sender,
            block.timestamp
        );
    }
}
```

The function `addLiquidity()` in the above contract just pulls the tokens from the user and adds liquidity to the uniswap v2 pool. Let's add a unit test for the above method.
```solidity
contract LiquidityAdderTest is Test {
    LiquidityAdder liquidityAdder;
    address constant UNISWAP_ROUTER = address(0xdeadbeef);

    function setUp() public {
        liquidityAdder = new LiquidityAdder(UNISWAP_ROUTER);
    }

    function testAddLiquidityMock() public {
        address tokenA = address(0x1);
        address tokenB = address(0x2);
        
        // Mock token transfers
        vm.mockCall(
            tokenA,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );
        vm.mockCall(
            tokenB,
            abi.encodeWithSelector(IERC20.transferFrom.selector),
            abi.encode(true)
        );

        // Mock the addLiquidity function call
        vm.mockCall(
            UNISWAP_ROUTER,
            abi.encodeWithSelector(IUniswapV2Router02.addLiquidity.selector),
            abi.encode(1000, 1000, 1000)
        );
        
        (uint amountA, uint amountB, uint liquidity) = liquidityAdder.addLiquidity(tokenA, tokenB, 1000, 1000);
        
        assertEq(amountA, 1000);
        assertEq(amountB, 1000);
        assertEq(liquidity, 1000);
    }
}
```
When you run the above test it passes. Voila! But does it actually validate that the logic works onchain after deploying the contracts? To make sure it works, let's implement a fork test with real mainnet address without any mocks. 

```solidity
contract LiquidityAdderForkTest is Test {
    LiquidityAdder liquidityAdder;
    address constant UNISWAP_ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant TOKEN_WHALE = 0x8EB8a3b98659Cce290402893d0123abb75E3ab28;

    function setUp() public {
        // Fork Ethereum mainnet
        vm.createSelectFork("https://rpc.flashbots.net");
        liquidityAdder = new LiquidityAdder(UNISWAP_ROUTER);
    }

    function testAddLiquidityFork() public {

        vm.startPrank(TOKEN_WHALE);
        IERC20(USDC).approve(address(liquidityAdder), 1000e6);
        IERC20(WETH).approve(address(liquidityAdder), 1 ether);

        (uint amountA, uint amountB, uint liquidity) = liquidityAdder.addLiquidity(USDC, WETH, 1000e6, 1 ether);
    }
```

When you run the above test, you can see it fails with the following error:
```logs
    │   │   ├─ [8384] 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48::transferFrom(LiquidityAdder: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc, 1000000000 [1e9])
    │   │   │   ├─ [7573] 0x43506849D7C04F9138D1A2050bbF3A0c054402dd::transferFrom(LiquidityAdder: [0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f], 0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc, 1000000000 [1e9]) [delegatecall]
    │   │   │   │   └─ ← [Revert] revert: ERC20: transfer amount exceeds allowance
    │   │   │   └─ ← [Revert] revert: ERC20: transfer amount exceeds allowance
    │   │   └─ ← [Revert] revert: TransferHelper: TRANSFER_FROM_FAILED
    │   └─ ← [Revert] revert: TransferHelper: TRANSFER_FROM_FAILED
    └─ ← [Revert] revert: TransferHelper: TRANSFER_FROM_FAILED
```

You might be surprised to find that it fails! The error message indicates that the Uniswap router reverted the transaction. What happened?

The issue is in our `LiquidityAdder` contract. We're transferring tokens to the contract itself, but we never approved the Uniswap router to spend these tokens on behalf of the contract. The mock test didn't catch this because we mocked all the calls, but the fork test revealed the bug. We can see how fork tests can be useful even if we have unit/integration tests in place. 

## Some foundry tips for fork tests
- `createSelectFork()` cheatcode helps you to create and make the fork active.
- `createFork()` just helps you to create forks. Both the cheatcodes return a `forkId`.
- Use `selectFork(forkId)`  to switch between chains during your fork tests. Remember to use `vm.makePersistent()` cheatcode to persist deployment across the selected forks. 
- To make the fork tests faster, pass the block number when creating the fork next to the URL param. 
- Use tools like [mesc](https://github.com/paradigmxyz/mesc/tree/main/cli) to automatically fetch the RPC url in your tests.
 For example:
 ```solidity
 
    function fetchRpcUrlFromMesc(string memory networkName) internal returns (string memory url) {
        string[] memory inputs = new string[](3);
        inputs[0] = "mesc";
        inputs[1] = "url";
        inputs[2] = networkName;

        bytes memory res = vm.ffi(inputs);
        url = string(res);
    }

    function setUp() public {
        string memory network = "avax-c-chain";
        uint256 cchainForkId = vm.createSelectFork(fetchRpcUrlFromMesc(network), 41022344);
        network = "eth-mainnet";
        uint256 mainnetForkId = vm.createSelectFork(fetchRpcUrlFromMesc(network), 19120056);
        // Do something
     }
 ```

:::tip
You can find more foundry related tips and techniques in my blog post [here](https://flawsomedev.com/blog/foundry-tips-and-tricks).
:::

## Do we even need integration tests?
Now you might ask since mocking is dangerous and error-prone do we even need integration tests? The answer is it depends. The example we saw is quite basic. For complex protocol, single function might interact with multiple different contracts (both internal and external). In such cases, integration tests help us carefully curate tests to identify edge cases in different interactions. Also integration tests are fast. So yes, in most cases integration tests provides value.  

For some protocols, integration tests might not be the most effective approach, especially when dealing with a single contract that primarily interacts with external protocols. On the other hand, for protocols that don't rely on external contract calls, fork tests may not add much value. 

Therefore, it's important to tailor the test suite to the specific needs of the protocol, by focusing on what makes sense for each scenario. It provides a much higher level of confidence before deploying your contracts to mainnet.
   
## Recap
So far we've looked into unit tests, integration tests and fork tests. Each method is all useful in its own aspect. When implemented correctly most bugs can be found with these tests. By having these three types of tests are sufficient enough to make the test suite strong enough against attacks for very basic contracts that doesn't do any crazy stuff. 
