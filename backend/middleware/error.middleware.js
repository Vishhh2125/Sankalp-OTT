import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

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

  // Check if it's an ApiError instance
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json(
      new ApiResponse(err.statusCode, null, err.message)
    );
  }

  // 1. Validation Error (old system)
  if (err.name === 'ValidationError') {
    return res.status(400).json(
      new ApiResponse(400, null, 'Validation failed')
    );
  }

  // 2. Custom AppError (old system)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(
      new ApiResponse(err.statusCode, null, err.message)
    );
  }

  // 3. Prisma Errors (old system)
  if (err.code === 'P2002') {
    return res.status(409).json(
      new ApiResponse(409, null, 'Record already exists')
    );
  }

  if (err.code === 'P2025') {
    return res.status(404).json(
      new ApiResponse(404, null, 'Record not found')
    );
  }

  // 4. Default (main system)
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  return res.status(statusCode).json(
    new ApiResponse(statusCode, null, message)
  );
};

export { AppError, errorHandler };