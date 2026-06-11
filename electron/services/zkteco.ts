// We use require since node-zklib doesn't always have typescript definitions
const ZKLib = require('node-zklib');

export async function syncZKTecoLogs(ip: string, port: number, prisma: any) {
  let zkInstance = new ZKLib(ip, port, 10000, 4000);
  
  try {
    // Create socket to machine
    await zkInstance.createSocket();
    
    // Get all attendance logs in the machine
    const logs = await zkInstance.getAttendances();
    
    if (!logs || !logs.data || logs.data.length === 0) {
      zkInstance.disconnect();
      return 0;
    }

    let syncedCount = 0;

    // Process logs
    for (const log of logs.data) {
      // log.deviceUserId is the biometric ID
      // log.recordTime is the Date
      
      const member = await prisma.member.findUnique({
        where: { biometricId: log.deviceUserId }
      });

      if (member) {
        if (member.status !== "ACTIVE" || !member.planId) continue;

        // Check if attendance already exists to avoid duplicates
        const existing = await prisma.attendance.findFirst({
          where: {
            memberId: member.id,
            checkInTime: new Date(log.recordTime)
          }
        });

        if (!existing) {
          await prisma.attendance.create({
            data: {
              memberId: member.id,
              checkInTime: new Date(log.recordTime),
              method: 'BIOMETRIC'
            }
          });
          syncedCount++;
        }
      }
    }

    // Optionally clear attendance logs from device if desired
    // await zkInstance.clearAttendanceLog();

    zkInstance.disconnect();
    return syncedCount;
    
  } catch (error: any) {
    console.error('Error connecting to ZKTeco:', error);
    // Disconnect just in case
    try {
      zkInstance.disconnect();
    } catch(e) {}
    
    // Fallback Mock for testing if device isn't available
    if (process.env.NODE_ENV === 'development') {
      console.log('Returning mock sync success for development');
      return 1;
    }
    
    const errorMessage = error instanceof Error ? error.message : (error?.err || error?.message || String(error));
    throw new Error(`Connection failed: ${errorMessage}`);
  }
}
