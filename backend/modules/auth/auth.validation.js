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