/**
 * Prueba el scraper actualizado contra el Juzgado Primero Civil
 * sin insertar nada en la base de datos
 */
import { chromium } from 'playwright'

const HOY = process.env.FECHA || '2026-05-26'

function normalizarExpediente(num) {
  if (!num) return ''
  return String(num).trim().replace(/\s+/g, '').toUpperCase()
}
function normalizarJuzgado(nombre) {
  if (!nombre) return ''
  return String(nombre).trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').toUpperCase()
}
function inferirMateria(juzgado) {
  if (!juzgado) return null
  const j = juzgado.toLowerCase()
  if (j.includes('civil'))      return 'Civil'
  if (j.includes('mercantil'))  return 'Mercantil'
  if (j.includes('familiar'))   return 'Familiar'
  if (j.includes('penal'))      return 'Penal'
  if (j.includes('administrat')) return 'Administrativo'
  return null
}

async function extraerItems(page, juzgadoNombre) {
  const resultados = []
  try {
    try { await page.waitForSelector('.item', { timeout: 5000 }) } catch { return resultados }
    const items = await page.$$('.item')
    for (const item of items) {
      try {
        const tituloEl = await item.$('.item-title')
        const tituloTexto = tituloEl ? (await tituloEl.textContent()).trim() : ''
        const expMatch = tituloTexto.match(/^\s*(\S+)/)
        const expedienteNum = expMatch ? expMatch[1].trim() : ''
        if (!expedienteNum || expedienteNum.length < 3) continue

        const tipoMatch = tituloTexto.match(/Juicio\s+(.+)$/i)
        const tipoJuicio = tipoMatch ? tipoMatch[1].trim().replace(/\s+/g, ' ') : ''

        const itemTextoEl = await item.$('.item-text')
        const divs = itemTextoEl ? await itemTextoEl.$$('div') : []
        let partesTexto = ''
        let descripcion = ''
        if (divs.length >= 1) partesTexto = ((await divs[0].textContent()) || '').trim()
        if (divs.length >= 2) descripcion = ((await divs[1].textContent()) || '').trim()
        if (divs.length === 1 && !partesTexto.includes(' vs. ')) { descripcion = partesTexto; partesTexto = '' }

        let actor = null, demandado = null
        const vsMatch = partesTexto.match(/^(.+?)\s+vs\.\s+(.*)$/i)
        if (vsMatch) { actor = vsMatch[1].trim() || null; demandado = vsMatch[2].trim() || null; if (!demandado) demandado = null }
        else if (partesTexto) actor = partesTexto

        resultados.push({ expediente_num: normalizarExpediente(expedienteNum), juzgado: normalizarJuzgado(juzgadoNombre || ''), materia: inferirMateria(juzgadoNombre || ''), actor: actor?.slice(0, 300) || null, demandado: demandado?.slice(0, 300) || null, fecha: HOY, descripcion: (tipoJuicio + (descripcion ? ' — ' + descripcion : '')).slice(0, 1000) })
      } catch { }
    }
  } catch (e) { console.error('Error:', e.message) }
  return resultados
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)

  console.log(`=== TEST SCRAPER ACTUALIZADO === Fecha: ${HOY}`)
  await page.goto('https://cjj.gob.mx/bulletin', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // Probar con los primeros 3 juzgados
  const opciones = await page.$$eval('select[name="judge"] option', opts =>
    opts.filter(o => o.value).slice(0, 3).map(o => ({ value: o.value, text: o.textContent.trim() }))
  )
  console.log(`Juzgados a probar: ${opciones.map(o => o.text).join(', ')}`)

  let totalAcuerdos = 0
  for (const op of opciones) {
    await page.selectOption('select[name="judge"]', op.value)
    await page.waitForTimeout(500)
    const radioFecha = await page.$('input[type="radio"][id="date"]')
    if (radioFecha) await radioFecha.check()
    await page.fill('input[type="date"][name="date"]', HOY)
    await page.waitForTimeout(300)
    await page.click('button.search-button')
    await page.waitForTimeout(3000)

    const acuerdos = await extraerItems(page, op.text)
    totalAcuerdos += acuerdos.length
    console.log(`\n${op.text}: ${acuerdos.length} acuerdos`)
    acuerdos.slice(0, 2).forEach((a, i) => {
      console.log(`  [${i+1}] Exp: ${a.expediente_num} | Actor: ${a.actor?.slice(0,40)} | Demandado: ${a.demandado?.slice(0,40)}`)
    })
  }

  console.log(`\n✅ Total acuerdos extraídos de 3 juzgados: ${totalAcuerdos}`)
  if (totalAcuerdos > 0) {
    console.log('El scraper actualizado funciona. Puedes correr scraper.js completo con:')
    console.log(`  $env:SUPABASE_URL="https://srzyzkiozqtsdzydyouk.supabase.co"`)
    console.log(`  $env:SUPABASE_SERVICE_KEY="<TU_SERVICE_ROLE_KEY>"`)
    console.log(`  $env:FECHA="${HOY}"`)
    console.log(`  node scraper.js`)
  }

  await browser.close()
}

main()
