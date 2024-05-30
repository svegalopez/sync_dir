const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");

async function main() {
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
    .on("add", (filePath) => console.log(`File added: ${filePath}`))
    .on("change", (filePath) => console.log(`File changed: ${filePath}`))
    .on("unlink", (filePath) => console.log(`File deleted: ${filePath}`))
    .on("error", (error) => console.error(`Watcher error: ${error}`))
    .on("ready", () => console.log(`Daemon watching directory: ${watchDir}`));

  // 4. Graceful Shutdown (Ctrl+C)
  process.on("SIGINT", () => {
    console.log("\nStopping daemon...");
    watcher.close().then(() => {
      console.log("Daemon stopped.");
      process.exit(0);
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
