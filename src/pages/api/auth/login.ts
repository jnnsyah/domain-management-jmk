import type { APIRoute } from 'astro';
import { validatePassword, createSessionToken } from '@/lib/auth';
import { isRateLimited, recordFailedAttempt, resetAttempts } from '@/lib/rate-limiter';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || clientAddress || '127.0.0.1';

  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Terlalu banyak percobaan login gagal. Silakan coba lagi nanti (15 menit).',
        },
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { password } = body;

    if (!password || typeof password !== 'string') {
      recordFailedAttempt(ip);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Password wajib diisi.',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const isValid = validatePassword(password);
    if (!isValid) {
      recordFailedAttempt(ip);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Password yang dimasukkan salah.',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Success: reset attempts and set cookie
    resetAttempts(ip);
    const token = createSessionToken();

    cookies.set('session_token', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Login error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Terjadi kesalahan internal server.',
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
