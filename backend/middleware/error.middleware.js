class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const errorHandler = (err, req, res, next) => {
  console.error(
    `[${new Date().toISOString()}] ${req.method} ${req.path}:`,
    err.message
  );

  // 1. Validation Error (old system)
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.details || []
    });
  }

  // 2. Custom AppError (old system)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: []
    });
  }

  // 3. Prisma Errors (old system)
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'Record already exists',
      errors: []
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Record not found',
      errors: []
    });
  }

  // 4. Default (main system)
  const statusCode = err.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    errors: err.errors || []
  });
};

export { AppError, errorHandler };