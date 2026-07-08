#!/usr/bin/env node
/**
 * Download the CloudDrive2 gRPC proto file.
 * Usage: node download-proto.cjs
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const PROTO_URL = 'https://raw.githubusercontent.com/cloud-fs/cloud-fs-protobuf/master/clouddrive.proto';
const OUTPUT_PATH = path.join(__dirname, 'clouddrive.proto');

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  // If proto already exists, skip
  if (fs.existsSync(OUTPUT_PATH)) {
    const stats = fs.statSync(OUTPUT_PATH);
    if (stats.size > 1000) {
      console.log('clouddrive.proto already exists, skipping download.');
      return;
    }
  }

  console.log('Downloading clouddrive.proto...');
  try {
    const content = await download(PROTO_URL);
    fs.writeFileSync(OUTPUT_PATH, content, 'utf-8');
    console.log(`Saved to ${OUTPUT_PATH} (${content.length} bytes)`);
  } catch (err) {
    console.error('Failed to download proto file:', err.message);
    // Try alternative URL
    try {
      const altUrl = 'https://www.clouddrive2.com/api/clouddrive.proto';
      console.log('Trying alternative URL:', altUrl);
      const content = await download(altUrl);
      fs.writeFileSync(OUTPUT_PATH, content, 'utf-8');
      console.log(`Saved to ${OUTPUT_PATH} (${content.length} bytes)`);
    } catch (err2) {
      console.error('Alternative URL also failed:', err2.message);
      console.error('Please manually download clouddrive.proto and place it in the project root.');
      process.exit(1);
    }
  }
}

main();
