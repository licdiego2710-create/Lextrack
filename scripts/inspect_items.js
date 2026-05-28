/**
 * Inspecciona la estructura interna de un .item del boletín CJJ
 * para mapear los campos exactos de expediente, actor, demandado, etc.
 */
import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  
  await page.goto('https://cjj.gob.mx/bulletin', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  await page.selectOption('select[name="judge"]', 'C01')
  await page.waitForTimeout(500)
  await page.fill('input[type="date"][name="date"]', '2026-05-26')
  await page.click('button.search-button')
  await page.waitForTimeout(4000)

  // HTML de los primeros 3 items
  const items = await page.$$('.item')
  console.log(`Total .item: ${items.length}`)

  for (let i = 0; i < Math.min(3, items.length); i++) {
    const html = await items[i].evaluate(el => el.outerHTML)
    console.log(`\n=== ITEM ${i+1} HTML ===`)
    console.log(html.slice(0, 1500))
  }

  // Extraer texto de todos los items con sus clases internas
  const data = await page.$$eval('.item', els => els.slice(0, 5).map(el => {
    const texts = {}
    // Buscar spans, divs con clases significativas
    el.querySelectorAll('[class]').forEach(child => {
      const cls = child.className.toString().trim().slice(0, 40)
      const txt = child.textContent.trim().slice(0, 100)
      if (txt) texts[cls] = txt
    })
    return { fullText: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 300), classes: texts }
  }))

  console.log('\n=== CONTENIDO DE ITEMS (primeros 5) ===')
  data.forEach((d, i) => {
    console.log(`\nItem ${i+1}:`)
    console.log('  Texto:', d.fullText)
    console.log('  Clases internas:', JSON.stringify(d.classes, null, 4).slice(0, 800))
  })

  await browser.close()
}

main()
