
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

    // OAuth 2.0 Client Credentials Grant
    const basicAuth = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)
    
    const tokenResponse = await fetch('https://oauth.fatsecret.com/connect/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials&scope=basic'
    })

    if (!tokenResponse.ok) {
        const errData = await tokenResponse.text()
        throw new Error(`FatSecret Token Auth Error: ${errData}`)
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Parâmetros da chamada da API
    const apiParams = new URLSearchParams()
    apiParams.append('method', method)
    apiParams.append('format', 'json')
    
    if (method === 'foods.search') {
      apiParams.append('search_expression', search_expression)
      apiParams.append('max_results', '50')
    } else if (method === 'food.get') {
      apiParams.append('food_id', food_id)
    }

    const response = await fetch('https://platform.fatsecret.com/rest/server.api', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: apiParams.toString()
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
