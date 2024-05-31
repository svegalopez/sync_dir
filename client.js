const net = require("net");

class Client {
  constructor(serverAddress, serverPort) {
    this.serverAddress = serverAddress;
    this.serverPort = serverPort;
    this.client = new net.Socket();
  }

  connect() {
    this.client.connect(this.serverPort, this.serverAddress, () => {
      console.log("Connected to TCP server");
    });
  }

  sendMessage(message) {
    this.client.write(JSON.stringify(message));
  }

  on(event, callback) {
    this.client.on(event, callback);
  }

  destroy() {
    this.client.destroy();
  }
}

module.exports = Client;
