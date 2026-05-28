import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env.local', 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const parts = line.split('=')
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim()
  }
})

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function test() {
  const { count, error } = await supabase
    .from('partes_judiciales')
    .select('*', { count: 'exact', head: true })
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('=== REGISTROS EN PARTES_JUDICIALES ===')
    console.log('Total:', count)
  }
}

test()
