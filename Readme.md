# File Syncing Daemon

This project is a daemon that syncs files between multiple clients over a TCP connection. It uses a message broker to handle communication between clients.

## How it works

1. Each client runs the daemon and watches a directory for changes.
2. When a change is detected, the client sends a message to the message broker with the changed file's weak checksums.
3. The message broker broadcasts the message to all connected clients.
4. Each client receives the message and checks the weak checksums for matches in their version of the file. If the weak checksum matches, then a strong checksum is requested.
   At this point, the differences are calculated and the patches are requested.
5. The client that triggered the original change sends the patches over the network and the destination file is synced.
## Usage

1. Run the daemon by executing `node main.js <directory-to-watch>`.
2. The daemon will connect to the message broker and start watching the specified directory.
3. When a change is detected, the daemon will sync the changed file with other clients.

## Configuration

- `SERVER_HOST`: The hostname of the message broker. Defaults to `localhost`.
- `SERVER_PORT`: The port number of the message broker. Defaults to `3000`.
- `BLOCK_SIZE`: The block size used for calculating checksums. Defaults to `256`.
