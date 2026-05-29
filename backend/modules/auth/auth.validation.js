// Validation schemas for authentication
export const validateRegister = (data) => {
  const errors = [];
  const MAX_NAME_LENGTH = 100;
  const MAX_EMAIL_LENGTH = 255;
  const MAX_PASSWORD_LENGTH = 128;
  const MIN_PASSWORD_LENGTH = 6;

  // Check required fields
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required and must be a non-empty string');
  } else if (data.name.trim().length > MAX_NAME_LENGTH) {
    errors.push(`Name must not exceed ${MAX_NAME_LENGTH} characters`);
  }

  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  } else if (data.email.length > MAX_EMAIL_LENGTH) {
    errors.push(`Email must not exceed ${MAX_EMAIL_LENGTH} characters`);
  } else {
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Invalid email format');
    }
  }

  if (!data.password || typeof data.password !== 'string') {
    errors.push('Password is required');
  } else if (data.password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  } else if (data.password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateLogin = (data) => {
  const errors = [];

  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  }

  if (!data.password || typeof data.password !== 'string') {
    errors.push('Password is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateClientType = (clientType) => {
  const validTypes = ['web', 'mobile'];
  
  if (!clientType || typeof clientType !== 'string') {
    return {
      isValid: false,
      error: 'Client type header must be provided'
    };
  }

  const normalized = clientType.toLowerCase().trim();
  
  if (!validTypes.includes(normalized)) {
    return {
      isValid: false,
      error: `Invalid client type. Allowed values: ${validTypes.join(', ')}`
    };
  }

  return {
    isValid: true,
    value: normalized
  };
};

/**
 * Validate OTP format (6 digits)
 */
export const validateOtp = (otp) => {
  const errors = [];

  if (!otp || typeof otp !== 'string') {
    errors.push('OTP is required');
  } else if (otp.length !== 6) {
    errors.push('OTP must be exactly 6 digits');
  } else if (!/^\d+$/.test(otp)) {
    errors.push('OTP must contain only numbers');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate session ID (UUID format)
 */
export const validateSessionId = (sessionId) => {
  const errors = [];
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!sessionId || typeof sessionId !== 'string') {
    errors.push('Session ID is required');
  } else if (!uuidRegex.test(sessionId)) {
    errors.push('Invalid session ID format');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateForgotPasswordEmail = (data) => {
  const errors = [];
  const MAX_EMAIL_LENGTH = 255;

  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  } else if (data.email.length > MAX_EMAIL_LENGTH) {
    errors.push(`Email must not exceed ${MAX_EMAIL_LENGTH} characters`);
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Invalid email format');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateResetPassword = (data) => {
  const errors = [];
  const MIN_PASSWORD_LENGTH = 6;
  const MAX_PASSWORD_LENGTH = 128;

  const sessionValidation = validateSessionId(data.sessionId);
  if (!sessionValidation.isValid) {
    errors.push(...sessionValidation.errors);
  }

  const otpValidation = validateOtp(data.otp);
  if (!otpValidation.isValid) {
    errors.push(...otpValidation.errors);
  }

  if (!data.newPassword || typeof data.newPassword !== 'string') {
    errors.push('New password is required');
  } else if (data.newPassword.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  } else if (data.newPassword.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};