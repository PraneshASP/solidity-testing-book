# Basic Testing

 Basic tests are the crucial to have tests for all contracts. These tests should go hand in hand with feature development. By including these tests early, you can identify and address issues promptly, saving time and effort in the long run. 

### Types:
- [**Unit Tests:**](./unit-tests.md) These are the most fundamental type of tests where you check individual functions or components in isolation. They are quick to run and help in identifying the smallest of issues which might be overlooked otherwise.

- [**Integration Tests:**](./integration-tests.md) These tests check how different parts of your application work together. They are crucial for ensuring that the combination of various components or functions in your codebase interact as expected.

- [**Fork Tests:**](./fork-tests.md) Fork testing involves creating a fork of the network and then deploying your contracts to test in an environment that closely mimics the on-chain network. This helps in understanding how the contracts will behave under real-world conditions.
  
- [**Fuzz Tests:**](./fuzz-tests.md) In fuzz testing, you input random, invalid, or unexpected data to your contracts and observe how they handle such inputs. This type of testing is excellent for discovering vulnerabilities and ensuring your contracts can handle unexpected or incorrect inputs gracefully.

Remember, each type of test serves a unique purpose and contributes to building robust and secure core. **These tests can help uncover approximately 90% of potential issues in your code if implemented properly.**



> Note: I'll be using Foundry for demonstrating the testing strategies, but you can apply them irrespective of the framework. 
