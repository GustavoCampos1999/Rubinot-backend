const express = require('express');
const cron = require('node-cron');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs'); 

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3001;

let boostedCache = {
    creature: null,
    boss: null,
    lastUpdated: null,
    error: null
};

let executablePath;
try {
    const config = JSON.parse(fs.readFileSync('puppeteer-config.json'));
    executablePath = config.executablePath;
} catch (error) {
    console.error('ERRO: Não foi possível ler o arquivo puppeteer-config.json.');
    console.error('Por favor, rode o comando "npm run setup" primeiro para baixar o navegador.');
}

async function scrapeRubinot() {
    console.log('Iniciando busca no Rubinot...');
    if (!executablePath) {
        console.error("Busca cancelada: caminho do navegador não encontrado.");
        boostedCache.error = 'Configuração do navegador ausente no servidor.';
        return;
    }
    
    let browser;
    try {
        console.log(`Tentando usar o navegador em: ${executablePath}`);

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', 
            ]
        });

        const page = await browser.newPage();
        await page.goto('https://rubinot.com.br/', { waitUntil: 'networkidle2' });

        const boostedInfo = await page.evaluate(() => {
            const creatureElement = document.querySelector('#Monster');
            const bossElement = document.querySelector('#Boss');
            let creatureName = null;
            let bossName = null;

            if (creatureElement && creatureElement.title) {
                creatureName = creatureElement.title.split(': ')[1]?.trim().toLowerCase() || null;
            }
            if (bossElement && bossElement.title) {
                bossName = bossElement.title.split(': ')[1]?.trim().toLowerCase() || null;
            }
            return { creature: creatureName, boss: bossName };
        });
        
        if (!boostedInfo.boss && !boostedInfo.creature) {
            throw new Error("Não foi possível extrair os nomes dos atributos 'title'.");
        }
        
        console.log('Busca concluída com sucesso:', boostedInfo);
        boostedCache = { ...boostedInfo, lastUpdated: new Date().toISOString(), error: null };

    } catch (error) {
        console.error('Erro durante a busca:', error);
        boostedCache.error = 'Falha ao buscar os dados do Rubinot.';
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});
app.get('/api/rubinot-boosted', (req, res) => {
    res.json(boostedCache);
});
cron.schedule('0 * * * *', () => {
    console.log('Agendador ativado: buscando novos dados do Rubinot.');
    scrapeRubinot();
});
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    scrapeRubinot();
});