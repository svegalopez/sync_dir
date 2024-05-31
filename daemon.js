const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const crypto = require("crypto");
const Client = require("./client");
const { readAndEncode, findDifferences, patchFile } = require("./lib");

// Constants
const TCP_SERVER_ADDRESS = process.env.SERVER_HOST || "localhost";
const TCP_SERVER_PORT = process.env.SERVER_PORT || 3000;
const BLOCK_SIZE = process.env.BLOCK_SIZE || 256;

// Function to handle a message from the TCP server
function handleMessageFromServer(message, fileData, watchDir) {
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

            client.sendMessage({
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

      client.sendMessage({
        type: "data_response",
        filePath: message.filePath,
        patches: _patches,
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

// Main function
async function main() {
  const fileData = new Map();
  const input = process.argv[2];

  // Check if the input is provided
  if (!input) {
    console.error("Please provide a directory to watch");
    process.exit(1);
  }
  const watchDir = path.resolve(input);

  // Check if the directory exists
  if (!fs.existsSync(watchDir)) {
    console.error(`Directory not found: ${watchDir}`);
    process.exit(1);
  }

  // File Watcher Setup
  const watcher = chokidar.watch(watchDir);

  // Event Handlers
  watcher
    // .on("add", (filePath) => {
    //   readAndEncode(filePath, BLOCK_SIZE).then((result) => {
    //     client.sendMessage({
    //       type: "file_changed",
    //       filePath,
    //       checksums: result.checksums,
    //     });
    //   });
    // })
    .on("change", (filePath) => {
      const changeId = crypto.randomBytes(32).toString("hex");
      readAndEncode(filePath, BLOCK_SIZE).then((result) => {
        client.sendMessage({
          type: "file_changed",
          filePath,
          changeId,
          checksums: result.checksums,
        });
        fileData.set(changeId, result.data);
        // Log
        console.log(`File changed: ${filePath} with changeId: ${changeId}`);
      });
    })
    .on("unlink", (filePath) => console.log(`File deleted: ${filePath}`))
    .on("error", (error) => console.error(`Watcher error: ${error}`))
    .on("ready", () => console.log(`Daemon watching directory: ${watchDir}`));

  // Connect to the TCP server and listen for messages
  const client = new Client(TCP_SERVER_ADDRESS, TCP_SERVER_PORT);
  client.connect();

  client.on("data", (data) => {
    const message = JSON.parse(data);
    handleMessageFromServer(message, fileData, watchDir);
  });

  client.on("error", (error) => {
    console.error("Error connecting to TCP server:", error);
  });

  // Graceful Shutdown (Ctrl+C)
  process.on("SIGINT", () => {
    console.log("\nStopping daemon...");
    watcher.close().then(() => {
      client.destroy(); // Close the client connection
      console.log("Daemon stopped.");
      process.exit(0);
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
