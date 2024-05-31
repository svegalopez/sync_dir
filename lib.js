const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bufferCrc32 = require("buffer-crc32");

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
    console.log(JSON.stringify(patch, null, 2));

    const patchBuffer = Buffer.from(patch.data.data);
    patchBuffer.copy(patchingBuffer, patch.offset);
  });

  console.log("Patches applied");
  // Log the patched buffer
  console.log(patchingBuffer.toString());

  fs.writeFileSync(destinationFilePath, patchingBuffer);
}

module.exports = {
  readAndEncode,
  findDifferences,
  patchFile,
};
