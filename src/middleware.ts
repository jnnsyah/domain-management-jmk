import { defineMiddleware } from 'astro:middleware';
import { verifySessionToken } from '@/lib/auth';
import * as dotenv from 'dotenv';

dotenv.config();

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, request, cookies, redirect } = context;
  const path = url.pathname;

  // 1. Cron Endpoints Authorization (/api/cron/*)
  if (path.startsWith('/api/cron/')) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || (import.meta.env ? import.meta.env.CRON_SECRET : '');
    const expectedToken = `Bearer ${cronSecret}`;
    if (!authHeader || authHeader !== expectedToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Cron Bearer token tidak valid.',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return next();
  }

  // 2. Allow Public Routes (/login, /api/auth/login)
  if (path === '/login' || path === '/api/auth/login') {
    if (path === '/login') {
      const token = cookies.get('session_token')?.value;
      if (verifySessionToken(token)) {
        return redirect('/');
      }
    }
    return next();
  }

  // 3. Verify Session Cookie for all protected routes
  const sessionToken = cookies.get('session_token')?.value;
  const isAuthenticated = verifySessionToken(sessionToken);

  if (!isAuthenticated) {
    if (path.startsWith('/api/')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Sesi tidak valid atau telah kadaluarsa. Silakan login kembali.',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return redirect('/login');
  }

  // 4. CSRF Protection for state-changing requests (POST, PUT, DELETE)
  const method = request.method.toUpperCase();
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const host = request.headers.get('host');

    if (origin || referer) {
      const targetHeader = origin || referer || '';
      try {
        const headerHost = new URL(targetHeader).host;
        if (host && headerHost !== host) {
          return new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'CSRF validation failed: Origin/Referer does not match Host.',
              },
            }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'CSRF validation failed: Invalid origin header.',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  return next();
});
