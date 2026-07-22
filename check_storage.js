const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://gqsbsqaxzpzcloaopzvv.supabase.co";
const SUPABASE_KEY = "sb_publishable_sl9uOpcIzfzN9NZ5D_ZdsQ_FQZchyUR";
const sbClient = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkStorage() {
    const { data, error } = await sbClient.storage.from('general_bucket').list();
    if (error) {
        console.error("Error listing general_bucket:", error);
    } else {
        console.log("general_bucket root files:", data);
    }
    
    // Also check tasks folder
    const { data: taskData, error: taskError } = await sbClient.storage.from('general_bucket').list('tasks');
    if (taskError) {
        console.error("Error listing tasks:", taskError);
    } else {
        console.log("general_bucket/tasks folders:", taskData);
    }
}

checkStorage();
