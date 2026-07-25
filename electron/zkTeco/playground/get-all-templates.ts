import { createRequire } from 'module';
const require = createRequire(process.cwd() + '/');
const ZKLib = require('zklib-ts');

async function main() {
  const zk = new ZKLib('192.168.1.5', 4370, 10000, 4000);
  await zk.createSocket();
  await zk.executeCmd(1003); // CMD_DISABLEDEVICE
  const res = await zk.getTemplates();
  console.log('Total templates:', res.data.length);
  const enrolled = res.data.filter(t => t.uid === 624 || t.uid === 1 || t.uid === 700);
  console.log('Templates for our target users:');
  console.dir(enrolled, { depth: null });
  await zk.executeCmd(1002); // CMD_ENABLEDEVICE
}

main().catch(console.error);
