
# Differential Testing 

Differential testing is quite interesting. It's a testing technique where multiple implementations of the same specification are compared against each other. You can think of it as something similar to back-to-back testing or A/B testing from the web2 world. The key goal is to identify differences in behaviours under the same inputs to diagnose the defect in one or more implementations.

In differential testing:

- The implementation in addition to solidity implementation requires to have at least one more other implementation.
- The inputs which are fed to both the implementations are same.
- We compare the output or behavior to check for a difference.
- We would investigate whether the differences are caused by bugs or are acceptable.


Differential testing is particularly beneficial in some scenarios.
- Identifying edge cases for protocols that have a complex / math heavy logic.
- It serves as a form of cross-verification, increasing confidence in the correctness of the contract.

## Example: Computing the Nth Fibonacci Number

To illustrate differential testing, let's consider a simple example of computing the nth Fibonacci number using Solidity and comparing the behaviour against the Rust implementation. By implementing the same algorithm in both languages and comparing the outputs for a range of inputs, we can validate the correctness of our implementations.

### Solidity Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Fibonacci {
    function fib(uint n) public pure returns (uint) {
        require(n >= 0, "Input must be non-negative");
        if (n == 0) return 0;
        uint a = 0;
        uint b = 1;
        for (uint i = 1; i < n; i++) {
            uint c = a + b;
            a = b;
            b = c;
        }
        return b;
    }
}

```

### Rust Implementation

```rust
fn fib(n: u32) -> u32 {
    assert!(n >= 0, "Input must be non-negative");
    if n == 0 {
        return 0;
    }
    let mut a = 0;
    let mut b = 1;
    for _ in 1..n {
        let c = a + b;
        a = b;
        b = c;
    }
    b
}

fn main() {
    let result = fib(10);
    println!("The 10th Fibonacci number is {}", result);
}

```

To test this in Foundry, we can use the `vm.ffi()` cheatcode. It allows developers to call external programs or scripts from within Solidity tests. This feature is incredibly useful for **differential testing**, as it enables us to run arbitrary command to implement advanced and complex testing patterns like this one. 

The `vm.ffi()` cheatcode accepts an array of strings where:

1. The **first element** is the path to the external program or script you want to execute.
2. The **subsequent elements** are the arguments to pass to the program or script.
3. The output of the command is returned as a `bytes` object, which can be decoded into the desired type (e.g., `uint`, `string`). 

Here’s an expanded example of a test file using FFI to compare the Fibonacci computation in Solidity and Rust:

```solidity
// test/FibonacciTest.t.sol
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/Fibonacci.sol";

contract FibonacciTest is Test {
    Fibonacci private fibonacci;
    string private constant RUST_BINARY = "./target/release/fibonacci";

    // Define test cases with expected outputs
    struct TestCase {
        uint input;
        uint expectedOutput;
    }
    
    TestCase[] private testCases;

    /// @notice Sets up the contract before each test.
    function setUp() public {
        fibonacci = new Fibonacci();
        
        // Initialize test cases with known Fibonacci numbers
        testCases.push(TestCase(0, 0));
        testCases.push(TestCase(1, 1));
        testCases.push(TestCase(2, 1));
        testCases.push(TestCase(3, 2));
        testCases.push(TestCase(4, 3));
        testCases.push(TestCase(5, 5));
        testCases.push(TestCase(6, 8));
        testCases.push(TestCase(7, 13));
        testCases.push(TestCase(8, 21));
        testCases.push(TestCase(9, 34));
        testCases.push(TestCase(10, 55));
    }

    /// @notice Tests the Fibonacci implementation using predefined test cases
    function testFibonacciWithTestCases() public {
        for (uint i = 0; i < testCases.length; i++) {
            TestCase memory tc = testCases[i];
            
            // Test Solidity implementation
            uint solResult = fibonacci.fib(tc.input);
            assertEq(
                solResult, 
                tc.expectedOutput, 
                string.concat(
                    "Solidity implementation failed for input: ", 
                    vm.toString(tc.input)
                )
            );

            // Test Rust implementation via FFI
            string[] memory inputs = new string[](2);
            inputs[0] = RUST_BINARY;
            inputs[1] = vm.toString(tc.input);
            
            bytes memory ffiResult = vm.ffi(inputs);
            uint rustResult = abi.decode(ffiResult, (uint));
            
            assertEq(
                rustResult, 
                tc.expectedOutput, 
                string.concat(
                    "Rust implementation failed for input: ", 
                    vm.toString(tc.input)
                )
            );

            // Compare Solidity and Rust implementations
            assertEq(
                solResult, 
                rustResult, 
                string.concat(
                    "Mismatch between Solidity and Rust results for input: ", 
                    vm.toString(tc.input)
                )
            );
        }
    }
}

