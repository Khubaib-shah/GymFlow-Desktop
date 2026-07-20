// @ts-nocheck
import { ZKClient } from "../ZKClient";

export class AttendanceWatcher {
  private timer: NodeJS.Timeout | null = null;
  private lastUserSn = 0;

  constructor(private client: ZKClient) {}

  async start() {
    // initialize last seen attendance
    const logs = await this.client.getAttendance();

    if (logs.length) {
      this.lastUserSn = logs[logs.length - 1].userSn;
    }

    this.timer = setInterval(async () => {
      try {
        await this.poll();
      } catch (err) {
        console.error(err);
      }
    }, 1000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async poll() {
    const logs = await this.client.getAttendance();

    const fresh = logs.filter((log) => log.userSn > this.lastUserSn);

    for (const log of fresh) {
      this.lastUserSn = log.userSn;

      console.log("NEW ATTENDANCE", log);
    }
  }
}
