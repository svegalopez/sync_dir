# File Syncing Daemon

This project is a daemon that syncs files between multiple clients over a TCP connection. It uses a message broker to handle communication between clients.

## How it works

1. Each client runs the daemon and watches a directory for changes.
2. When a change is detected, the client sends a message to the message broker with the changed file's checksums.
3. The message broker broadcasts the message to all connected clients.
4. Each client receives the message and checks if it has the same file with the same checksums. If not, it requests the differences from the client that sent the message.
5. The client that sent the message responds with the differences, which are applied to the file by the requesting client.

## Usage

1. Run the daemon by executing `node main.js <directory-to-watch>`.
2. The daemon will connect to the message broker and start watching the specified directory.
3. When a change is detected, the daemon will sync the changed file with other clients.

## Configuration

- `SERVER_HOST`: The hostname of the message broker. Defaults to `localhost`.
- `SERVER_PORT`: The port number of the message broker. Defaults to `3000`.
- `BLOCK_SIZE`: The block size used for calculating checksums. Defaults to `256`.

## Notes

- This project uses TCP for communication between clients, which means it's not suitable for large-scale deployments.
- The daemon uses a simple checksum-based syncing algorithm, which may not be suitable for all use cases.
