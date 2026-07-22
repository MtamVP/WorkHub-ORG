const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.html')) {
            results.push(file);
        }
    });
    return results;
}

const htmlFiles = walk('.');
let injectedCount = 0;
htmlFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Check if api.js is included but supabase-js is not
    if (content.includes('api.js') && !content.includes('@supabase/supabase-js')) {
        // Inject before the first occurrence of api.js script tag
        content = content.replace(
            /(<script\s+src=["']\/?api\.js)/i, 
            '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n  $1'
        );
        fs.writeFileSync(file, content, 'utf8');
        console.log('Injected supabase-js into', file);
        injectedCount++;
    }
});
console.log('Done. Injected into ' + injectedCount + ' files.');
