const { createClient } = require('@supabase/supabase-js');
const sbClient = createClient('https://gqsbsqaxzpzcloaopzvv.supabase.co', 'sb_publishable_sl9uOpcIzfzN9NZ5D_ZdsQ_FQZchyUR');
async function test() {
    console.log('Fetching notes...');
    const {data: notes} = await sbClient.from('finance_notes').select('id, title, content').limit(2);
    console.log(notes);
    if (notes && notes.length > 0) {
        const idToDelete = notes[0].id;
        console.log('Deleting', idToDelete);
        const {error} = await sbClient.from('finance_notes').delete().eq('id', idToDelete);
        console.log('Delete error:', error);
        const {data: check} = await sbClient.from('finance_notes').select('id').eq('id', idToDelete);
        console.log('Remaining:', check);
    }
}
test();
