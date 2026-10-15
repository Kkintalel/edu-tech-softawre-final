const dotenv = require('dotenv');
const { connectToMongo } = require('../utils/db');
const { initializeSchoolAccounting } = require('../utils/schoolAccountingSetup');

dotenv.config();

const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/schoolManagementSystem';
const schoolId = process.env.SCHOOL_ID;

if (!schoolId) {
  console.error('SCHOOL_ID is required. Example: SCHOOL_ID=64f2d9af9c1d2b0001abcd12 node scripts/initializeSchoolAccounting.js');
  process.exit(1);
}

const periodName = process.env.PERIOD_NAME || '2026-10';
const startDate = process.env.START_DATE ? new Date(process.env.START_DATE) : new Date('2026-10-01T00:00:00.000Z');
const endDate = process.env.END_DATE ? new Date(process.env.END_DATE) : new Date('2026-10-31T23:59:59.999Z');

const runInitialization = async () => {
  await connectToMongo(MONGO_URI);
  const { period, accountsCreated } = await initializeSchoolAccounting({
    schoolId,
    name: periodName,
    startDate,
    endDate,
  });

  console.log(`School accounting initialized for ${schoolId}`);
  console.log(`Open period: ${period.name} (${period.startDate.toISOString()} to ${period.endDate.toISOString()})`);
  console.log(`New accounts created: ${accountsCreated}`);
  process.exit(0);
};

runInitialization().catch((error) => {
  console.error('Failed to initialize school accounting:', error.message || error);
  process.exit(1);
});
