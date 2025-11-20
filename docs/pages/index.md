---
layout: docs
---

# Introduction

As the backbone of numerous financial applications on the blockchain, writing code in Solidity and challenging at the same time. Our goal, as developers, is not just to write code, but to write code that you can trust – confidently.

In recent times, Solidity has become a hotspot for developers, many of whom are just starting with their programming journey. As most smart contracts handle sensitive financial transactions touching user's funds, that doesn't seem good. Well experienced developers usually bring a security-first mindset to their coding practices. For newcomers without any prior experience, understanding the intricacies of secure and reliable coding in Solidity can be quite challenging. 

This is where this guide comes in. This handbook has been crafted to be a companion in navigating the fundamentals of testing Solidity smart contracts. I understand that there are multiple guides out there, but the resources are scattered. This handbook doesn't dive deep into specific testing pattern, but this should serve as a very good starting point to understand specific testing patterns and best practices. It doesn't stop at the basics tho. This guide also walks you through advanced strategies like mutation testing and the branching tree technique, helping you understand when and how to apply them.

At the end of the day, Solidity smart contracts are just a piece of software. Many protocols rely only on unit tests, or they just have a one large test suite focused on fork testing. But I feel that's not sufficient. The number of attacks on the ecosystem doesn't seem to reduce. Each testing method serves a unique purpose, helping developers uncover vulnerabilities in specific parts of the code. For example, fuzz tests are great for finding edge cases in simple mathematical functions, while symbolic testing shines in complex calculation scenarios.

It's crucial to recognize that not all testing methods fit every project. For instance, invariant tests might be challenging to implement when building on top of other protocols.


## Getting good at testing
Alright, let's talk about getting good at testing in Solidity, kind of like learning to ride a bike. You cannot master it overnight. And this is not a zero-to-hero guide. You just have to keep riding, falling off, and then getting back on again. Testing is the same. You write a test, it goes all wonky, and then you fix it. It's all part of the game.

Think of your code like a bunch of Lego blocks. Sometimes you think you’ve built the coolest spaceship, but then you notice it's missing a door or a wheel. That's what bugs in code are like. They're those missing pieces that you only spot when you test. And guess what? Everyone misses a piece now and then. ***Even the best of us!***

## Heads up!
This guide isn't your typical, super-serious, polished-to-perfection kind of thing. It actually started as a bunch of notes I jotted down for myself. It’s more like a casual chat over coffee, sharing what I've learned and what others have shared over time.

We’re going to take this nice and easy. No rush. Testing in Solidity, or any coding really, should be fun, not a headache. 

Ok. Now make yourself a cup of tea and come back. Let's start with the [B A S I C S](./basic/overview).

 