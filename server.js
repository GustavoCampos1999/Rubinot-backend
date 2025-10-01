const express = require('express');
const cron = require('node-cron');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const os = require('os');
const path = require('path');
const { install, computeExecutablePath } = require('@puppeteer/browsers');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3001;

const isRender = process.env.RENDER === 'true';
const cacheDir = isRender 
    ? '/opt/render/.cache/puppeteer' 
    : path.join(__dirname, '.cache', 'puppeteer');
const buildId = '119.0.6045.105';
let executablePath; 

let boostedCache = { creature: null, boss: null, lastUpdated: null, error: null };

async function setupBrowser() {
    console.log('Verificando a instalação do navegador...');
    executablePath = computeExecutablePath({ browser: 'chrome', buildId, cacheDir });

    if (!fs.existsSync(executablePath)) {
        console.log(`Navegador não encontrado em ${executablePath}. Baixando...`);
        try {
            await install({ browser: 'chrome', buildId, cacheDir });
            console.log('Navegador baixado com sucesso!');
        } catch (error) {
            console.error('ERRO CRÍTICO ao baixar o navegador:', error);
            throw error; 
        }
    } else {
        console.log('Navegador já está instalado.');
    }
}

async function scrapeRubinot() {
    console.log('Iniciando busca no Rubinot...');
    if (!executablePath) {
        console.error("Busca cancelada: caminho do navegador não definido. A instalação pode ter falhado.");
        boostedCache.error = 'Configuração do navegador ausente no servidor.';
        return;
    }
    
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.goto('https://rubinot.com.br/', {
    waitUntil: 'networkidle2',
    timeout: 60000 
});

        const boostedInfo = await page.evaluate(() => {
            const creatureEl = document.querySelector('#Monster');
            const bossEl = document.querySelector('#Boss');
            return {
                creature: creatureEl?.title?.split(': ')[1]?.trim().toLowerCase() || null,
                boss: bossEl?.title?.split(': ')[1]?.trim().toLowerCase() || null
            };
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
        if (browser) await browser.close();
    }
}

async function initializeServer() {
    try {
        await setupBrowser(); 

        app.use((req, res, next) => res.header('Access-Control-Allow-Origin', '*') && next());
        app.get('/api/rubinot-boosted', (req, res) => res.json(boostedCache));
        
        cron.schedule('5 * * * *', () => { 
            console.log('Agendador ativado: buscando novos dados do Rubinot.');
            scrapeRubinot();
        });

        app.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
            scrapeRubinot(); 
        });

    } catch (error) {
        console.error("Falha ao inicializar o servidor. O navegador não pôde ser instalado.");
        process.exit(1);
    }
}

initializeServer(); 