import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  
  await page.goto('https://cjj.gob.mx/bulletin', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // Inspeccionar todos los <select>
  const selects = await page.$$eval('select', els => els.map(e => ({
    id: e.id,
    name: e.name,
    className: e.className,
    optionCount: e.options.length,
    firstOptions: [...e.options].slice(0, 5).map(o => ({ value: o.value, text: o.textContent.trim() }))
  })))
  console.log('=== SELECTS ===')
  console.log(JSON.stringify(selects, null, 2))

  // Inspeccionar botones
  const buttons = await page.$$eval('button', els => els.map(e => ({
    type: e.type,
    text: e.textContent.trim().slice(0, 50),
    class: e.className.slice(0, 60)
  })))
  console.log('=== BUTTONS ===')
  console.log(JSON.stringify(buttons, null, 2))

  // Inspeccionar inputs
  const inputs = await page.$$eval('input', els => els.map(e => ({
    type: e.type,
    name: e.name,
    id: e.id,
    placeholder: e.placeholder
  })))
  console.log('=== INPUTS ===')
  console.log(JSON.stringify(inputs, null, 2))

  // Si hay selects con opciones, seleccionar el primero y buscar
  if (selects.length > 0 && selects[0].optionCount > 1) {
    const firstSelect = selects[0]
    const firstOption = firstSelect.firstOptions.find(o => o.value)
    console.log('\n=== SELECCIONANDO PRIMER JUZGADO:', firstOption?.text, '===')
    
    await page.selectOption('select', firstOption?.value || firstSelect.firstOptions[1]?.value)
    await page.waitForTimeout(1000)
    
    // Llenar fecha
    const fechaInput = await page.$('input[type="date"]')
    if (fechaInput) {
      await fechaInput.fill('2026-05-26')
    }
    
    // Hacer clic en Buscar
    const btn = await page.$('button:has-text("Buscar"), button[type="submit"]')
    if (btn) {
      await btn.click()
      await page.waitForTimeout(3000)
    }
    
    // Ver cuántas filas aparecieron
    const filas = await page.$$('table tbody tr')
    console.log('Filas en tabla después de buscar:', filas.length)
    
    for (let i = 0; i < Math.min(3, filas.length); i++) {
      const textos = await filas[i].$$eval('td', tds => tds.map(td => td.textContent.trim().slice(0, 50)))
      console.log(`Fila ${i+1}:`, textos)
    }
    
    await page.screenshot({ path: 'bulletin_after_search.png', fullPage: false })
    console.log('Screenshot guardado: bulletin_after_search.png')
  }

  await browser.close()
}

main()
