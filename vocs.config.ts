import { defineConfig } from 'vocs'

export default defineConfig({
  title: 'Smart Contract Testing Handbook',
  sidebar: [
    { text: 'Introduction', link: '/' },
    {
      text: 'Basic Testing',
      items: [
        { text: 'Overview', link: '/basic/overview'},
        { text: 'Unit tests', link: '/basic/unit-tests' },
        { text: 'Integration tests', link: '/basic/integration-tests' },
        { text: 'Fork tests', link: '/basic/fork-tests' },
        { text: 'Fuzz Tests', link: '/basic/fuzz-tests' },
      ],
    },
    {
      text: 'Advanced Testing',
      items: [
        { text: 'Overview', link: '/advanced/overview' },
        { text: 'Invariant Tests', link: '/advanced/invariant-tests' },
        { text: 'Differential Tests', link: '/advanced/differential-tests' },
        { text: 'Lifecycle Tests', link: '/advanced/lifecycle-tests' },
        {
          text: 'Scenario Tests',link: '/advanced/scenario-tests',
          items: [
            
            { text: 'Building a scenario test runner', link: '/advanced/scenario-test-runner' },
          ],
        },
        { text: 'Mutation Tests', link: '/advanced/mutation-tests' },
      ],
    },
    { text: 'Formal verification', link: '/formal-verification' },
    { text: 'Symbolic Testing', link: '/symbolic-testing' },
    { text: 'Branching Tree Technique', link: '/branching-tree-technique' },
    { text: 'Swiss Cheese Method', link: '/swiss-cheese' },
  ],
   theme: { 
    colorScheme: 'dark'
  },
})
