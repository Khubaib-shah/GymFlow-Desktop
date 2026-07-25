// @ts-nocheck
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const ZKLib = require("zklib-ts");

(async () => {
    const zk = new ZKLib("192.168.1.5", 4370, 10000, 4000);

    try {
        console.log("Connecting...");

        await zk.createSocket();

        console.log("Connected!");
        console.log("Waiting for fingerprint scans...");

        await zk.getRealTimeLogs(() => {});

        const socket = zk.ztcp?.socket || zk._zkTcp?.socket;
        if (!socket) {
            console.error("Could not get socket");
            return;
        }

        let unProcessed = Buffer.alloc(0);
        socket.on("data", (data: Buffer) => {
            unProcessed = Buffer.concat([unProcessed, data]);
            while (unProcessed.length > 8) {
                const payloadSize = unProcessed.readUInt32LE(4);
                if (unProcessed.length < payloadSize + 8) break;

                const packet = unProcessed.subarray(0, payloadSize + 8);
                unProcessed = unProcessed.subarray(payloadSize + 8);

                const commandId = packet.readUIntLE(8, 2);
                if (commandId === 500) { // CMD_REG_EVENT
                    const eventId = packet.readUIntLE(12, 2);
                    if (eventId === 1) { // EF_ATTLOG
                        const payload = packet.subarray(16);
                        const user_id = payload.subarray(0, 24).toString("ascii").split("\0").shift();
                        const verify_type = payload.readUIntLE(24, 1);
                        const state = payload.readUIntLE(25, 1);
                        const record_time = new Date(
                            payload.readUInt8(26) + 2000,
                            payload.readUInt8(27) - 1,
                            payload.readUInt8(28),
                            payload.readUInt8(29),
                            payload.readUInt8(30),
                            payload.readUInt8(31)
                        );

                        console.log("Realtime Event: User scanned fingerprint!", {
                            user_id,
                            verify_type,
                            state,
                            record_time
                        });
                    }
                }
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
