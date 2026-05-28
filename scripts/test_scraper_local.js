/**
 * Prueba rápida del scraper local.
 * Navega al boletín y muestra cuántos acuerdos encontró, SIN insertar nada en BD.
 * Si ve resultados, muestra las primeras 5 filas.
 */
import { chromium } from 'playwright'

const FECHA = process.env.FECHA || new Date().toISOString().slice(0, 10)
const BOLETIN_URL = 'https://cjj.gob.mx/bulletin'

const SEL = {
  fechaInput:    'input[type="date"], input[placeholder*="fecha"], input[name*="fecha"]',
  btnBuscar:     'button[type="submit"], button:has-text("Buscar"), button:has-text("Consultar")',
  selectJuzgado: 'select[name*="juzgado"], select[name*="organo"], select#juzgado, select#organo',
  filas:         'table tbody tr, .acuerdo-row, .boletin-row, tr[data-expediente]',
}

async function main() {
  console.log(`=== TEST SCRAPER LOCAL === Fecha: ${FECHA}`)
  
  const browser = await chromium.launch({ headless: true })
  const page    = await browser.newPage()
  page.setDefaultTimeout(60_000)

  try {
    console.log(`Navegando a ${BOLETIN_URL}...`)
    await page.goto(BOLETIN_URL, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    console.log('Título de la página:', await page.title())
    console.log('HTML length:', (await page.content()).length)

    // Detectar selector de juzgado
    const tieneSelector = await page.$(SEL.selectJuzgado)
    console.log('¿Tiene selector de juzgado?', !!tieneSelector)

    // Detectar input de fecha
    const tieneFecha = await page.$(SEL.fechaInput)
    console.log('¿Tiene input de fecha?', !!tieneFecha)

    if (tieneFecha) {
      await page.fill(SEL.fechaInput, FECHA)
      console.log(`Fecha ${FECHA} ingresada`)
      const btnBuscar = await page.$(SEL.btnBuscar)
      if (btnBuscar) {
        await btnBuscar.click()
        await page.waitForTimeout(3000)
        console.log('Botón buscar presionado')
      }
    }

    // Contar filas
    const filas = await page.$$(SEL.filas)
    console.log(`\nTotal filas encontradas: ${filas.length}`)

    // Mostrar primeras 5
    for (let i = 0; i < Math.min(5, filas.length); i++) {
      const celdas = await filas[i].$$('td')
      const textos = await Promise.all(celdas.map(c => c.textContent()))
      console.log(`Fila ${i+1}:`, textos.map(t => t?.trim().slice(0,60)).join(' | '))
    }

    if (filas.length === 0) {
      console.log('\n⚠ Sin filas — el portal puede no tener boletín para esta fecha o cambió sus selectores CSS.')
      console.log('Capturando screenshot para debug...')
      await page.screenshot({ path: 'bulletin_debug.png', fullPage: true })
      console.log('Screenshot guardado en scripts/bulletin_debug.png')
    } else {
      console.log(`\n✅ El scraper funciona. Se encontraron ${filas.length} filas para fecha ${FECHA}.`)
      console.log('Puedes correr el scraper completo con:')
      console.log(`  $env:SUPABASE_URL="https://srzyzkiozqtsdzydyouk.supabase.co"`)
      console.log(`  $env:SUPABASE_SERVICE_KEY="<TU_SERVICE_ROLE_KEY>"`)
      console.log(`  $env:FECHA="${FECHA}"`)
      console.log(`  node scraper.js`)
    }

  } catch(e) {
    console.error('Error:', e.message)
  } finally {
    await browser.close()
  }
}

main()
