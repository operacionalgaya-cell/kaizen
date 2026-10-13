// Projeto Supabase do Kaizen. A chave "publishable/anon" é PÚBLICA por design (a segurança vem das regras RLS).
// NUNCA coloque aqui a chave service_role / sb_secret_...
// Duas formas de configurar (a variável de ambiente do Vercel tem prioridade):
//   Vercel > Settings > Environment Variables:  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VAPID_PUBLIC_KEY
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || 'https://skhacwqyfqaaihqzwzlz.supabase.co';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || 'COLE_AQUI_A_PUBLISHABLE_KEY';
export const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
