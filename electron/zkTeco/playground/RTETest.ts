// @ts-nocheck
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const ZKLib = require("zklib-ts");

(async () => {
    const zk = new ZKLib("192.168.1.8", 4370, 10000, 4000);

    try {
        console.log("Connecting...");

        await zk.createSocket();

        console.log("Connected!");
        console.log("Waiting for fingerprint scans...");

        await zk.getRealTimeLogs((log: any) => {
            if (log.event === 1 && log.payload) { // EF_ATTLOG
                const buffer = log.payload;
                const user_id = buffer.subarray(0, 24).toString("ascii").split("\0").shift();
                const verify_type = buffer.readUIntLE(24, 1);
                const state = buffer.readUIntLE(25, 1);
                const record_time = new Date(
                    buffer.readUIntLE(26, 1) + 2000,
                    buffer.readUIntLE(27, 1) - 1, // month is 0-indexed in JS
                    buffer.readUIntLE(28, 1),
                    buffer.readUIntLE(29, 1),
                    buffer.readUIntLE(30, 1),
                    buffer.readUIntLE(31, 1)
                );

                console.log("Realtime Event: User scanned fingerprint!", {
                    user_id,
                    verify_type,
                    state,
                    record_time: record_time.toLocaleString()
                });
            } else {
                console.log("Realtime Event:", log);
            }
        });

        // Keep the process alive
        process.stdin.resume();

    } catch (err) {
        console.error(err);
    }

    // await zk.disconnect();
    // Don't disconnect here while testing
})();
