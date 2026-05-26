const https = require('https');

// Token anonimo do Supabase (para simular requisição do frontend)
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Vai falhar se não usarmos o token real, então vamos deixar para testar via frontend

const data = JSON.stringify({ method: 'foods.search', search_expression: 'queijo', max_results: 50 });

const options = {
  hostname: 'cdtouwfxwuhnlzqhcagy.supabase.co',
  path: '/functions/v1/fatsecret-proxy',
  method: 'POST',
  headers: { 
      'Content-Type': 'application/json', 
      'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => { 
      console.log('Status:', res.statusCode); 
      console.log('Body:', body); 
  });
});

req.on('error', console.error);
req.write(data);
req.end();
