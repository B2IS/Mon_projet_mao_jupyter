// ── Custom error hierarchy for Enertic AI ────────────────────────────────────

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'INTERNAL_ERROR',
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} "${id}" introuvable` : `${resource} introuvable`,
      404,
      'NOT_FOUND',
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly fields?: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentification requise') {
    super(message, 401, 'AUTH_ERROR');
  }
}

export class DataIngestionError extends AppError {
  constructor(source: string, detail?: string) {
    super(
      `Échec de l'ingestion depuis "${source}"${detail ? `: ${detail}` : ''}`,
      502,
      'INGESTION_ERROR',
    );
  }
}

export class ModelError extends AppError {
  constructor(message: string) {
    super(message, 500, 'MODEL_ERROR');
  }
}

// ── Express error-handler middleware ──────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error(err.message, { code: err.code, stack: err.stack });
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }

  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  return res.status(500).json({ error: 'Erreur interne du serveur', code: 'INTERNAL_ERROR' });
}
