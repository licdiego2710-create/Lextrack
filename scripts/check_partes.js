import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://srzyzkiozqtsdzydyouk.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_x0biQ3dG9yyf6HlxRViZJg_66x97wbI'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function run() {
  const { count, error } = await supabase
    .from('partes_judiciales')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error('Error querying partes_judiciales:', error)
  } else {
    console.log('Total records in partes_judiciales:', count)
  }

  const { data, error: dataError } = await supabase
    .from('partes_judiciales')
    .select('*')
    .limit(5)

  if (dataError) {
    console.error('Error fetching sample data:', dataError)
  } else {
    console.log('Sample records in partes_judiciales:', data)
  }
}

run()
