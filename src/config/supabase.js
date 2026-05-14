import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment')
  process.exit(1)
}

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function query(sql, params = []) {
  const { data, error } = await supabase.rpc('exec_sql', { query_text: sql })
  if (error) {
    const { data: d, error: e } = await supabase
      .from('_sql_exec')
      .select('*')
    if (e) throw e
    return d
  }
  return data
}

export async function rawQuery(sql) {
  const { data, error } = await supabase.rpc('exec_raw_sql', { sql })
  if (error) throw error
  return data
}
