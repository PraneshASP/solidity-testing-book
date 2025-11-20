---
layout: docs
---

# Solidity Testing Handbook [A Comprehensive Guide To Smart Contract Testing Methods]


## Introduction

The EVM developer ecosystem has seen remarkable growth in recent years, with newcomer developers reaching unprecedented numbers. This surge in new talent is exciting for the space, but it also brings unique challenges as many of these developers are just starting their programming journey.

![alt text](images/stats.png)

As most smart contracts handle sensitive financial transactions touching user's funds, the combination of inexperienced developers and high-stakes code is concerning. Well experienced developers usually bring a security-first mindset to their coding practices. For newcomers without any prior experience, understanding the intricacies of secure and reliable coding in Solidity can be quite challenging.

This is where this guide comes in. This handbook has been crafted to be a companion in navigating the fundamentals of testing Solidity smart contracts. I understand that there are multiple guides out there, but the resources are scattered. This handbook doesn't dive deep into specific testing pattern, but this should serve as a very good starting point to understand specific testing patterns and best practices. It doesn't stop at the basics tho. This guide also walks you through advanced strategies like mutation testing and the branching tree technique, helping you understand when and how to apply them.

At the end of the day, Solidity smart contracts are just a piece of software. Many protocols rely only on unit tests, or they just have a one large test suite focused on fork testing. But I feel that's not sufficient. The number of attacks on the ecosystem doesn't seem to reduce. Each testing method serves a unique purpose, helping developers uncover vulnerabilities in specific parts of the code. For example, fuzz tests are great for finding edge cases in simple mathematical functions, while symbolic testing shines in complex calculation scenarios.

It's crucial to recognize that not all testing methods fit every project. For instance, invariant tests might be challenging to implement when building on top of other protocols.


## Getting good at testing
Alright, let's talk about getting good at testing in Solidity, kind of like learning to ride a bike. You cannot master it overnight. And this is not a zero-to-hero guide. You just have to keep riding, falling off, and then getting back on again. Testing is the same. You write a test, it goes all wonky, and then you fix it. This is how it works.

Think of your code like a bunch of Lego blocks. Sometimes you think you’ve built the coolest super car, but then you notice it's missing a door or a wheel. That's what bugs in code are like. They're those missing pieces that you only spot when you test. And guess what? Everyone misses a piece now and then. ***Even the best of us!***

## Heads up!
This guide isn't your typical, super-serious, polished-to-perfection kind of thing. It actually started as a bunch of notes I jotted down for myself. It’s more like a casual chat over coffee, sharing what I've learned and what others have shared over time.

We’re going to take this nice and easy. No rush. Testing in Solidity, or any coding really, should be fun, not a headache. 

Ok. Now make yourself a cup of tea and come back. Let's start with the [B A S I C S](./basic/overview).

## Acknowledgments

This handbook wouldn't have been possible without the support of the Ethereum Foundation. Their grant program has made this resource freely available to the solidity developers and security researchers. A huge thanks to them for believing in the importance of accessible, quality educational content for Solidity developers.

![Ethereum Foundation Logo](images/eth-foundation.png)

