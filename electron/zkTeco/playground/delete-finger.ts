import { createRequire } from 'module';
const require = createRequire(process.cwd() + '/');
const ZKLib = require('zklib-ts');

async function main() {
  const zk = new ZKLib('192.168.1.5', 4370, 10000, 4000);
  console.log('Connecting to device...');
  await zk.createSocket();
  console.log('Connected!');

  const args = process.argv.slice(2);
  const userId = args[0] || '9999';
  const fid = parseInt(args[1] || '0', 10);

  console.log("Attempting to delete fingerprint for User ID: ", userId, "FID: ", fid);

  try {
    // Calling getUsers might be required so zklib-ts caches the user map internally
    await zk.getUsers();
    console.log('User map loaded.');

    const res = await zk.deleteFinger(userId, fid);
    console.log('Delete Finger Response:', res);
  } catch (err) {
    console.error('Error deleting finger:', err);
  }

  await zk.disconnect();
}

main().catch(console.error);
