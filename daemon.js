const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const net = require("net");
const crypto = require("crypto");
const bufferCrc32 = require("buffer-crc32");

// Constants
const BLOCK_SIZE = 256; // Block size in bytes
const TCP_SERVER_ADDRESS = process.env.SERVER_HOST || "localhost";
const TCP_SERVER_PORT = process.env.SERVER_PORT || 3000;

// Function to generate checksums for a file
function _generateChecksums(data, blockSize) {
  const checksums = [];
  for (let offset = 0; offset < data.length; offset += blockSize) {
    const block = data.slice(offset, Math.min(offset + blockSize, data.length)); // Get the next block of data

    // Calculate CRC32 checksum for the block
    const crc = bufferCrc32(block).readUInt32BE(0);

    // Calculate MD5 hash for the block
    const md5 = crypto.createHash("md5").update(block).digest("hex");

    checksums.push({ crc, md5, offset }); // Store checksums along with block offset
  }
  return checksums;
}

// Function to read a file and generate checksums
function readAndEncode(filePath, blockSize) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) reject(err);
      const checksums = _generateChecksums(data, blockSize);
      resolve({ checksums, data });
    });
  });
}

// Function to find differences between two sets of checksums
function findDifferences(localChecksums, remoteChecksums) {
  const differences = [];
  remoteChecksums.forEach((remote) => {
    // Iterate through remote checksums
    const localMatch = localChecksums.find(
      (local) => local.crc === remote.crc && local.md5 === remote.md5
    ); // Find a match in local checksums
    if (!localMatch) {
      differences.push(remote); // No match found, so this is a difference
    }
  });
  return differences;
}

// Function to patch a file with differences
// function patchFile(destinationFilePath, differences, blockSize, sourceData) {
//   let forPatching = Buffer.alloc(sourceData.length); // Create a buffer for patching, it will be the same size as source data, because eventually it will be the same

//   fs.readSync(
//     fs.openSync(destinationFilePath, "r"),
//     forPatching,
//     0,
//     forPatching.length,
//     0
//   ); // Read destination data into the forPatching buffer

//   // At this point, forPatching contains the destination data, the patching begins:
//   differences.forEach((diff) => {
//     // Iterate through the differences
//     const start = diff.offset;
//     const end = Math.min(start + blockSize, sourceData.length);
//     sourceData.copy(forPatching, start, start, end); // Copy the correct block from source to new data
//   });

//   fs.writeFileSync(destinationFilePath, forPatching); // Write the patched data to the destination file
// }
function patchFile(destinationFilePath, patches, srcLength) {
  const patchingBuffer = new Buffer.alloc(srcLength);

  // Copy as much as you can fit of the destinationFile contents into the patchingBuffer
  fs.readSync(
    fs.openSync(destinationFilePath, "r"),
    patchingBuffer,
    0,
    patchingBuffer.length,
    0
  );

  // Apply the patches
  console.log("Applying patches: ");
  patches.forEach((patch) => {
    patch.data.copy(patchingBuffer, patch.offset);
  });
  console.log("Patches applied");
  // Log the patched buffer
  console.log(patchingBuffer.toString());

  fs.writeFileSync(destinationFilePath, fileBuffer);
}

// Function to send a message to the TCP server
function sendMessageToServer(message) {
  const client = new net.Socket();
  client.connect(TCP_SERVER_PORT, TCP_SERVER_ADDRESS, () => {
    client.write(JSON.stringify(message));
    client.destroy(); // Close the client after sending the message
  });
}

// Function to handle a message from the TCP server
function handleMessageFromServer(message) {
  const messageType = message.type;
  switch (messageType) {
    case "file_changed":
      const sourceFilePath = message.filePath;
      const sourceChecksums = message.checksums;
      const changeId = message.changeId;
      const destinationFilePath = path.join(
        this.watchDir,
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

            sendMessageToServer({
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
      const _sourceData = this.fileData.get(message.changeId);

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
        patches.push({ data: patch, offset: start });
      });

      console.log("calculated patches: ");
      console.log(JSON.stringify(_patches, null, 2));

      sendMessageToServer({
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
    //     sendMessageToServer({
    //       type: "file_changed",
    //       filePath,
    //       checksums: result.checksums,
    //     });
    //   });
    // })
    .on("change", (filePath) => {
      const changeId = crypto.randomBytes(32).toString("hex");
      readAndEncode(filePath, BLOCK_SIZE).then((result) => {
        sendMessageToServer({
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
  const client = new net.Socket();
  client.connect(TCP_SERVER_PORT, TCP_SERVER_ADDRESS, () => {
    console.log("Connected to TCP server");
  });

  client.on("data", (data) => {
    const message = JSON.parse(data);
    handleMessageFromServer.bind({ fileData, watchDir })(message);
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
