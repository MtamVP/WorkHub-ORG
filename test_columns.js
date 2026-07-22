const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://gqsbsqaxzpzcloaopzvv.supabase.co";
const SUPABASE_KEY = "sb_publishable_sl9uOpcIzfzN9NZ5D_ZdsQ_FQZchyUR";
const sbClient = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    const { data, error } = await sbClient.from('tasks').select('*').limit(1);
    if (error) console.error(error);
    console.log("Tasks first row:", data);
}

test();
