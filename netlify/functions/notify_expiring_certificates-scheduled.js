export async function handler() {
  return {
    statusCode: 200,
    body: JSON.stringify({
      keyStart: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10) || 'not found'
    })
  };
}
