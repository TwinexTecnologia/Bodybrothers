
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Em produção, use Deno.env.get('FATSECRET_CLIENT_ID')
// Aqui estamos hardcoding conforme solicitado para o ambiente, mas idealmente deve ser via secrets
const CLIENT_ID = Deno.env.get('FATSECRET_CLIENT_ID') || 'f120d22b0e37437e856191c6160bf15c'
const CLIENT_SECRET = Deno.env.get('FATSECRET_CLIENT_SECRET') || 'a14bfc4a3d6042a99157ff329b0537ea'

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { method, search_expression, food_id } = await req.json()
    
    if (!method) throw new Error('Method required')

    // OAuth 1.0 Parameters
    const params: Record<string, string> = {
      format: 'json',
      method: method,
      oauth_consumer_key: CLIENT_ID,
      oauth_nonce: Math.random().toString(36).substring(2),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0',
    }

    if (method === 'foods.search') {
      if (!search_expression) throw new Error('search_expression required')
      params.search_expression = search_expression
      params.max_results = '10'
    } else if (method === 'food.get') {
      if (!food_id) throw new Error('food_id required')
      params.food_id = food_id
    }

    // Signature Generation
    // 1. Sort keys
    const sortedKeys = Object.keys(params).sort()
    
    // 2. Construct parameter string
    // RFC 3986 encoding needed
    const percentEncode = (str: string) => {
      return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
      });
    }

    const paramString = sortedKeys.map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&')
    
    // 3. Construct base string
    const baseString = `POST&${percentEncode('https://platform.fatsecret.com/rest/server.api')}&${percentEncode(paramString)}`
    
    // 4. Signing Key
    const signingKey = `${percentEncode(CLIENT_SECRET)}&`

    // 5. HMAC-SHA1
    const keyData = new TextEncoder().encode(signingKey)
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(baseString))
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))

    params.oauth_signature = signatureBase64

    // Execute Request
    const bodyParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      bodyParams.append(key, value)
    }

    const response = await fetch('https://platform.fatsecret.com/rest/server.api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: bodyParams
    })

    const data = await response.json()
    
    return new Response(JSON.stringify(data), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    })
  }
})
