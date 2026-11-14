const fs = require('fs');
const path = require('path');

try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf8');
        envFile.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
            }
        });
    }
} catch (error) {
    console.log('No local .env file found, using system environment variables.');
}

const config = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    PRODUCTION_URL: process.env.PRODUCTION_URL || '',
    OLD_DOMAIN_1: process.env.OLD_DOMAIN_1 || '',
    OLD_DOMAIN_2: process.env.OLD_DOMAIN_2 || '',
    OFFICIAL_PORTAL_URL: process.env.OFFICIAL_PORTAL_URL || 'https://ajeer.com.sa',
    isSupabaseEnabled: true,
    isMongoEnabled: false
};

if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    console.warn('WARNING: SUPABASE_URL or SUPABASE_ANON_KEY is missing from environment!');
}

const jsContent = `window.CONFIG = ${JSON.stringify(config, null, 4)};\n`;
const targetDir = path.join(__dirname, 'shared', 'js');
if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(path.join(targetDir, 'config.js'), jsContent);
console.log('shared/js/config.js generated.');

try {
    const templatePath = path.join(__dirname, 'vercel.json.template');
    if (fs.existsSync(templatePath)) {
        let template = fs.readFileSync(templatePath, 'utf8');
        Object.keys(config).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            template = template.replace(regex, config[key]);
        });
        fs.writeFileSync(path.join(__dirname, 'vercel.json'), template);
        console.log('vercel.json updated from template.');
    }
} catch (error) {
    console.error('Error generating vercel.json:', error);
}
