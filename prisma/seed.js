const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${path.join(__dirname, 'dev.db')}` } }
});

async function main() {
  console.log('🌱 Seeding GymFlow database with Pakistani demo data...\n');

  // ─── 1. OWNER ───────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const owner = await prisma.owner.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', password: hashedPassword },
  });
  console.log(`✅ Owner created: admin / admin123`);

  // ─── 2. MEMBERSHIP PLANS ────────────────────────────────────────────────────
  const plans = await Promise.all([
    prisma.membershipPlan.create({ data: { name: 'Basic Plan',    durationDays: 30,  price: 2500 } }),
    prisma.membershipPlan.create({ data: { name: 'Standard Plan', durationDays: 90,  price: 6500 } }),
    prisma.membershipPlan.create({ data: { name: 'Premium Plan',  durationDays: 180, price: 11000 } }),
    prisma.membershipPlan.create({ data: { name: 'Annual Plan',   durationDays: 365, price: 18000 } }),
    prisma.membershipPlan.create({ data: { name: 'Student Plan',  durationDays: 30,  price: 1800 } }),
  ]);
  console.log(`✅ ${plans.length} membership plans created`);

  // ─── 3. TRAINERS ────────────────────────────────────────────────────────────
  const trainerData = [
    { firstName: 'Usman',   lastName: 'Malik',    phone: '0321-4567890', specialty: 'Strength & Conditioning', cnic: '35202-1234567-1', dob: new Date('1990-03-15'), gender: 'Male',   address: 'House 12, Block B, Gulberg III, Lahore' },
    { firstName: 'Ayesha',  lastName: 'Siddiqui', phone: '0333-9876543', specialty: 'Yoga & Flexibility',      cnic: '42101-9876543-2', dob: new Date('1993-07-22'), gender: 'Female', address: 'Flat 5, Clifton Block 4, Karachi' },
    { firstName: 'Bilal',   lastName: 'Chaudhry', phone: '0312-3456789', specialty: 'Boxing & MMA',            cnic: '35201-3456789-3', dob: new Date('1988-11-08'), gender: 'Male',   address: 'Street 7, F-7/2, Islamabad' },
  ];

  const trainers = [];
  for (const t of trainerData) {
    trainers.push(await prisma.trainer.create({ data: t }));
  }
  console.log(`✅ ${trainers.length} trainers created`);

  // ─── 4. MEMBERS ─────────────────────────────────────────────────────────────
  const today = new Date();
  const daysAgo = (n) => new Date(today.getTime() - n * 24 * 60 * 60 * 1000);
  const daysFromNow = (n) => new Date(today.getTime() + n * 24 * 60 * 60 * 1000);

  const memberData = [
    // ACTIVE - full subscriptions
    { firstName: 'Hamza',    lastName: 'Khan',      email: 'hamza.khan@gmail.com',      phone: '0300-1234567', cnic: '35202-7654321-5', dob: new Date('1995-04-10'), gender: 'Male',   address: 'House 45, DHA Phase 5, Lahore',              planId: plans[1].id, trainerId: trainers[0].id, membershipStart: daysAgo(45), membershipEnd: daysFromNow(45), status: 'ACTIVE' },
    { firstName: 'Fatima',   lastName: 'Zahra',     email: 'fatima.zahra@outlook.com',  phone: '0311-9876543', cnic: '42301-1122334-4', dob: new Date('1998-09-25'), gender: 'Female', address: 'Apartment 3B, Bahria Town, Karachi',          planId: plans[2].id, trainerId: trainers[1].id, membershipStart: daysAgo(20), membershipEnd: daysFromNow(160), status: 'ACTIVE' },
    { firstName: 'Ahmed',    lastName: 'Raza',      email: 'ahmed.raza@yahoo.com',      phone: '0345-4567890', cnic: '38401-5544332-6', dob: new Date('1992-12-01'), gender: 'Male',   address: 'Block D, Phase 2, Hayatabad, Peshawar',      planId: plans[3].id, trainerId: trainers[0].id, membershipStart: daysAgo(100), membershipEnd: daysFromNow(265), status: 'ACTIVE' },
    { firstName: 'Zainab',   lastName: 'Ali',       email: 'zainab.ali@gmail.com',      phone: '0322-3334455', cnic: '35202-9988776-7', dob: new Date('2001-06-18'), gender: 'Female', address: 'Street 5, Model Town, Lahore',                planId: plans[4].id, trainerId: trainers[1].id, membershipStart: daysAgo(10), membershipEnd: daysFromNow(20), status: 'ACTIVE' },
    { firstName: 'Omar',     lastName: 'Farooq',    email: 'omar.farooq@hotmail.com',   phone: '0335-6677889', cnic: '61101-7766554-8', dob: new Date('1990-02-28'), gender: 'Male',   address: 'F-8 Markaz, Islamabad',                      planId: plans[1].id, trainerId: trainers[2].id, membershipStart: daysAgo(60), membershipEnd: daysFromNow(30), status: 'ACTIVE' },
    { firstName: 'Sana',     lastName: 'Nawaz',     email: 'sana.nawaz@gmail.com',      phone: '0300-9988776', cnic: '35201-6655443-9', dob: new Date('1997-08-14'), gender: 'Female', address: 'House 18, Garden Town, Lahore',               planId: plans[0].id, trainerId: trainers[1].id, membershipStart: daysAgo(5),  membershipEnd: daysFromNow(25), status: 'ACTIVE' },
    { firstName: 'Tariq',    lastName: 'Mahmood',   email: 'tariq.m@gmail.com',         phone: '0333-1122334', cnic: '42201-8877665-0', dob: new Date('1985-01-30'), gender: 'Male',   address: 'Gulshan-e-Iqbal Block 13, Karachi',          planId: plans[2].id, trainerId: trainers[0].id, membershipStart: daysAgo(30), membershipEnd: daysFromNow(150), status: 'ACTIVE' },
    { firstName: 'Hina',     lastName: 'Baig',      email: 'hina.baig@live.com',        phone: '0312-5566778', cnic: '35202-2233445-1', dob: new Date('1999-11-05'), gender: 'Female', address: 'Phase 6, DHA Lahore',                        planId: plans[1].id, trainerId: trainers[1].id, membershipStart: daysAgo(80), membershipEnd: daysFromNow(10), status: 'ACTIVE' },
    { firstName: 'Junaid',   lastName: 'Sheikh',    email: 'junaid.sheikh@gmail.com',   phone: '0321-7788990', cnic: '37405-3344556-2', dob: new Date('1993-05-20'), gender: 'Male',   address: 'Cantt Area, Rawalpindi',                     planId: plans[3].id, trainerId: trainers[2].id, membershipStart: daysAgo(200), membershipEnd: daysFromNow(165), status: 'ACTIVE' },
    { firstName: 'Madiha',   lastName: 'Qureshi',   email: 'madiha.q@gmail.com',        phone: '0346-4455667', cnic: '42101-4455667-3', dob: new Date('2000-03-12'), gender: 'Female', address: 'North Nazimabad, Karachi',                    planId: plans[4].id, trainerId: trainers[1].id, membershipStart: daysAgo(15), membershipEnd: daysFromNow(15), status: 'ACTIVE' },
    // EXPIRED
    { firstName: 'Asad',     lastName: 'Iqbal',     email: 'asad.iqbal@gmail.com',      phone: '0300-3344556', cnic: '35202-5566778-4', dob: new Date('1988-07-07'), gender: 'Male',   address: 'Township, Lahore',                           planId: plans[0].id, trainerId: null,            membershipStart: daysAgo(60), membershipEnd: daysAgo(30), status: 'EXPIRED' },
    { firstName: 'Nadia',    lastName: 'Hussain',   email: 'nadia.h@yahoo.com',         phone: '0334-8877665', cnic: '42201-6677889-5', dob: new Date('1995-10-18'), gender: 'Female', address: 'PECHS Block 6, Karachi',                     planId: plans[1].id, trainerId: null,            membershipStart: daysAgo(120), membershipEnd: daysAgo(30), status: 'EXPIRED' },
    { firstName: 'Imran',    lastName: 'Butt',      email: null,                        phone: '0322-2233445', cnic: '35201-7788990-6', dob: new Date('1991-04-25'), gender: 'Male',   address: 'Allama Iqbal Town, Lahore',                  planId: plans[0].id, trainerId: null,            membershipStart: daysAgo(45), membershipEnd: daysAgo(15), status: 'EXPIRED' },
    // Without plans (walk-in prospects)
    { firstName: 'Sara',     lastName: 'Javed',     email: 'sara.javed@gmail.com',      phone: '0311-5544332', cnic: null,               dob: new Date('2002-01-09'), gender: 'Female', address: 'Johar Town, Lahore',                         planId: null,        trainerId: null,            membershipStart: null, membershipEnd: null, status: 'ACTIVE' },
    { firstName: 'Kamran',   lastName: 'Mirza',     email: null,                        phone: '0333-4455667', cnic: null,               dob: new Date('1994-09-14'), gender: 'Male',   address: 'G-10, Islamabad',                            planId: null,        trainerId: null,            membershipStart: null, membershipEnd: null, status: 'ACTIVE' },
  ];

  const members = [];
  for (const m of memberData) {
    members.push(await prisma.member.create({ data: m }));
  }
  console.log(`✅ ${members.length} members created`);

  // ─── 5. PAYMENTS ────────────────────────────────────────────────────────────
  const paymentRecords = [
    { memberId: members[0].id,  planId: plans[1].id, amount: 6500,  method: 'CASH',     paymentDate: daysAgo(45), notes: 'Standard Plan - 3 Months' },
    { memberId: members[1].id,  planId: plans[2].id, amount: 11000, method: 'CARD',     paymentDate: daysAgo(20), notes: 'Premium Plan - 6 Months' },
    { memberId: members[2].id,  planId: plans[3].id, amount: 18000, method: 'TRANSFER', paymentDate: daysAgo(100), notes: 'Annual Plan - Full Year' },
    { memberId: members[3].id,  planId: plans[4].id, amount: 1800,  method: 'CASH',     paymentDate: daysAgo(10), notes: 'Student Plan' },
    { memberId: members[4].id,  planId: plans[1].id, amount: 6500,  method: 'CASH',     paymentDate: daysAgo(60), notes: 'Standard Plan Renewal' },
    { memberId: members[5].id,  planId: plans[0].id, amount: 2500,  method: 'CASH',     paymentDate: daysAgo(5),  notes: 'Basic Plan' },
    { memberId: members[6].id,  planId: plans[2].id, amount: 11000, method: 'CARD',     paymentDate: daysAgo(30), notes: 'Premium Plan' },
    { memberId: members[7].id,  planId: plans[1].id, amount: 6500,  method: 'CASH',     paymentDate: daysAgo(80), notes: 'Standard Plan' },
    { memberId: members[8].id,  planId: plans[3].id, amount: 18000, method: 'TRANSFER', paymentDate: daysAgo(200), notes: 'Annual Plan' },
    { memberId: members[9].id,  planId: plans[4].id, amount: 1800,  method: 'CASH',     paymentDate: daysAgo(15), notes: 'Student Plan' },
    { memberId: members[10].id, planId: plans[0].id, amount: 2500,  method: 'CASH',     paymentDate: daysAgo(60), notes: 'Basic Plan - Expired' },
    { memberId: members[11].id, planId: plans[1].id, amount: 6500,  method: 'CARD',     paymentDate: daysAgo(120), notes: 'Standard Plan - Expired' },
    { memberId: members[12].id, planId: plans[0].id, amount: 2500,  method: 'CASH',     paymentDate: daysAgo(45), notes: 'Basic Plan - Expired' },
    // Renewal payments
    { memberId: members[0].id,  planId: plans[1].id, amount: 6500,  method: 'CASH',     paymentDate: daysAgo(135), notes: 'Previous cycle payment' },
    { memberId: members[8].id,  planId: plans[2].id, amount: 11000, method: 'CARD',     paymentDate: daysAgo(380), notes: 'Previous year payment' },
  ];

  for (const p of paymentRecords) {
    await prisma.payment.create({ data: p });
  }
  console.log(`✅ ${paymentRecords.length} payment records created`);

  // ─── 6. ATTENDANCE (last 30 days, realistic pattern) ────────────────────────
  const activeMembers = members.slice(0, 10);
  let attendanceCount = 0;

  for (const member of activeMembers) {
    // Each active member attends 3-5 days per week, skip weekends sometimes
    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      const date = daysAgo(dayOffset);
      const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

      // Skip some days randomly (simulate realistic attendance ~70%)
      const seeded = (member.id.charCodeAt(0) + dayOffset) % 10;
      if (seeded < 3) continue; // 30% skip rate
      if (dayOfWeek === 0 && seeded < 7) continue; // More Sunday skips
      if (dayOfWeek === 6 && seeded < 5) continue; // Some Saturday skips

      const checkInHour = 6 + (seeded % 4); // Between 6am-9am
      const checkIn = new Date(date);
      checkIn.setHours(checkInHour, (seeded * 7) % 60, 0, 0);

      const checkOut = new Date(checkIn);
      checkOut.setHours(checkIn.getHours() + 1 + (seeded % 2), 30, 0, 0);

      await prisma.attendance.create({
        data: {
          memberId: member.id,
          checkInTime: checkIn,
          checkOutTime: dayOffset > 0 ? checkOut : null, // Today might not have checkout
          method: seeded % 3 === 0 ? 'MANUAL' : 'BIOMETRIC',
        }
      });
      attendanceCount++;
    }
  }
  console.log(`✅ ${attendanceCount} attendance records created`);

  console.log('\n🎉 Seeding complete! Login credentials:');
  console.log('   Username: admin');
  console.log('   Password: admin123\n');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
