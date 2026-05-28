import fs from 'fs'

try {
  let content = fs.readFileSync('c:/Users/licdi/lextrack-mx/run_log.txt', 'utf-16le')
  if (!content.includes('Temporary')) {
    content = fs.readFileSync('c:/Users/licdi/lextrack-mx/run_log.txt', 'utf-8')
  }

  console.log('File length:', content.length)
  const lines = content.split('\n')
  console.log('Total lines:', lines.length)
  
  // Print lines containing "B64" or "Temporary" or "Secret"
  lines.forEach((line, idx) => {
    if (line.includes('B64') || line.includes('Temporary') || line.includes('Secret') || line.includes('secret')) {
      console.log(`Line ${idx}:`, line.trim())
    }
  })
} catch (e) {
  console.error('Error:', e.message)
}
