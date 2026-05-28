/**
 * Inspecciona la estructura de los resultados del boletín CJJ Jalisco
 * para obtener los selectores correctos de las cards de resultados (Angular SPA)
 */
import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  
  await page.goto('https://cjj.gob.mx/bulletin', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // Seleccionar primer juzgado (C01 = Juzgado Primero Civil)
  await page.selectOption('select[name="judge"]', 'C01')
  await page.waitForTimeout(500)
  await page.fill('input[type="date"][name="date"]', '2026-05-26')
  await page.waitForTimeout(300)
  await page.click('button.search-button')
  await page.waitForTimeout(4000)  // Esperar respuesta Angular

  // Inspeccionar la estructura del DOM de resultados
  const bodyHtml = await page.evaluate(() => {
    // Buscar el contenedor de resultados
    const containers = ['app-root', '.results', '.acuerdos', '.boletin-results', '.results-container', '[class*="result"]', '[class*="acuerdo"]']
    for (const sel of containers) {
      const el = document.querySelector(sel)
      if (el) return `FOUND ${sel}: ${el.innerHTML.slice(0, 2000)}`
    }
    // Si no hay ninguno específico, buscar en el body
    return document.body.innerHTML.slice(5000, 8000)
  })
  console.log('=== DOM STRUCTURE ===')
  console.log(bodyHtml.slice(0, 3000))

  // Intentar distintos selectores de cards
  const candidates = [
    '.result-item', '.acuerdo-item', '.boletin-item', '.card', 
    '[class*="result-"]', '[class*="acuerdo"]', 'app-result',
    '.list-group-item', '.accordion-item', 'mat-card', '.mat-card',
    '.ng-star-inserted', 'li', '.item'
  ]
  
  for (const sel of candidates) {
    const count = await page.$$eval(sel, els => els.length).catch(() => 0)
    if (count > 0) console.log(`Selector "${sel}": ${count} elementos`)
  }

  // Buscar el texto "52 resultados" para ubicar el contenedor
  const resultText = await page.locator('text=resultados encontrados').first().evaluate(el => {
    return el.parentElement?.innerHTML?.slice(0, 500) || 'no encontrado'
  }).catch(() => 'error')
  console.log('\n=== CONTENEDOR DE RESULTADOS ===')
  console.log(resultText)

  await browser.close()
}

main()
