const fs = require('fs');
const path = require('path');
const version = '?v=' + Date.now();

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
htmlFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;
    
    // Replace script.js?v=xxx
    const scriptRegex = /script\.js\?v=[0-9.]+/g;
    if (scriptRegex.test(content)) {
        content = content.replace(scriptRegex, 'script.js' + version);
        changed = true;
    } else if (content.includes('src="/script.js"')) {
        content = content.replace(/src="\/script\.js"/g, 'src="/script.js' + version + '"');
        changed = true;
    }

    // Replace api.js?v=xxx
    const apiRegex = /api\.js\?v=[0-9.]+/g;
    if (apiRegex.test(content)) {
        content = content.replace(apiRegex, 'api.js' + version);
        changed = true;
    } else if (content.includes('src="/api.js"')) {
        content = content.replace(/src="\/api\.js"/g, 'src="/api.js' + version + '"');
        changed = true;
    } else if (content.includes('src="api.js"')) {
        content = content.replace(/src="api\.js"/g, 'src="api.js' + version + '"');
        changed = true;
    }

    // Replace rag_chatbot.js?v=xxx
    const ragRegex = /rag_chatbot\.js(?:\?v=[0-9.]+)?/g;
    if (ragRegex.test(content)) {
        content = content.replace(ragRegex, 'rag_chatbot.js' + version);
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated version in', file);
    }
});
