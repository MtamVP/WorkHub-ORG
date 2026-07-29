const { createClient } = require('@supabase/supabase-js');
const sbClient = createClient('https://gqsbsqaxzpzcloaopzvv.supabase.co', 'sb_publishable_sl9uOpcIzfzN9NZ5D_ZdsQ_FQZchyUR');
async function test() {
    const id = "FN_TEST_" + Date.now();
    console.log('Inserting', id);
    const {error: insertErr} = await sbClient.from('finance_notes').insert({
        id: id,
        title: 'Test Note',
        content: 'Test Content',
        author_id: '8daf4986-d0e7-47a1-946a-b024446f25f2' // UUID from screenshot
    });
    console.log('Insert err:', insertErr);
    
    console.log('Fetching note...');
    const {data: notes} = await sbClient.from('finance_notes').select('*').eq('id', id);
    console.log('Fetched:', notes);
    
    if (notes && notes.length > 0) {
        console.log('Deleting', id);
        const {data: delData, error: delErr} = await sbClient.from('finance_notes').delete().eq('id', id).select();
        console.log('Delete err:', delErr);
        console.log('Deleted data:', delData);
    }
}
test();
