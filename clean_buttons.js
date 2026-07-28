const fs = require('fs');
const files = ['index.html', 'change_nickname/index.html', 'reset/index.html'];
files.forEach(f => {
    if (fs.existsSync(f)) {
        let text = fs.readFileSync(f, 'utf8');
        text = text.replace(/<div class="auth-theme-controls">[\s\S]*?<\/div>/, '');
        fs.writeFileSync(f, text, 'utf8');
        console.log('Removed from', f);
    }
});
