const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${path.join(__dirname, 'dev.db')}` } }
});

async function main() {
  console.log('🌱 Seeding GymFlow database with Pakistani demo data...\n');

  // Clean up existing data first
  await prisma.attendance.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.member.deleteMany();
  await prisma.trainer.deleteMany();
  await prisma.membershipPlan.deleteMany();
  console.log('🧹 Cleared existing data.');

  // ─── 1. OWNER ───────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const owner = await prisma.owner.upsert({
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
        membershipStart = daysAgo(Math.floor(Math.random() * 300) + 1);
        membershipEnd = daysFromNow(Math.floor(Math.random() * plan.durationDays) + 1);
      } else if (status === 'EXPIRED') {
        membershipStart = daysAgo(Math.floor(Math.random() * 300) + plan.durationDays + 10);
        membershipEnd = daysAgo(Math.floor(Math.random() * 60) + 1);
      } else if (status === 'INACTIVE' || status === 'SUSPENDED') {
        membershipStart = daysAgo(Math.floor(Math.random() * 200) + 50);
        membershipEnd = Math.random() > 0.5 ? daysAgo(10) : daysFromNow(30); 
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
      address: `Random Street ${i}, ${city}`,
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
  const paymentRecords = [];
  for (const member of members) {
    if (member.planId) {
      const plan = plans.find(p => p.id === member.planId);
      paymentRecords.push({
        memberId: member.id,
        planId: member.planId,
        amount: plan.price,
        method: ['CASH', 'CARD', 'TRANSFER'][Math.floor(Math.random() * 3)],
        paymentDate: member.membershipStart || daysAgo(10),
        notes: `Payment for ${plan.name}`
      });
      
      if (Math.random() > 0.7) {
        paymentRecords.push({
          memberId: member.id,
          planId: member.planId,
          amount: plan.price,
          method: 'CASH',
          paymentDate: daysAgo(Math.floor(Math.random() * 300) + plan.durationDays),
          notes: `Previous cycle payment`
        });
      }
    }
  }

  for (const p of paymentRecords) {
    await prisma.payment.create({ data: p });
  }
  console.log(`✅ ${paymentRecords.length} payment records created`);

  // ─── 6. ATTENDANCE (last 30 days, realistic pattern) ────────────────────────
  let attendanceCount = 0;
  
  for (const member of members) {
    if (member.status === 'LEAD') continue;
    
    const daysToSimulate = member.status === 'ACTIVE' ? 30 : 5;
    const probability = member.status === 'ACTIVE' ? 0.7 : 0.2;

    for (let dayOffset = daysToSimulate; dayOffset >= 0; dayOffset--) {
      const date = daysAgo(dayOffset);
      const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

      if (Math.random() > probability) continue;
      if (dayOfWeek === 0 && Math.random() < 0.7) continue;

      const checkInHour = 6 + Math.floor(Math.random() * 14); // Between 6am-8pm
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
  console.log(`✅ ${attendanceCount} attendance records created`);

  console.log('\n🎉 Seeding complete! Login credentials:');
  console.log('   Username: admin@gymflow.com');
  console.log('   Password: admin123\n');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
