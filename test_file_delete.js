const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://gqsbsqaxzpzcloaopzvv.supabase.co";
const SUPABASE_KEY = "sb_publishable_sl9uOpcIzfzN9NZ5D_ZdsQ_FQZchyUR";
const sbClient = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testDelete() {
    // 1. Upload a dummy file
    const fileId = "F_TEST_" + Date.now();
    const fileName = "test_delete_general.txt";
    const bucketName = "general_bucket";
    const filePath = `${fileId}_${fileName}`;
    const storage_path = `${bucketName}/${filePath}`;
    
    console.log("Uploading dummy file...");
    const { data: uploadData, error: uploadError } = await sbClient.storage
        .from(bucketName)
        .upload(filePath, "Hello Delete Test", { contentType: 'text/plain' });
    
    if (uploadError) {
        console.error("Upload error:", uploadError);
        return;
    }
    console.log("Uploaded file to storage:", uploadData);

    // 2. Insert into DB
    const { error: insertError } = await sbClient.from('files').insert({
        id: fileId,
        name: fileName,
        storage_path: storage_path,
        mime_type: 'text/plain',
        group_key: 'dashboard'
    });
    if (insertError) {
        console.error("Insert error:", insertError);
        return;
    }
    console.log("Inserted to DB");

    // 3. Emulate API.file.delete
    console.log("Testing API.file.delete logic...");
    const { data: fileData, error: fetchError } = await sbClient.from('files').select('storage_path').eq('id', fileId).single();
    if (fetchError) {
         console.error("Fetch error:", fetchError);
         return;
    }
    console.log("Fetched storage_path:", fileData.storage_path);

    if (fileData && fileData.storage_path) {
        const parts = fileData.storage_path.split('/');
        const bName = parts[0];
        const fPath = parts.slice(1).join('/');
        console.log(`Bucket: ${bName}, FilePath: ${fPath}`);

        if (bName && fPath) {
            const { data: removeData, error: storageError } = await sbClient.storage.from(bName).remove([fPath]);
            console.log("Storage remove result:", removeData);
            if (storageError) console.error("Lỗi xóa file từ storage:", storageError);
        }
    }

    // 4. Delete from DB
    const { error: deleteError } = await sbClient.from('files').delete().eq('id', fileId);
    if (deleteError) {
         console.error("Delete DB error:", deleteError);
    } else {
         console.log("Deleted from DB");
    }
}

testDelete();
