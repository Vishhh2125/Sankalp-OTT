function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,  // Remove fields not in schema instead of rejecting
      convert: true,        // Auto-convert types (string "1" -> number 1)
    });
    if (error) {
      console.log('Validation failed:', JSON.stringify(error.details, null, 2));
      console.log('Request body was:', JSON.stringify(req.body, null, 2));
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
    }
    req.body = value;
    next();
  };
}

export { validate };