const launchdarkly = require('launchdarkly-node-server-sdk');

/*
  Wraps multiple raw LDClient objects, which are accessed
  via "namespaces". In this model, you still need to know
  which project (client) a given flag is in. To use it, you 
  just call variation or whatever other method on the client
  itself. Examples below.
*/

class NamespacedLDClient  {
  constructor() {
    this.clientProjectA = null;
    this.clientProjectB = null;
  }

  async initialize() {
    this.clientProjectA = launchdarkly.init('sdk-123');
    this.clientProjectB = launchdarkly.init('sdk-456');
  }

  async waitForInitialization() {
    await this.initialize();

    await this.clientProjectA.waitForInitialization();
    await this.clientProjectB.waitForInitialization();

    return this;
  }
}

// Example usage:
const ctx = { key: 123 };
const ldclient = new NamespacedLDClient();

ldclient.waitForInitialization()
  .then(async wrapper => {
    const flagA = await wrapper.clientProjectA.variation('flag-a', ctx, false);
    console.log('FLAG A:', flagA);
    
    const flagB = await wrapper.clientProjectB.variation('flag-b', ctx, false);
    console.log('FLAG B:', flagB);
  }).catch(err => {
    console.error(err);
  })

