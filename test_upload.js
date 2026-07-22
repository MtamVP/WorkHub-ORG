const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = "https://gqsbsqaxzpzcloaopzvv.supabase.co";
const SUPABASE_KEY = "sb_publishable_sl9uOpcIzfzN9NZ5D_ZdsQ_FQZchyUR";
const sbClient = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    console.log("Uploading dummy file...");
    const dummyBlob = new Blob(['hello world'], { type: 'text/plain' });
    const { data, error } = await sbClient.storage.from('general_bucket').upload('test/hello.txt', dummyBlob, {
        contentType: 'text/plain'
    });
    if (error) {
        console.error("Upload Error:", error);
    } else {
        console.log("Upload Success:", data);
    }
}

test();
