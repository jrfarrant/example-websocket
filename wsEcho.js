// Dependencies:
const pEvent = require('p-event');
const WebSocket = require('ws');

module.exports.handler = async () => {
  // Configure a client websocket connection to an 'echo' server:
  const ws = new WebSocket('wss://echo.websocket.org/', { origin: 'https://websocket.org' });

  // Function to be invoked when a 'connected' event is emitted from the websocket:
  ws.on('open', () => {
    console.info('connected');
    ws.send(Date.now());
  });

  // Function to be invoked when a 'disconnected' event is emitted from the websocket:
  ws.on('close', () => {
    console.info('disconnected');
  });

  // Function to be invoked when a 'message' event is emitted from the websocket:
  ws.on('message', (data) => {
    console.info(`roundtrip time: ${Date.now() - data} ms`);
    setTimeout(() => { ws.send(Date.now()); }, 500);
  });

  try {
    // Use p-event package to await a 'message' event emission:
    const result = await pEvent(ws, 'message');
    console.info(`received: ${result}`);
  } catch (e) {
    console.error(e);
  }

  return { message: 'Completed successfully!' };
};
