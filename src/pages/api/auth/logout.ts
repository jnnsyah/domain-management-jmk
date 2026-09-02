import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete('session_token', { path: '/' });
  return new Response(
    JSON.stringify({ success: true, message: 'Berhasil logout' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
