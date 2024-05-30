# File Syncer

This is a file synchronization program that syncs files over the network.

## Installation

To use this program, you need to have Node.js installed. You can download it from the official website: [Node.js](https://nodejs.org/)

## Usage

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/your-repo.git
   ```

2. Install the dependencies:

   ```bash
   cd your-repo
   npm install
   ```

3. Start the program:

   ```bash
   node sync.js /path/to/directory
   ```

   Replace `/path/to/directory` with the path to the directory you want to sync.

4. The program will start watching the directory for changes. Whenever a file is added or modified, it will calculate the checksums for the file and send them to the server. If there are differences between the local and remote checksums, the program will request the data from the server and patch the file.

## Configuration

You can configure the program by modifying the following constants in the code:

- `BLOCK_SIZE`: The block size in bytes used for calculating checksums. Default is 256.
- `TCP_SERVER_ADDRESS`: The address of the TCP server. Default is "localhost".
- `TCP_SERVER_PORT`: The port number of the TCP server. Default is 3000.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
