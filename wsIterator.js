// Dependencies:
const moment = require('moment');
const pEvent = require('p-event');
const retry = require('async-retry');
const WebSocket = require('ws');

const timeoutSeconds = 10; // Will be pulled from the actionProviderSettings for the order in the live system, note to make sure that serverless.yml function timeout is at least this long

module.exports.handler = async () => {
  try {
    const startTime = moment(); // Set a startTime so that we can stop retries after the timeoutSeconds regardless of number of attempts
    await retry(async (bail, attempt) => {
      if (moment().diff(startTime, 'seconds') >= timeoutSeconds) { return null; } // Stop retrying if we've gone beyond timeoutSeconds
      console.info(`Attempt ${attempt}`); // Starts at 1 and increments with each error or rejected promise

      const ws = new WebSocket('wss://echo.websocket.org/', { origin: 'https://websocket.org', handshakeTimeout: 3000 }); // Echo server will be replaced by ICS websocket server

      ws.on('open', () => { console.info('Connected'); }); // For logging purposes only
      ws.on('close', () => { console.info('Disconnected'); }); // For logging purposes only
      ws.on('message', (data) => { console.info(`Message: ${data}`); }); // For logging purposes only

      await pEvent(ws, 'open'); // Wait until the socket connection is open before sending anything to it - not required for ICS since we will only be listening to events
      ws.send(Date.now()); // Expect the unix timestamp to be echoed by the server
      ws.send(Date.now()); // Expect the unix timestamp to be echoed by the server
      ws.send('complete'); // Receipt of this event will exit the async iterator

      const asyncIterator = pEvent.iterator(ws, 'message', { rejectionEvents: ['close'] }); // Listen for events until a 'close' or 'complete' is received. If 'close' then reconnection will be attempted
      for await (const data of asyncIterator) { // Need to understand why the eslint airbnb style guide doesn't cover this
        // Business logic for state-flow management to be inserted here (i.e. update the order object when fuel starts flowing)
        if (data === 'complete') { return null; } // Exit the iterator when specific events are received, for example in the real system these will be transaction-complete, transaction-cancelled, transaction-failed
      }
      return null;
    }, {
      retries: 10, // Enough attempts for a timeout up to lambda limit of 15min
      factor: 2, // Progressive back-off, roughly 2sec >> 4sec >> 8sec >> 16sec >> 32sec >> 64sec >> 124sec >> 256sec >> 512sec
    });
  } catch (e) {
    console.error(e);
  }
  return { message: 'Completed successfully!' };
};

// Tested: wss url is incorrect or unavailable - script retries up to the timeout as expected
// Tested: socket is closed before a completion event is received - script retries up to the timeout as expected
// Tested: event sent after 'completion' - script ignores anything after 'completion' as expected
