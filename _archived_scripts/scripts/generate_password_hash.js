import bcrypt from 'bcryptjs';

// Generate bcrypt hash for Admin123!
const password = 'Admin123!';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log('Password:', password);
console.log('Bcrypt Hash:', hash);
console.log('\nSQL to update:');
console.log(`UPDATE users SET password_hash = '${hash}' WHERE username = 'superadmin';`);
