const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const crypto = require("crypto");
const Client = require("./client");
const { readAndEncode } = require("./lib");

// Constants
const TCP_SERVER_ADDRESS = process.env.SERVER_HOST || "localhost";
const TCP_SERVER_PORT = process.env.SERVER_PORT || 3000;
const BLOCK_SIZE = process.env.BLOCK_SIZE || 256;

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
    .on("change", async (filePath) => {
      const changeId = crypto.randomBytes(32).toString("hex");
      const result = await readAndEncode(filePath, BLOCK_SIZE);
      client.sendMessage({
        type: "file_changed",
        filePath,
        changeId,
        checksums: result.checksums,
      });
      fileData.set(changeId, result.data);
      console.log(`File changed: ${filePath} with changeId: ${changeId}`);
    })
    .on("error", (error) => console.error(`Watcher error: ${error}`))
    .on("ready", () => console.log(`Daemon watching directory: ${watchDir}`));

  // Connect to the TCP server and listen for messages
  const client = new Client(TCP_SERVER_ADDRESS, TCP_SERVER_PORT);
  client.connect();
  client.handleMessages(fileData, watchDir, BLOCK_SIZE);

  client.on("error", (error) => {
    console.error("Error connecting to TCP server:", error);
  });

  // Graceful Shutdown (Ctrl+C)
  process.on("SIGINT", async () => {
    console.log("\nStopping daemon...");
    await watcher.close();
    client.destroy();
    console.log("Daemon stopped.");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
