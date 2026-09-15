
const isSupabaseEnabled = (window.CONFIG && window.CONFIG.isSupabaseEnabled) || false;

const SUPABASE_URL = (window.CONFIG && window.CONFIG.SUPABASE_URL) ? window.CONFIG.SUPABASE_URL : '';
const SUPABASE_ANON_KEY = (window.CONFIG && window.CONFIG.SUPABASE_ANON_KEY) ? window.CONFIG.SUPABASE_ANON_KEY : '';

let supabaseClient = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing Supabase:', error);
    }
} else {
    console.error('❌ Supabase configuration missing! Please check .env and config.js');
}