```

If all outputs match, we gain confidence in the correctness of both implementations. If discrepancies occur, they may indicate a bug in one of the implementations or an issue with integer overflow, especially in languages or environments with different integer size limits.

The above is the simplest form of differential testing. In the fibonacci example, we limited ourself with the set of inputs and outputs which is not much effective. We can make it more effective by exposing the methods to the fuzzer to make sure the implementation is robust enough. This is where **Differential Fuzzing** comes into picture. 

## Differential Fuzz Testing

Differential fuzzing is a testing technique that involves executing different implementations of the same function or logic and comparing the results. This technique allows us to verify that the different implementations are equivalent and behave consistently, even when provided with unexpected, invalid, or random inputs. This is different from normal fuzzing which typically tests a single implementation by feeding it a wide range of inputs and monitoring for unexpected behavior, crashes, or security vulnerabilities. 


For example here's a script from [EnbangWu](https://github.com/EnbangWu/differential-fuzzing/blob/main/Test/DiffFixedPointTest.sol) to test different widely used solidity math libraries In this project, in which they performed differential fuzzing on different fixed-point libraries (OpenZeppelin, Solmate, Solady and prb-math). they found broad compatibility among these libraries, with some differences in handling edge cases and gas efficiency.

```solidity
function test_diffMulDivUp(uint256 x, uint256 y, uint256 z) public {
        if (y > 1) {
            x = x % ((type(uint256).max / y) + 1);
        }
        if (z > 0) { // assume that the divisor is not zero
        uint256 ozResult = instance.OzMulDivUp(x, y, z);
        uint256 soladyResult = instance.soladyMulDivUp(x, y, z);
        uint256 solmateResult = instance.solmateMulDivUp(x, y, z);
        require(
            ozResult == soladyResult && soladyResult == solmateResult
        );
    }
    }
    function test_diffMulWadUp(uint256 x, uint256 y) public {
        if (y > 1) {
            x = x % ((type(uint256).max / y) + 1);
        }
        uint256 solmateResult = instance.solmateMulWadUp(x, y);
        uint256 soladyResult = instance.soladyMulWadUp(x, y);
        require(
            solmateResult == soladyResult
        );
    }
```

It helps verify the correctness as well as gas efficiency of the libraries.

| Function Name | OpenZeppelin | Solady | Solmate | PRB-Math |
|---------------|--------------|--------|---------|----------|
| `log2`        | 677          | 546    | N/A     | N/A      |
| `log2Up`      | 796          | 638    | N/A     | N/A      |
| `mulDivDown`  | 674          | 504    | 500     | 581      |
| `mulDivUp`    | 809          | 507    | 526     | N/A      |
| `sqrt`        | 1146         | 683    | 685     | 977      |
| `divWadUp`    | N/A          | 500    | 525     | N/A      |
| `mulWadUp`    | N/A          | 519    | 525     | N/A      |


## Things to keep in mind:
- It is important that same datatypes are used across implementations to avoid discrepancies
- Keep in mind the boundary conditions and edge cases in your inputs.
- Keep an eye out for exceptions, not just the comparison of outputs but also any reverts or any other odd behavior. 
- Testing using math heavy/complex functions this technique should be sufficient rather than testing all the methods. 

## Conclusion

Differential testing is a powerful technique for enhancing the reliability and security of Solidity smart contracts. As it compares multiple implementations of the same functionality, developers can easily spot bugs that might have gone unnoticed by basic tests. When combined with fuzz testing, this approach becomes even more robust, automatically exploring a wide range of inputs and conditions.

In the high-stakes environment of smart contracts, employing differential testing on top of other tests contributes significantly to building trustworthy and secure protocols. As our ecosystem continues to grow, integrating these testing practices will be crucial for solidity developers aiming to deliver robust and reliable smart contracts.

## References

- [VRGDA Differential Testing by transmissions11](https://github.com/transmissions11/VRGDAs/tree/master/test/correctness/python)
- [Differential Fuzzing Report by Enbang Wu](https://github.com/EnbangWu/differential-fuzzing/blob/main/report.md)
- [Verifying the correctness of Solidity Merkle Tree implementation](https://github.com/dmfxyz/murky/tree/main/differential_testing)

