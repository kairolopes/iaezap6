import bcrypt from 'bcrypt';

const password = 'jx&CL%mFvt!x*Sm0';
const rounds = 10;

async function test() {
  const hash = await bcrypt.hash(password, rounds);
  console.log('Hash:', hash);
  
  const match = await bcrypt.compare(password, hash);
  console.log('Match:', match);
  
  // Test with the stored hash
  const storedHash = '$2b$10$EQlUQt/GbISOtnjwlHxPRudVFEzvrBvm3Y5K8JS7YOFBLVFsLte3W';
  const storedMatch = await bcrypt.compare(password, storedHash);
  console.log('Stored hash match:', storedMatch);
}

test();
