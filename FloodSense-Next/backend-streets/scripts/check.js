const {execFileSync}=require('node:child_process');
const {readdirSync}=require('node:fs');
const {join}=require('node:path');
function check(folder){for(const file of readdirSync(folder,{withFileTypes:true})){const name=join(folder,file.name);if(file.isDirectory())check(name);else if(/\.(js|mjs)$/.test(name))execFileSync(process.execPath,['--check',name],{stdio:'inherit'});}}
check('src');check('netlify');console.log('Backend syntax checked');
