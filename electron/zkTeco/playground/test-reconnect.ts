import { createRequire } from 'module';
const require = createRequire(process.cwd() + '/');
const ZKLib = require('zklib-ts');

async function main() {
  const zk = new ZKLib('192.168.1.5', 4370, 10000, 4000);
  console.log('Connecting...');
  await zk.createSocket();
  console.log('Connected 1');
  await zk.getUsers();
  console.log('Got users');
  await zk.disconnect();
  console.log('Disconnected');
  
  await new Promise(r => setTimeout(r, 1000)); // Delay
  
  const zk2 = new ZKLib('192.168.1.5', 4370, 10000, 4000);
  console.log('Reconnecting...');
  await zk2.createSocket();
  console.log('Connected 2');
  await zk2.getTemplates();
  console.log('Got templates');
  await zk2.disconnect();
}
main().catch(console.error);
