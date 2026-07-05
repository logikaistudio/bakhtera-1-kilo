import bcrypt from 'bcryptjs';

const testPassword = 's@l3s2026';
const storedHash = '$2b$10$p7Wdu7v6/LLEcXxvsOM4TOQJ1UIbHUm7tgZbwiKJrhj7kMyqXPile';

async function run() {
    const match = await bcrypt.compare(testPassword, storedHash);
    console.log(`Bcrypt Match for "${testPassword}":`, match);
}

run().catch(console.error);
