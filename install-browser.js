const { install } = require('@puppeteer/browsers');
const fs = require('fs');
const path = require('path');

async function downloadBrowser() {
  console.log('Iniciando o download do navegador (pode levar alguns minutos)...');
  try {
    const revision = '119.0.6045.105'; 
    
    const installInfo = await install({
      browser: 'chrome',
      buildId: revision,
      cacheDir: process.env.RENDER === 'true' 
        ? '/opt/render/.cache/puppeteer' 
        : path.join(__dirname, '.cache', 'puppeteer'), 
    });

    console.log(`Navegador baixado com sucesso em: ${installInfo.executablePath}`);

    const config = { executablePath: installInfo.executablePath };
    fs.writeFileSync('puppeteer-config.json', JSON.stringify(config, null, 2));
    
    console.log('Arquivo de configuração puppeteer-config.json criado.');

  } catch (error) {
    console.error('ERRO ao baixar o navegador:', error);
    process.exit(1);
  }
}

downloadBrowser();