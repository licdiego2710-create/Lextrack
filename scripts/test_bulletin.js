import { chromium } from 'playwright'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  try {
    console.log('Navigating to bulletin...')
    await page.goto('https://cjj.gob.mx/bulletin', { waitUntil: 'networkidle', timeout: 30000 })
    console.log('Title:', await page.title())
    const html = await page.content()
    console.log('HTML length:', html.length)
  } catch (e) {
    console.error('Error:', e)
  } finally {
    await browser.close()
  }
}
run()
