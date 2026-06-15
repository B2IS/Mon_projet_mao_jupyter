/**
 * app/api/auth/[...nextauth]/route.ts
 * Catch-all Auth.js v5 — gère tous les flux OAuth/Credentials :
 *   GET  /api/auth/session
 *   GET  /api/auth/csrf
 *   GET  /api/auth/providers
 *   GET  /api/auth/signin/[provider]
 *   POST /api/auth/signin/credentials
 *   GET  /api/auth/callback/[provider]
 *   POST /api/auth/signout
 */
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
