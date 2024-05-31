const net = require("net");
const path = require("path");
const { readAndEncode, findDifferences, patchFile } = require("./lib");

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

  handleMessages(fileData, watchDir, BLOCK_SIZE) {
    this.client.on("data", (data) => {
      this._handleMessageFromServer(data, fileData, watchDir, BLOCK_SIZE);
    });
  }

  _handleMessageFromServer(data, fileData, watchDir, BLOCK_SIZE) {
    const message = JSON.parse(data);
    const messageType = message.type;
    switch (messageType) {
      case "file_changed":
        const sourceFilePath = message.filePath;
        const sourceChecksums = message.checksums;
        const changeId = message.changeId;
        const destinationFilePath = path.join(
          watchDir,
          path.basename(sourceFilePath)
        );
        readAndEncode(destinationFilePath, BLOCK_SIZE).then(
          (destinationResult) => {
            const differences = findDifferences(
              destinationResult.checksums,
              sourceChecksums
            );
            if (differences.length > 0) {
              console.log(`Differences found for ${sourceFilePath}`);
              console.log(JSON.stringify(differences, null, 2));

              this.sendMessage({
                type: "data_request",
                filePath: destinationFilePath,
                differences,
                changeId,
              });

              // Log message sent
              console.log(
                `Data request sent for ${destinationFilePath} and changeId: ${changeId}`
              );
            }
          }
        );
        break;
      case "data_request":
        const _sourceData = fileData.get(message.changeId);

        console.log(`Data request received for ${message.filePath}`);
        console.log(_sourceData);

        if (!_sourceData) {
          // This will return early in clients that did not make the source change
          return;
        }

        const differences = message.differences;
        const _patches = [];
        differences.forEach((diff) => {
          const start = diff.offset;
          const end = Math.min(start + BLOCK_SIZE, _sourceData.length);
          const patch = _sourceData.slice(start, end);
          _patches.push({ data: patch, offset: start });
        });

        console.log("calculated patches: ");
        console.log(JSON.stringify(_patches, null, 2));

        this.sendMessage({
          type: "data_response",
          filePath: message.filePath,
          patches: _patches,
          sourceLength: _sourceData.length,
        });

        // Log message sent
        console.log(`Data response sent for ${message.filePath}`);
        break;
      case "data_response":
        console.log(
          `Data response received (received patches) for ${message.filePath}`
        );

        const patches = message.patches;
        const srcLength = message.sourceLength;
        patchFile(message.filePath, patches, srcLength);
        break;
    }
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
