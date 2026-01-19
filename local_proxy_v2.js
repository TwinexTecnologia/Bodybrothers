
const http = require('http');
const crypto = require('crypto');
const https = require('https');

const PORT = 54321;
const CONSUMER_KEY = 'f120d22b0e37437e856191c6160bf15c';
const CONSUMER_SECRET = 'a14bfc4a3d6042a99157ff329b0537ea';

// Função de Encode RFC 3986 Estrita
function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/functions/v1/fatsecret-proxy' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const input = JSON.parse(body);
                console.log('[Proxy] Request:', input);

                const params = {
                    oauth_consumer_key: CONSUMER_KEY,
                    oauth_nonce: crypto.randomBytes(16).toString('hex'),
                    oauth_signature_method: 'HMAC-SHA1',
                    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
                    oauth_version: '1.0',
                    format: 'json',
                    method: input.method
                };

                if (input.method === 'foods.search') {
                    params.search_expression = input.search_expression;
                    params.max_results = '10';
                } else if (input.method === 'food.get') {
                    params.food_id = input.food_id;
                }

                // 1. Sort
                const sortedKeys = Object.keys(params).sort();
                
                // 2. Param String
                const paramString = sortedKeys
                    .map(k => `${percentEncode(k)}=${percentEncode(params[k])}`)
                    .join('&');

                // 3. Base String
                const method = 'POST';
                const url = 'https://platform.fatsecret.com/rest/server.api';
                const baseString = `${method}&${percentEncode(url)}&${percentEncode(paramString)}`;

                // 4. Signing Key
                const signingKey = `${percentEncode(CONSUMER_SECRET)}&`;

                // 5. Signature
                const hmac = crypto.createHmac('sha1', signingKey);
                hmac.update(baseString);
                const signature = hmac.digest('base64');

                params.oauth_signature = signature;

                // 6. Send
                const postData = new URLSearchParams();
                for (const key in params) {
                    postData.append(key, params[key]);
                }
                const postDataStr = postData.toString();

                console.log('[Proxy] Sending to FatSecret...');

                const apiReq = https.request('https://platform.fatsecret.com/rest/server.api', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Content-Length': Buffer.byteLength(postDataStr)
                    }
                }, (apiRes) => {
                    let apiBody = '';
                    apiRes.on('data', d => apiBody += d);
                    apiRes.on('end', () => {
                        console.log('[Proxy] Response Status:', apiRes.statusCode);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(apiBody);
                    });
                });

                apiReq.on('error', (e) => {
                    console.error(e);
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: e.message }));
                });

                apiReq.write(postDataStr);
                apiReq.end();

            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`Proxy v2 running on port ${PORT}`);
});
