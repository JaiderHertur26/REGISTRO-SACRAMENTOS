import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ojycdkduikrtkfqvflhl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qeWNka2R1aWtydGtmcXZmbGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNzIxMjcsImV4cCI6MjA4Njk0ODEyN30.Bs0NmiefFev1L3RIG6dhhy3foCOeyKnGESV9Nr7qgzE';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
