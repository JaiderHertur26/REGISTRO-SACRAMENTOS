import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "⚠️ Atención: Faltan las credenciales de Supabase en el archivo .env.\n" +
    "Asegúrate de tener VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY."
  );
}

// Inicializa y exporta el cliente para usarlo en toda la app
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');