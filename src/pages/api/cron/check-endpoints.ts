import type { APIRoute } from 'astro';
import { checkAllActiveEndpoints } from '@/lib/health-checker';

export const GET: APIRoute = async () => {
  try {
    const summary = await checkAllActiveEndpoints();
    return new Response(
      JSON.stringify({
        success: true,
        summary,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Cron check endpoints error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Gagal menjalankan cron health checker.' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
