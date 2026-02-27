---
layout: docs
---

# Solidity Testing Handbook [A Comprehensive Guide To Smart Contract Testing Methods]


## Introduction

The EVM developer ecosystem has seen a tremendous growth in recent years, with newcomer developer count keeps increasing rapidly. This surge in new talent is exciting for the space, but it also brings unique challenges as many of these developers are just starting their programming journey.

![alt text](images/stats.png)

As smart contracts handle sensitive financial transactions touching user's funds, the combination of inexperienced developers and high-stakes code is concerning. Well experienced developers usually bring a security-first mindset to their coding practices. For newcomers without any prior experience, understanding the intricacies of secure and reliable coding in Solidity can be quite challenging.

This is where this guide comes in. This handbook has been crafted to be handy in navigating the fundamentals of testing Solidity smart contracts. I understand that there are multiple resources on testing out there, but they're all scattered. This handbook doesn't dive deep into specific testing pattern, but this should serve as a very good starting point to understand testing patterns and best practices. It doesn't stop at the basics tho. This guide also walks you through advanced strategies like mutation testing and the branching tree technique, helping you understand when and how to apply them.

At the end of the day, Solidity smart contracts are just a piece of software. Many protocols rely only on unit tests, or they just have a one large test suite focused on fork testing. But I feel that's not sufficient. The number of attacks on our ecosystem doesn't seem to reduce. Even the protocols that was audited several times, gets drained these days. 

Each testing method serves a unique purpose, helping developers uncover vulnerabilities in specific parts of the code. For example, fuzz tests are great for finding edge cases in simple mathematical functions, while symbolic testing shines in complex calculation scenarios. It's crucial to recognize that not all testing methods fit every project. For instance, invariant tests might be challenging to implement when building on top of other protocols.


## Getting good at testing
Getting good at testing Solidity takes time. You won’t master it overnight, and this isn’t a “zero-to-hero” guide. The real progress comes from writing tests, watching them fail, and fixing what broke.

Think of your code like Lego blocks: everything can look solid until you realize a piece is missing. Tests help you catch those gaps early. And everyone misses something sometimes, even experienced developers.

## Heads up!
This guide isn't your typical, super-serious, polished-to-perfection kind of thing. It actually started as a bunch of notes I jotted down for myself. It’s more like a casual chat over coffee, sharing what I've learned and what others have shared over time.

We’re going to take this nice and easy. No rush. Testing in Solidity, or any coding really, should be fun, not a headache. 

Ok. Now make yourself a cup of tea and come back. Let's start with the [B A S I C S](./basic/overview).

## Acknowledgment

This handbook wouldn't have been possible without the support of the Ethereum Foundation. Their grant program has made this resource freely available to the solidity developers and security researchers. A huge thanks to them for believing in the importance of accessible, quality educational content for Solidity developers.

Special thanks to [engn33r](https://x.com/bl4ckb1rd71), [Daniel VF](https://x.com/danielvf), and [Lucas Manuel](https://x.com/lucasmanuel_eth) for their valuable feedback.

![Ethereum Foundation Logo](images/eth-foundation.png)
