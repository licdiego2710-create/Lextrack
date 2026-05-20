import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://srzyzkiozqtsdzydyouk.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_x0biQ3dG9yyf6HlxRViZJg_66x97wbI'

export const supabase = createClient(url, key)