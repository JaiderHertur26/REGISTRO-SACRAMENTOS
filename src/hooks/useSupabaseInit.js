import { useState, useEffect } from 'react';
import { useAppData } from '@/context/AppDataContext';

const useSupabaseInit = () => {
  const { initSupabaseConnection, supabaseConnected } = useAppData();
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const attemptConnection = async () => {
      try {
        const url = localStorage.getItem('supabase_url');
        const key = localStorage.getItem('supabase_key');

        // No credentials
        if (!url || !key) {
          if (isMounted) {
            setError('Credenciales de Supabase no configuradas');
            setIsInitialized(true);
          }
          return;
        }

        // Already connected
        if (supabaseConnected) {
          if (isMounted) setIsInitialized(true);
          return;
        }

        // Attempt connection
        const result = await initSupabaseConnection(url, key);

        if (!result?.success) {
          throw new Error(result?.message || 'Error al conectar con Supabase');
        }

        if (isMounted) setIsInitialized(true);

      } catch (err) {
        if (isMounted) {
          setError(
            err?.message ||
            'Error desconocido durante la inicialización de Supabase'
          );
          setIsInitialized(true);
        }
      }
    };

    attemptConnection();

    return () => {
      isMounted = false;
    };
  }, [initSupabaseConnection, supabaseConnected]);

  return { isInitialized, error };
};

export default useSupabaseInit;