import { ConsoleInterceptor } from "./console-patch.js";
import { P2PSignalingClient } from "./p2p-signaling-client.js";

const argsMap = new Map();

const consoleCallback = (method, ...args) => {
  argsMap.set(`${method}::${new Date().toISOString()}`, { ...args });
};

// new ConsoleInterceptor().patch(consoleCallback.bind(this));

export * from "./websocket-connector.js";
export * from "./p2p-connection.js";
export * from "./p2p-signaling-client.js";

const client = new P2PSignalingClient("http://192.168.206.95:3000");

client.connect();

setTimeout(() => {
  client.sendMessage(
    `Hello from P2P Console Viewer Lib after 10 seconds! ${client.currentServerID}`,
  );
}, 10000);
