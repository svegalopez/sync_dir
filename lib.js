const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bufferCrc32 = require("buffer-crc32");

// Function to generate checksums for a file
function _generateChecksums(data, blockSize) {
  console.log("Generating checksums", data.length, blockSize);
  const checksums = [];
  const blocks = [];
  for (let offset = 0; offset < data.length; offset += blockSize) {
    const toEnd = Math.min(offset + blockSize, data.length);
    const block = data.slice(offset, toEnd); // Get the next block of data
    blocks.push(block.toString()); // Store the block for debugging
    const crc = bufferCrc32(block).readUInt32BE(0);
    const md5 = crypto.createHash("md5").update(block).digest("hex");
    checksums.push({ crc, md5, offset }); // Store checksums along with block offset
  }
  console.log(blocks);
  return { checksums, blocks };
}

// Function to read a file and generate checksums
function readAndEncode(filePath, blockSize) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) reject(err);
      const { checksums, blocks } = _generateChecksums(data, blockSize);
      resolve({ checksums, data, blocks });
    });
  });
}

// srcBlocks and destBlocks are only for debugging during development
function findDifferences(srcChecksums, srcBlocks, destChecksums, destBlocks) {
  const differences = [];

  for (let i = 0; i < destChecksums.length; i++) {
    const destCS = destChecksums[i];
    const srcMatch = srcChecksums.find(
      (sourceCS) => sourceCS.crc === destCS.crc && sourceCS.md5 === destCS.md5
    );
    if (!srcMatch) {
      console.log(destBlocks[i].toString());
      console.log("======mismatch========");
      console.log(srcBlocks[i].toString());
      differences.push(destCS); // No match found, so this is a difference
    }
  }
  console.log("Total checksums locally: " + srcChecksums.length);
  console.log("Differences found: " + differences.length);
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
