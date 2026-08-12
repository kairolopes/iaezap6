/**
 * Password Validation Utilities
 * Provides comprehensive password complexity checking and validation
 */

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  valid: boolean;
  strength: 'weak' | 'moderate' | 'strong' | 'very-strong';
  issues: string[];
  score: number; // 0-100
}

/**
 * Password requirements configuration
 */
const PASSWORD_REQUIREMENTS = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBERS: true,
  REQUIRE_SPECIAL: true,
};

/**
 * Special characters allowed in passwords
 */
const SPECIAL_CHARS_REGEX = /[@$!%*?&]/;

/**
 * Validates password against complexity requirements
 *
 * @param password - The password to validate
 * @returns PasswordValidationResult with validation status and issues
 *
 * @example
 * const result = validatePassword('MyPassword123!');
 * if (!result.valid) {
 *   console.log('Password issues:', result.issues);
 * }
 */
export function validatePassword(password: string): PasswordValidationResult {
  const issues: string[] = [];
  let score = 0;

  // Check if password is provided
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      strength: 'weak',
      issues: ['Password must be a non-empty string'],
      score: 0,
    };
  }

  // Check length
  if (password.length < PASSWORD_REQUIREMENTS.MIN_LENGTH) {
    issues.push(`Password must be at least ${PASSWORD_REQUIREMENTS.MIN_LENGTH} characters long`);
  } else if (password.length > PASSWORD_REQUIREMENTS.MAX_LENGTH) {
    issues.push(`Password must not exceed ${PASSWORD_REQUIREMENTS.MAX_LENGTH} characters`);
  } else {
    score += 20; // Good length
  }

  // Check for uppercase letters
  if (PASSWORD_REQUIREMENTS.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    issues.push('Password must contain at least one uppercase letter (A-Z)');
  } else if (/[A-Z]/.test(password)) {
    score += 15;
  }

  // Check for lowercase letters
  if (PASSWORD_REQUIREMENTS.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    issues.push('Password must contain at least one lowercase letter (a-z)');
  } else if (/[a-z]/.test(password)) {
    score += 15;
  }

  // Check for numbers
  if (PASSWORD_REQUIREMENTS.REQUIRE_NUMBERS && !/\d/.test(password)) {
    issues.push('Password must contain at least one number (0-9)');
  } else if (/\d/.test(password)) {
    score += 15;
  }

  // Check for special characters
  if (PASSWORD_REQUIREMENTS.REQUIRE_SPECIAL && !SPECIAL_CHARS_REGEX.test(password)) {
    issues.push('Password must contain at least one special character (@$!%*?&)');
  } else if (SPECIAL_CHARS_REGEX.test(password)) {
    score += 15;
  }

  // Bonus points for variety
  let charTypes = 0;
  if (/[A-Z]/.test(password)) charTypes++;
  if (/[a-z]/.test(password)) charTypes++;
  if (/\d/.test(password)) charTypes++;
  if (/[^A-Za-z0-9]/.test(password)) charTypes++;

  if (charTypes === 4) {
    score += 20; // Extra points for having all character types
  }

  // Determine strength level
  let strength: 'weak' | 'moderate' | 'strong' | 'very-strong' = 'weak';
  if (score >= 75) {
    strength = 'very-strong';
  } else if (score >= 60) {
    strength = 'strong';
  } else if (score >= 40) {
    strength = 'moderate';
  }

  const valid = issues.length === 0;

  return {
    valid,
    strength,
    issues,
    score: Math.min(100, score),
  };
}

/**
 * Checks if a password passes minimum requirements
 * This is a quick check compared to full validatePassword
 *
 * @param password - The password to check
 * @returns true if password meets minimum requirements
 */
export function meetsMinimumRequirements(password: string): boolean {
  if (!password || typeof password !== 'string') {
    return false;
  }

  // Quick checks
  if (password.length < PASSWORD_REQUIREMENTS.MIN_LENGTH) return false;
  if (password.length > PASSWORD_REQUIREMENTS.MAX_LENGTH) return false;
  if (PASSWORD_REQUIREMENTS.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) return false;
  if (PASSWORD_REQUIREMENTS.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) return false;
  if (PASSWORD_REQUIREMENTS.REQUIRE_NUMBERS && !/\d/.test(password)) return false;
  if (PASSWORD_REQUIREMENTS.REQUIRE_SPECIAL && !SPECIAL_CHARS_REGEX.test(password)) return false;

  return true;
}

/**
 * Generates a password strength message suitable for display
 *
 * @param result - PasswordValidationResult from validatePassword
 * @returns A human-readable message about password strength
 */
export function getPasswordStrengthMessage(result: PasswordValidationResult): string {
  if (!result.valid) {
    return `Password is too weak. ${result.issues.join(' ')}`;
  }

  const messages = {
    'weak': 'Password is weak',
    'moderate': 'Password is moderate strength',
    'strong': 'Password is strong',
    'very-strong': 'Password is very strong',
  };

  return messages[result.strength];
}

/**
 * Validates an email address
 *
 * @param email - The email to validate
 * @returns true if email is valid format
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Checks if an email is already in a "blacklist" or restricted list
 * Useful for preventing disposable email addresses if needed
 *
 * @param email - The email to check
 * @returns true if email is in restricted list
 */
export function isRestrictedEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // List of restricted email patterns (disposable emails, test emails, etc.)
  const restrictedPatterns = [
    /^test@/i,
    /^temp@/i,
    /^fake@/i,
  ];

  return restrictedPatterns.some(pattern => pattern.test(email));
}

/**
 * Sanitizes an email address
 *
 * @param email - The email to sanitize
 * @returns Sanitized email (lowercase, trimmed)
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
