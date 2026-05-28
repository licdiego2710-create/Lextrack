/**
 * Test v3 - espera el texto "resultados encontrados" antes de extraer .item
 */
import { chromium } from 'playwright'

const HOY = process.env.FECHA || '2026-05-26'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)

  console.log(`=== TEST SCRAPER v3 === Fecha: ${HOY}`)
  await page.goto('https://cjj.gob.mx/bulletin', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // Solo probar el primer juzgado
  const opciones = await page.$$eval('select[name="judge"] option', opts =>
    opts.filter(o => o.value).slice(0, 1).map(o => ({ value: o.value, text: o.textContent.trim() }))
  )
  const op = opciones[0]
  console.log(`Probando: ${op.text} (${op.value})`)

  // Seleccionar juzgado
  await page.selectOption('select[name="judge"]', op.value)
  await page.waitForTimeout(800)

  // Asegurar "Por Fecha"
  const radioFecha = await page.$('input[type="radio"][id="date"]')
  if (radioFecha) await radioFecha.check()

  // Llenar fecha
  await page.fill('input[type="date"][name="date"]', HOY)
  await page.waitForTimeout(300)

  // Tomar screenshot ANTES de buscar
  await page.screenshot({ path: 'before_search.png' })
  console.log('Screenshot antes de buscar guardado')

  // Hacer click en Buscar
  await page.click('button.search-button')
  console.log('Click en Buscar realizado')

  // Esperar que aparezca el texto de resultados (hasta 15 segundos)
  try {
    await page.waitForSelector('text=resultados encontrados', { timeout: 15000 })
    console.log('✅ Texto "resultados encontrados" detectado')
  } catch {
    console.log('⚠ No apareció "resultados encontrados" en 15s')
  }

  // Tomar screenshot DESPUÉS de buscar
  await page.screenshot({ path: 'after_search.png' })
  console.log('Screenshot después de buscar guardado')

  // Contar .item
  const count = await page.$$eval('.item', els => els.length)
  console.log(`\n.item encontrados: ${count}`)

  if (count > 0) {
    // Mostrar primeras 3
    const data = await page.$$eval('.item', els => els.slice(0, 3).map(el => ({
      titulo: el.querySelector('.item-title')?.textContent.trim(),
      texto: el.querySelector('.item-text')?.textContent.trim().slice(0, 100)
    })))
    data.forEach((d, i) => console.log(`  [${i+1}] ${d.titulo} | ${d.texto}`))
  }

  // Verificar texto del page completo
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500))
  console.log('\nTexto del body (primeros 500 chars):')
  console.log(bodyText)

  await browser.close()
}

main()
