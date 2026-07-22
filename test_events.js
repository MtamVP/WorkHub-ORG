const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://gqsbsqaxzpzcloaopzvv.supabase.co";
const SUPABASE_KEY = "sb_publishable_sl9uOpcIzfzN9NZ5D_ZdsQ_FQZchyUR";
const sbClient = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkEventsSchema() {
    const { data, error } = await sbClient.from('events').select('*').limit(1); // Just to verify we don't have user_id
    console.log(data);
    
    // Also try to query column names via RPC or just query with a non-existent column to see the error message which usually lists valid columns
    const { error: colError } = await sbClient.from('events').select('non_existent_column').limit(1);
    console.log("Column error:", colError);
}
checkEventsSchema();
