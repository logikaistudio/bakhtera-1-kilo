import bcrypt from 'bcryptjs';

/**
 * Password Service
 * Handles password hashing, validation, and generation
 */

// Configuration
const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
export const hashPassword = async (password) => {
    try {
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        const hash = await bcrypt.hash(password, salt);
        return hash;
    } catch (error) {
        console.error('Error hashing password:', error);
        throw new Error('Failed to hash password');
    }
};

/**
 * Verify password against hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} - True if password matches
 */
export const verifyPassword = async (password, hash) => {
    try {
        return await bcrypt.compare(password, hash);
    } catch (error) {
        console.error('Error verifying password:', error);
        return false;
    }
};

/**
 * Validate password strength
 * Rules: Minimum 8 characters, must contain letters and numbers
 * @param {string} password - Password to validate
 * @returns {object} - Validation result with errors array
 */
export const validatePasswordStrength = (password) => {
    const errors = [];

    if (!password) {
        errors.push('Password is required');
        return { valid: false, errors };
    }

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-zA-Z]/.test(password)) {
        errors.push('Password must contain at least one letter');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Generate a random secure password
 * @param {number} length - Password length (default: 12)
 * @returns {string} - Generated password with letters and numbers
 */
export const generatePassword = (length = 12) => {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';

    const allChars = lowercase + uppercase + numbers;

    let password = '';

    // Ensure at least one letter and one number
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Check if password is commonly used (weak)
 * @param {string} password - Password to check
 * @returns {boolean} - True if password is common/weak
 */
export const isCommonPassword = (password) => {
    const commonPasswords = [
        'password', '12345678', 'qwerty', 'abc123', 'monkey',
        'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou',
        '123456', 'password123', 'admin', 'admin123', 'root'
    ];

    return commonPasswords.includes(password.toLowerCase());
};
