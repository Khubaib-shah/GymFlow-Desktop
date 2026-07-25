const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Delete in order to avoid foreign key constraints issues if any,
  // though Prisma handles some cascades.
  const attendance = await prisma.attendance.deleteMany();
  const trainerAttendance = await prisma.trainerAttendance.deleteMany();
  const deviceAttendanceLogs = await prisma.deviceAttendanceLog.deleteMany({});
  // const members = await prisma.member.deleteMany({});
  // const trainers = await prisma.trainer.deleteMany({});
  // const owners = await prisma.owner.deleteMany({});

  console.log(`Deleted ${attendance.count} attendances, ${trainerAttendance.count} trainer attendances, ${deviceAttendanceLogs.count} device attendance logs`);
  // console.log(`Deleted ${attendance.count} attendances, ${deviceAttendanceLogs.count} device attendance logs, ${members.count} members, ${trainers.count} trainers, and ${owners.count} owners.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
