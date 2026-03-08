import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  document.body.innerHTML = '<div style="font-family:sans-serif;padding:40px;color:#DC2626"><h2>配置错误</h2><p>缺少环境变量 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY</p><p style="color:#78716C;font-size:13px">请在 Vercel → Settings → Environment Variables 中添加后重新部署</p></div>'
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
