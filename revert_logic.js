const fs = require('fs');
const newLogic = `
window.handleLoginBgUpload = function(input) {
    if (input.files && input.files[0]) {
        var file = input.files[0];
        if (file.size > 700 * 1024) { Swal.fire('Ảnh nặng quá!', 'Ảnh lưu vào Firestore (giới hạn 1MB/document) nên cần dưới 700KB.', 'warning'); return; }
        
        var reader = new FileReader();
        reader.onload = function(e) {
            db.collection('settings').doc('login_theme').set({
                backgroundImage: e.target.result,
                updatedBy: auth.currentUser ? auth.currentUser.email : 'Unknown',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                Swal.fire({ icon: 'success', title: 'Đã đổi nền!', text: 'Hình nền Login đã được cập nhật.', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            }).catch(err => {
                Swal.fire('Lỗi', err.message, 'error');
            });
        }
        reader.readAsDataURL(file);
    }
};

window.confirmResetTheme = function() {
    Swal.fire({
        title: 'Reset giao diện?', text: "Xóa ảnh nền và quay về mặc định?", icon: 'question',
        showCancelButton: true, confirmButtonColor: '#d33', cancelButtonText: 'Khoan...', confirmButtonText: 'Ok, xóa đi ní!'
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('settings').doc('login_theme').update({
                backgroundImage: firebase.firestore.FieldValue.delete()
            }).then(() => {
                Swal.fire({ icon: 'success', title: 'Đã Reset!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
            });
        }
    });
};
`;

const content = fs.readFileSync('script.js', 'utf8');
const lines = content.split('\n');
const startIndex = lines.findIndex(l => l.includes('// --- LOGIC HÌNH NỀN LOGIN ---'));
if (startIndex !== -1) {
    lines.splice(startIndex, lines.length - startIndex);
    fs.writeFileSync('script.js', lines.join('\n') + newLogic, 'utf8');
    console.log('Reverted script.js to Firebase successfully');
}
