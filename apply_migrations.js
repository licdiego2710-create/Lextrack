/**
 * apply_migrations.js
 * Aplica todas las migraciones SQL pendientes de LexTrack MX
 * vía la API REST de Supabase (usando service_role key).
 *
 * Uso:
 *   node apply_migrations.js <SUPABASE_SERVICE_ROLE_KEY>
 *
 * El service_role key se obtiene en:
 *   https://supabase.com/dashboard/project/srzyzkiozqtsdzydyouk/settings/api
 *   -> Project API keys -> service_role (secret)
 */

import fs from 'fs'
import https from 'https'

const PROJECT_REF = 'srzyzkiozqtsdzydyouk'
const SERVICE_KEY = process.argv[2]

if (!SERVICE_KEY) {
  console.error('\n❌ Falta el service_role key.\n')
  console.error('Uso:  node apply_migrations.js <SERVICE_ROLE_KEY>\n')
  console.error('Obtenlo en: https://supabase.com/dashboard/project/srzyzkiozqtsdzydyouk/settings/api\n')
  process.exit(1)
}

// Orden de ejecución de migraciones
const MIGRATIONS = [
  'supabase/migrations/20260526_fix_rls_recursion.sql',
  'supabase/migrations/20260526_client_portal.sql',
  'supabase/migrations/20260526_client_billing.sql',
  'supabase/migrations/20260526_client_portal_rls.sql',
  'supabase/migrations/20260526_document_templates.sql',
]

function execSQL(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql })
    const options = {
      hostname: `${PROJECT_REF}.supabase.co`,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }

    // Usar la Management API
    const mgmtOptions = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }

    const req = https.request(mgmtOptions, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data })
        } else {
          resolve({ success: false, status: res.statusCode, data })
        }
      })
    })

    req.on('error', (err) => reject(err))
    req.write(body)
    req.end()
  })
}

async function run() {
  console.log('\n🚀 Aplicando migraciones de LexTrack MX...\n')
  console.log(`📡 Proyecto: ${PROJECT_REF}`)
  console.log(`📁 Total de migraciones: ${MIGRATIONS.length}\n`)
  console.log('─'.repeat(60))

  let successCount = 0
  let errorCount = 0

  for (const migFile of MIGRATIONS) {
    const fileName = migFile.split('/').pop()
    process.stdout.write(`⏳ ${fileName} ... `)

    if (!fs.existsSync(migFile)) {
      console.log(`⚠️  OMITIDO (archivo no encontrado)`)
      continue
    }

    const sql = fs.readFileSync(migFile, 'utf-8')
    
    try {
      const result = await execSQL(sql)
      if (result.success) {
        console.log('✅ OK')
        successCount++
      } else {
        // Intentar parsear el error
        let errMsg = result.data
        try {
          const parsed = JSON.parse(result.data)
          errMsg = parsed.message || parsed.error || result.data
        } catch {}
        
        // Si es un error de "ya existe", lo tratamos como éxito
        if (errMsg.includes('already exists') || errMsg.includes('duplicate') || errMsg.includes('42P07') || errMsg.includes('42710')) {
          console.log('✅ OK (ya existía, sin cambios)')
          successCount++
        } else {
          console.log(`❌ ERROR (HTTP ${result.status})`)
          console.log(`   └─ ${errMsg.slice(0, 200)}`)
          errorCount++
        }
      }
    } catch (err) {
      console.log(`❌ ERROR de red: ${err.message}`)
      errorCount++
    }
  }

  console.log('─'.repeat(60))
  console.log(`\n📊 Resultado: ${successCount} exitosas, ${errorCount} con error`)
  
  if (errorCount === 0) {
    console.log('\n✅ ¡Todas las migraciones aplicadas con éxito!\n')
    console.log('Próximos pasos:')
    console.log('  1. Inicia el servidor: npm run dev')
    console.log('  2. Prueba el portal de clientes invitando un usuario con rol "cliente"')
    console.log('  3. Verifica las plantillas de documentos en Documentos > Plantillas de Escritos\n')
  } else {
    console.log('\n⚠️  Algunas migraciones fallaron. Revisa los errores arriba.')
    console.log('Puedes ejecutar el SQL manualmente en:')
    console.log(`  https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new\n`)
  }
}

run().catch(err => {
  console.error('\n💥 Error fatal:', err.message)
  process.exit(1)
})
