# Fuzz tests

As mentioned in the previous section, unit, integration and fork tests are sufficient enough for most protocols to get a decent enough test suite that helps find most of the low hanging bugs. However, there are times when they might not catch every possible bug, especially in complex smart contracts that has functions that involve heavy math. 

While the basic tests can check the obvious scenarios, they might miss unexpected edge cases. What happens if someone inputs a number that's way larger than you anticipated? Or a negative number when only positives make sense?

This is where fuzz tests come in handy. Fuzz testing involves bombarding your functions with a wide range of random, unexpected inputs to see how they react. It's like throwing everything but the kitchen sink at your code to ensure it can handle anything that comes its way.


## Types:
There are 2 types of fuzzing. 
- Stateful
- Stateless

**Stateless** tests are the basic ones. They don't keep track of the state or the sequence of the calls, so they're fast. 

**Stateful** fuzzing are also called **invariant tests** as they make sure the defined invariant holds despite calling multiple methods in random sequence several times. We'll look into Invariant tests in the next chapter. Currently we focus on Stateless fuzz tests. 

## Example:

Let's look into a simple example to demonstrate how to setup fuzz tests using Foundry and how it can be beneficial in finding hidden bugs.


From the above example, we can see how fuzzing can be really helpful in finding bugs that are not caught by our other tests. 


### Useful resources:
- [Exploiting precision loss using Fuzz testing](https://dacian.me/exploiting-precision-loss-via-fuzz-testing)
