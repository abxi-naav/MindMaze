/**
 * MINDMAZE - Supabase Client Configuration
 * TANTRA 2026 | Presented by ENIGMA
 * 
 * Instructions:
 * 1. Create a free project at https://supabase.com
 * 2. Run the provided `supabase-schema.sql` in Supabase SQL Editor
 * 3. Replace the placeholder values below with your Project URL and anon/public Key.
 */

window.MINDMAZE_CONFIG = {
    // Replace with your Supabase Project URL (e.g. "https://xyzcompany.supabase.co")
    SUPABASE_URL: "https://scqdafhkeiogavizgypy.supabase.co",

    // Replace with your Supabase Anon/Public API Key
    SUPABASE_ANON_KEY: "sb_publishable_wQeKPNMZ-eSmpo5VvVHwJg_O6vAfZUj"
};

/**
 * Global Supabase Client Accessor
 */
function getSupabaseClient() {
    if (typeof supabase === 'undefined') {
        console.warn('Supabase JS library not loaded. Running in local/demo mode.');
        return null;
    }

    const url = window.MINDMAZE_CONFIG.SUPABASE_URL;
    const key = window.MINDMAZE_CONFIG.SUPABASE_ANON_KEY;

    if (!url || !key || url.includes('your-project-ref') || key.includes('your-supabase-anon-key')) {
        console.log('Supabase credentials not yet configured in js/supabase-config.js. Running in demo mode.');
        return null;
    }

    try {
        if (!window._supabaseInstance) {
            window._supabaseInstance = supabase.createClient(url, key);
        }
        return window._supabaseInstance;
    } catch (err) {
        console.error('Error initializing Supabase client:', err);
        return null;
    }
}
