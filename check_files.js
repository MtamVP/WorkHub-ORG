const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://gqsbsqaxzpzcloaopzvv.supabase.co";
const SUPABASE_KEY = "sb_publishable_sl9uOpcIzfzN9NZ5D_ZdsQ_FQZchyUR";
const sbClient = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkFiles() {
    const { data, error } = await sbClient.from('files').select('id, name, storage_path');
    if (error) {
        console.error("Error:", error);
        return;
    }
    console.log("Files:", data);
}

checkFiles();
