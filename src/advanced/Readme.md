# Advanced Testing

In the previous chapters we have looked into the basic tests that every project has to implement to build a stronger test suite. Once those tests are implemented, it's time to move on to advanced testing which helps to further boost the confidence before going live. Advanced tests help make sure your contracts are really strong and can handle more complicated situations. These tests look deeper into how your contracts work together, handle different scenarios, and stay reliable. By using advanced testing methods, you can find hidden problems that the basic tests _might have missed_.

**However, it's important to plan these advanced tests carefully. Implementing them can take a lot of time, especially depending on your project's timeline and resources. Finding the right balance between testing and development is crucial. Not every advanced test type is necessary for every project. Depending on what your project focuses on, some tests will be more important than others. So its crucial to set the right priorities.**

For example:
- **End-to-End (E2E) Tests** can be crucial for bridge/layer-2 protocols because they ensure that all parts of the system work together seamlessly.
- **Invariant Tests** can be especially important for DeFi protocols.
- **Differential Tests** could be more useful for math-heavy projects where precise calculations are essential.

### Types:
- [**Invariant Tests:**](./invariant-tests.md) These tests helps ensure that certain important rules always stay true no matter what happens in your system. For example, making sure that the total supply of tokens never changes unexpectedly.
  
- [**Differential Tests:**](./differential-tests.md) Differential testing cross-references multiple implementations of the same function by comparing each one’s output.
  
- [**Lifecycle Tests:**](./lifecycle-tests.md) These tests follow your contracts through all their stages, from when they are first created to when they are updated or closed. They make sure everything works as expected at each step.
  
- [**Scenario Tests:**](./scenario-tests.md) Scenario testing uses real-life situations to see how your contracts handle them. By simulating what might happen in the real world, we can ensure the system behaves as expected.
  
- [**End-to-End (E2E) Tests:**](./e2e-tests.md) As the name suggests, the E2E tests check the whole system end to end. They make sure all components of the system work together correctly, giving the confidence that everything functions as it should when everything is connected.
  
- [**Mutation Tests:**](./mutation-tests.md) Mutation testing makes small changes to the contracts on purpose to see if our tests can catch them. This helps you check if our tests are strong enough to find mistakes.

Each of these advanced tests adds another layer of protection, helping to catch issues that basic tests might have missed. **Although using these advanced testing methods can be powerful and add those additional points before audit, we should be aware that these tests should come only _after the basic tests are implemented_ properly for the system _with atleast 95% coverage._**

> **Note:** While this guide uses Foundry to show advanced testing methods, you can use these techniques with other testing tools too.

**Remember:** Not all advanced tests are needed for every project. Choose the ones that best fit your project's goals and complexity. Planning your testing strategy wisely will help you use your time and resources effectively, ensuring that your contracts are both robust without affecting the time to market.