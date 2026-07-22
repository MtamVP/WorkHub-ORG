const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://gqsbsqaxzpzcloaopzvv.supabase.co";
const SUPABASE_KEY = "sb_publishable_sl9uOpcIzfzN9NZ5D_ZdsQ_FQZchyUR";
const sbClient = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testDelete() {
    // We will list the files in the tasks folder of general_bucket to find one to delete.
    const { data: list, error: listError } = await sbClient.storage.from('general_bucket').list('tasks/T_1784701465876', { limit: 10 });
    console.log("List error:", listError);
    console.log("Uploading dummy file for delete test...");
    const dummyBlob = new Blob(['test delete'], { type: 'text/plain' });
    const { data: uploadData, error: uploadError } = await sbClient.storage.from('general_bucket').upload('tasks/test_delete.txt', dummyBlob);
    console.log("Upload:", uploadData, uploadError);

    if (!uploadError) {
        console.log("Deleting dummy file...");
        const { data, error } = await sbClient.storage.from('general_bucket').remove(['tasks/test_delete.txt']);
        console.log("Remove response data:", data);
        console.log("Remove error:", error);

        const { data: listAfter } = await sbClient.storage.from('general_bucket').list('tasks', { search: 'test_delete' });
        console.log("Files left:", listAfter);
    }
}

testDelete();
