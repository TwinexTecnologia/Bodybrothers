
const http = require('http');
const crypto = require('crypto');
const url = require('url');

// Configurações
const PORT = 54321;
const CLIENT_ID = 'f120d22b0e37437e856191c6160bf15c';
const CLIENT_SECRET = 'a14bfc4a3d6042a99157ff329b0537ea';

const server = http.createServer(async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization, x-client-info, apikey');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Rota correta
    if (req.url === '/functions/v1/fatsecret-proxy' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { method, search_expression, food_id } = JSON.parse(body);

                if (!method) throw new Error('Method required');

                console.log(`[Proxy] Recebendo requisição: ${method} - ${search_expression || food_id}`);

                // CORREÇÃO DEFINITIVA DA ASSINATURA OAUTH 1.0 (RFC 3986)
                
                // 1. Função rigorosa de Encoding RFC 3986
                function fixedEncodeURIComponent(str) {
                    if (str === null || str === undefined) return '';
                    return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
                      return '%' + c.charCodeAt(0).toString(16).toUpperCase();
                    });
                }

                // 1. Definir parâmetros OAuth 1.0
                const oauthParams = {
                    format: 'json',
                    oauth_consumer_key: CLIENT_ID,
                    oauth_nonce: crypto.randomBytes(16).toString('hex'),
                    oauth_signature_method: 'HMAC-SHA1',
                    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
                    oauth_version: '1.0'
                };

                // Adiciona parâmetros específicos
                if (method === 'foods.search') {
                    oauthParams.method = 'foods.search';
                    oauthParams.search_expression = search_expression;
                    oauthParams.max_results = '10';
                } else if (method === 'food.get') {
                    oauthParams.method = 'food.get';
                    oauthParams.food_id = food_id;
                }

                // 1. Sort Keys e Encoding (Parameter String)
                // A ordem alfabética é CRUCIAL
                const sortedKeys = Object.keys(oauthParams).sort();
                const paramString = sortedKeys
                    .map(key => fixedEncodeURIComponent(key) + '=' + fixedEncodeURIComponent(oauthParams[key]))
                    .join('&');

                // 3. Montar Base String
                // Formato exigido: HTTP_METHOD & URL_ENCODED & PARAM_STRING_ENCODED
                const httpMethod = 'POST';
                const baseUrl = 'http://platform.fatsecret.com/rest/server.api';
                const baseString = [
                    httpMethod,
                    fixedEncodeURIComponent(baseUrl),
                    fixedEncodeURIComponent(paramString)
                ].join('&');

                // 3. Signing Key
                // Consumer Secret + & + Token Secret (vazio neste caso)
                const signingKey = fixedEncodeURIComponent(CLIENT_SECRET) + '&';

                // 4. Gerar Assinatura (HMAC-SHA1)
                const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
                
                // 5. Adicionar assinatura aos parâmetros
                oauthParams.oauth_signature = signature;

                // 6. Preparar corpo da requisição (x-www-form-urlencoded)
                const bodyStr = Object.keys(oauthParams)
                    .map(key => fixedEncodeURIComponent(key) + '=' + fixedEncodeURIComponent(oauthParams[key]))
                    .join('&');

                console.log('[Proxy] BaseString:', baseString);
                console.log('[Proxy] Signature:', signature);
                console.log('[Proxy] Enviando POST...');
                
                const response = await fetch('https://platform.fatsecret.com/rest/server.api', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: bodyStr
                });
                
                const data = await response.json();
                console.log('[Proxy] Resultado do FatSecret:', JSON.stringify(data).substring(0, 100) + '...');
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));

            } catch (error) {
                console.error('[Proxy] Erro:', error.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`\n🚀 Proxy Local FatSecret rodando em http://localhost:${PORT}/functions/v1/fatsecret-proxy`);
    console.log('✅ Pronto para testar no Personal!\n');
});
