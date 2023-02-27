const launchdarkly = require('launchdarkly-node-server-sdk');

/*
  Wraps multiple LDClient into a single wrapped object. You do
  not need to know which flag goes with which project, but you *do*
  need to know how duplicate flag keys are processed in order
  to make sure you're not evaluating a flag with the same name
  in a different project.
*/

class MergedLDClient  {
  constructor() {
    this.clientProjectA = null;
    this.clientProjectB = null;
  }

  async initialize() {
    this.clientProjectA = await launchdarkly.init('sdk-123');
    this.clientProjectB = await launchdarkly.init('sdk-456');
    
    // This part is IMPORTANT!!!
    // If you don't add an error listener, the try/catch 
    // when evaluating the variation will not work. This happens because 
    // we check for error listeners when a flag is not found, otherwise 
    // send the error to whatever logger is configured: 
    //
    // https://github.com/launchdarkly/node-server-sdk/blob/main/index.js#L30
    //
    this.clientProjectA.on('error', e => { throw new Error(e) });
    this.clientProjectB.on('error', e => { throw new Error(e) });

    // Not necessary, adding names for illustrative purposes below
    this.clientProjectA.name = 'Project A'
    this.clientProjectB.name = 'Project B'

    // You can store an arbitrary number of clients here, or even create
    // the list dynamically. The important thing is to store them in some
    // kind of iterable data structure
    this.clients = [ this.clientProjectA, this.clientProjectB ];
  }

  async waitForInitialization() {
    await this.initialize();
    await Promise.all(this.clients.map(c => c.waitForInitialization()));
    return this;
  }

  async variation(flagKey, context, fallback) {
    let error = null;
    let evaluation = null;

    for (const client of this.clients) {
      console.log('Checking client for:', client.name);
      error = null; // Reset the error if there's another client to try
      try {
        evaluation = await client.variation(flagKey, context, fallback);
      } catch(err) {
        // An error here will *usually* mean that a flag was not found in that client's project/env
        // It will still return the fallback value in this case, so we need
        // to have a way to break the loop in case a valid flag value *is* found.
        // However, you should still handle errors appropriately in a more general
        // way (outside the scope of this example)
        error = err;
      }

      if (!error) break; // If there's no error, this means a flag was found; break the loop
    }

    if (error) {
      return error;
    }

    return evaluation;
  }
}

//  Example usage:
const ctx = { key: 123 };
const ldclient = new MergedLDClient();

ldclient.waitForInitialization()
  .then(async wrapper => {
    const flagA = await wrapper.variation('flag-a', ctx, 'DEFAULT');
    console.log('FLAG A:', flagA);
    
    const flagB = await wrapper.variation('flag-b', ctx, 'DEFAULT');
    console.log('FLAG B:', flagB);
  }).catch(err => {
    console.error(err);
  })

// Another example:
// Suppose in this case that both projects in use have a
// flag with a key of 'my-feature'. In this case, the return value
// would depend on the order of the array and might not work as expected
const thisIsConfusing = new MergedLDClient();
thisIsConfusing.waitForInitialization()
  .then(async wrapper => {
    // This would return the evaluation from Project A since it
    // is first in the this.clients array
    const myFeature = await wrapper.variation('my-feature', ctx, false);
    console.log('MY FEATURE:', myFeature);
  })