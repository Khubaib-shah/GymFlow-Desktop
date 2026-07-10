const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${path.join(__dirname, 'dev.db')}` } }
});

async function main() {
  console.log('🌱 Seeding GymFlow database with Pakistani demo data...\n');

  // Clean up existing data first
  await prisma.trainerAttendance.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.member.deleteMany();
  await prisma.trainer.deleteMany();
  await prisma.membershipPlan.deleteMany();
  console.log('🧹 Cleared existing data.');

  // ─── 1. OWNER ───────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.owner.upsert({
    where: { username: 'admin@gymflow.com' },
    update: {},
    create: { username: 'admin@gymflow.com', password: hashedPassword },
  });
  console.log(`✅ Owner created: admin@gymflow.com / admin123`);

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

  const firstNames = ['Ali', 'Hamza', 'Usman', 'Bilal', 'Umar', 'Ahmed', 'Ayesha', 'Fatima', 'Zainab', 'Sara', 'Sana', 'Hina', 'Kamran', 'Tariq', 'Junaid', 'Madiha', 'Nadia', 'Asad', 'Imran', 'Hassan', 'Zoya', 'Mariam', 'Saad', 'Fahad', 'Rabia'];
  const lastNames = ['Khan', 'Malik', 'Chaudhry', 'Ali', 'Farooq', 'Qureshi', 'Sheikh', 'Baig', 'Iqbal', 'Hussain', 'Mirza', 'Javed', 'Nawaz', 'Mahmood', 'Zafar', 'Shah', 'Raza', 'Butt', 'Siddiqui', 'Rehman'];
  const cities = ['Lahore', 'Karachi', 'Islamabad', 'Peshawar', 'Rawalpindi', 'Multan', 'Faisalabad'];

  const memberData = [];
  const totalMembers = 60;
  
  // ACTIVE = 45, LEAD = 4, EXPIRED = 4, INACTIVE = 3, SUSPENDED = 4
  const statuses = [
    ...Array(45).fill('ACTIVE'),
    ...Array(4).fill('LEAD'),
    ...Array(4).fill('EXPIRED'),
    ...Array(3).fill('INACTIVE'),
    ...Array(4).fill('SUSPENDED')
  ];

  for (let i = 0; i < totalMembers; i++) {
    const status = statuses[i];
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const city = cities[i % cities.length];
    const gender = ['Ayesha', 'Fatima', 'Zainab', 'Sara', 'Sana', 'Hina', 'Madiha', 'Nadia', 'Zoya', 'Mariam', 'Rabia'].includes(fn) ? 'Female' : 'Male';
    
    let planId = null;
    let trainerId = null;
    let membershipStart = null;
    let membershipEnd = null;
    
    if (status !== 'LEAD') {
      const plan = plans[i % plans.length];
      planId = plan.id;
      trainerId = i % 3 === 0 ? trainers[i % trainers.length].id : null;
      
      if (status === 'ACTIVE') {
        // Some expiring soon (within 7 days) for WhatsApp demo
        const expiringVariant = i < 5; // first 5 active members expire soon
        membershipStart = daysAgo(Math.floor(Math.random() * 300) + 1);
        membershipEnd = expiringVariant
          ? daysFromNow(Math.floor(Math.random() * 7))  // 0–6 days left
          : daysFromNow(Math.floor(Math.random() * (plan.durationDays - 7)) + 8); // 8+ days
      } else if (status === 'EXPIRED') {
        // Expired 1–14 days ago (within 15 day threshold for urgent message)
        membershipStart = daysAgo(plan.durationDays + Math.floor(Math.random() * 10) + 1);
        membershipEnd = daysAgo(Math.floor(Math.random() * 14) + 1);
      } else if (status === 'SUSPENDED') {
        // Suspended = expired 61–120 days ago (auto-suspension rule: >60 days expired)
        const expiredDaysAgo = 61 + Math.floor(Math.random() * 60);
        membershipStart = daysAgo(expiredDaysAgo + plan.durationDays);
        membershipEnd = daysAgo(expiredDaysAgo);
      } else if (status === 'INACTIVE') {
        membershipStart = daysAgo(Math.floor(Math.random() * 200) + 50);
        membershipEnd = daysFromNow(30);
      }
    }
    
    memberData.push({
      firstName: fn,
      lastName: ln,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com`,
      phone: `03${Math.floor(10 + Math.random() * 89)}-${Math.floor(1000000 + Math.random() * 8999999)}`,
      cnic: status !== 'LEAD' ? `35202-${Math.floor(1000000 + Math.random() * 8999999)}-${i % 10}` : null,
      dob: daysAgo(Math.floor(Math.random() * 10000) + 6000),
      gender,
      address: `Street ${i + 1}, ${city}`,
      planId,
      trainerId,
      membershipStart,
      membershipEnd,
      status
    });
  }

  const members = [];
  for (const m of memberData) {
    members.push(await prisma.member.create({ data: m }));
  }
  console.log(`✅ ${members.length} members created`);

  // ─── 5. PAYMENTS ────────────────────────────────────────────────────────────
  // Only CASH and ONLINE as per current system
  const paymentMethods = ['CASH', 'ONLINE'];
  const admissionFee = 4000; // Default from settings
  const paymentRecords = [];

  for (const member of members) {
    if (member.planId) {
      const plan = plans.find(p => p.id === member.planId);
      const isSuspended = member.status === 'SUSPENDED';

      // Initial payment: plan fee + admission fee
      paymentRecords.push({
        memberId: member.id,
        planId: member.planId,
        amount: plan.price + admissionFee,
        method: paymentMethods[Math.floor(Math.random() * 2)],
        paymentDate: member.membershipStart || daysAgo(10),
        notes: `Admission Fee (Rs ${admissionFee}) + Plan Fee (Rs ${plan.price})`
      });
      
      // Some members have a renewal payment
      if (!isSuspended && Math.random() > 0.6) {
        paymentRecords.push({
          memberId: member.id,
          planId: member.planId,
          amount: plan.price,
          method: 'CASH',
          paymentDate: daysAgo(Math.floor(Math.random() * 300) + plan.durationDays),
          notes: 'Subscription Renewal'
        });
      }

      // Suspended members have a re-admission record
      if (isSuspended && Math.random() > 0.5) {
        paymentRecords.push({
          memberId: member.id,
          planId: member.planId,
          amount: plan.price + admissionFee,
          method: 'CASH',
          paymentDate: daysAgo(Math.floor(Math.random() * 200) + 70),
          notes: `Subscription Renewal + Re-Admission Fee (Rs ${admissionFee})`
        });
      }
    }
  }

  for (const p of paymentRecords) {
    await prisma.payment.create({ data: p });
  }
  console.log(`✅ ${paymentRecords.length} payment records created`);

  // ─── 6. MEMBER ATTENDANCE (last 30 days) ────────────────────────────────────
  let attendanceCount = 0;
  
  for (const member of members) {
    if (member.status === 'LEAD' || member.status === 'SUSPENDED') continue;
    
    const daysToSimulate = member.status === 'ACTIVE' ? 30 : 5;
    const probability = member.status === 'ACTIVE' ? 0.7 : 0.2;

    for (let dayOffset = daysToSimulate; dayOffset >= 0; dayOffset--) {
      const date = daysAgo(dayOffset);
      const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

      if (Math.random() > probability) continue;
      if (dayOfWeek === 0 && Math.random() < 0.7) continue;

      const checkInHour = 6 + Math.floor(Math.random() * 14);
      const checkIn = new Date(date);
      checkIn.setHours(checkInHour, Math.floor(Math.random() * 60), 0, 0);

      const checkOut = new Date(checkIn);
      checkOut.setHours(checkIn.getHours() + 1 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);

      await prisma.attendance.create({
        data: {
          memberId: member.id,
          checkInTime: checkIn,
          checkOutTime: dayOffset > 0 ? checkOut : null,
          method: Math.random() > 0.8 ? 'MANUAL' : 'BIOMETRIC',
        }
      });
      attendanceCount++;
    }
  }
  console.log(`✅ ${attendanceCount} member attendance records created`);

  // ─── 7. TRAINER ATTENDANCE (last 30 days) ───────────────────────────────────
  let trainerAttCount = 0;

  for (const trainer of trainers) {
    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      const date = daysAgo(dayOffset);
      const dayOfWeek = date.getDay();

      // Trainers work 6 days a week (Sunday off 70% of the time)
      if (dayOfWeek === 5 && Math.random() < 0.8) continue; // Friday mostly off
      if (dayOfWeek === 0 && Math.random() < 0.5) continue; // Sunday sometimes off
      if (Math.random() > 0.85) continue; // occasional absence

      // Trainers arrive early: 7am–9am
      const checkInHour = 7 + Math.floor(Math.random() * 2);
      const checkIn = new Date(date);
      checkIn.setHours(checkInHour, Math.floor(Math.random() * 60), 0, 0);

      // Trainers stay 6–10 hours
      const workHours = 6 + Math.floor(Math.random() * 4);
      const checkOut = new Date(checkIn);
      checkOut.setHours(checkIn.getHours() + workHours, Math.floor(Math.random() * 60), 0, 0);

      await prisma.trainerAttendance.create({
        data: {
          trainerId: trainer.id,
          checkInTime: checkIn,
          checkOutTime: dayOffset > 0 ? checkOut : null, // today's session might still be open
          method: 'MANUAL',
        }
      });
      trainerAttCount++;
    }
  }
  console.log(`✅ ${trainerAttCount} trainer attendance records created`);

  console.log('\n🎉 Seeding complete! Login credentials:');
  console.log('   Username: admin@gymflow.com');
  console.log('   Password: admin123\n');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
