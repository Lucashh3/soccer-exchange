import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express'

export interface AppError extends Error {
  status?: number
  statusCode?: number
}

export const errorHandler: ErrorRequestHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const status = err.status ?? err.statusCode ?? 500
  const message = err.message || 'Internal Server Error'

  console.error(`[error] ${status} - ${message}`, err.stack)

  res.status(status).json({
    error: {
      message,
      status,
    },
  })
}
