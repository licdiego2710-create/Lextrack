import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { imagen, tipo } = await req.json()

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY no está configurada en los secrets del proyecto.')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: tipo || 'image/jpeg', data: imagen },
            },
            {
              type: 'text',
              text: `Analiza esta imagen que contiene un calendario de días inhábiles del Poder Judicial / Consejo de la Judicatura del Estado de Jalisco, México.

Extrae TODAS las fechas de días inhábiles que aparecen. Devuelve ÚNICAMENTE un objeto JSON válido con este formato, sin texto adicional antes ni después:

{"fechas":[{"fecha":"YYYY-MM-DD","nota":"descripción si aparece, si no deja vacío"}]}

Reglas:
- Convierte todas las fechas al formato YYYY-MM-DD
- Si el año no aparece explícito en la imagen usa el año más reciente que tenga sentido
- Si hay un rango de fechas (ej: del 15 al 19 de enero) incluye cada día por separado
- Incluye la nota solo si aparece un motivo claro junto a la fecha (ej: "Periodo vacacional", "Día del Trabajo")
- No incluyas sábados ni domingos (ya se excluyen en la app)`,
            },
          ],
        }],
      }),
    })

    const data = await res.json()
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error))

    const texto = data.content[0].text.trim()
    const match = texto.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('La IA no devolvió un JSON válido. Intenta con una imagen más clara.')

    const resultado = JSON.parse(match[0])
    if (!Array.isArray(resultado.fechas)) throw new Error('Formato inesperado en la respuesta.')

    return new Response(JSON.stringify(resultado), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
