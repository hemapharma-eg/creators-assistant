export default async function handler(req, res) {
  // We only accept POST requests to keep things secure
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, redirect_uri } = req.body;

  if (!code || !redirect_uri) {
    return res.status(400).json({ error: 'Missing authorization code or redirect_uri' });
  }

  // Ensure the environment variables are set inside Vercel
  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) {
    console.error('Missing TikTok credentials in Vercel Environment Variables');
    return res.status(500).json({ error: 'Server misconfiguration: Missing TikTok Developer Credentials in Vercel.' });
  }

  try {
    // TikTok rigorously requires parameters to be URL Form Encoded, not JSON!
    const params = new URLSearchParams();
    params.append('client_key', process.env.TIKTOK_CLIENT_KEY);
    params.append('client_secret', process.env.TIKTOK_CLIENT_SECRET);
    params.append('code', code);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', redirect_uri);

    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: params
    });

    const data = await response.json();
    
    if (!response.ok || data.error) {
      console.error('TikTok Token Exchange Error:', data);
      return res.status(400).json({ 
        error: data.error_description || data.error || 'Failed to exchange token with TikTok servers',
        details: data
      });
    }

    // Success! Return the highly-sensitive access_token, open_id, and refresh_token back to your frontend memory.
    // The frontend will immediately use this token to begin processing the secure video upload!
    return res.status(200).json(data);

  } catch (error) {
    console.error('Internal server error during TikTok auth:', error);
    return res.status(500).json({ error: 'Internal backend server process crashed.' });
  }
}
