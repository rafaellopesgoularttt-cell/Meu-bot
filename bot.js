// ================= CONFIGURAÇÕES =================
const PREFIX = ".";
const CARGO_ADM = "Administrador"; // nome EXATO do cargo
const CATEGORIA_SALAS = "🎮 SALAS AP";
// ===============================================

const { Client, GatewayIntentBits, PermissionsBitField, ChannelType } = require("discord.js");
const express = require("express");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== BANCO DE DADOS SIMPLES =====
let filas = {};
let stats = {};
if (fs.existsSync("stats.json")) {
  stats = JSON.parse(fs.readFileSync("stats.json"));
}

// ===== BOT ONLINE =====
client.once("ready", () => {
  console.log("Bot ligado com sucesso!");
});

// ===== COMANDOS =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // ===== ENTRAR NA FILA =====
  if (cmd === "fila") {
    const modo = args[0]; // 1x1, 2x2, 3x3
    const tipo = args[1]; // normal / misto

    if (!modo || !tipo) {
      return message.reply("❌ Use: .fila 1x1 normal | .fila 2x2 misto");
    }

    const tamanho = modo === "1x1" ? 2 : modo === "2x2" ? 4 : modo === "3x3" ? 6 : null;
    if (!tamanho) return message.reply("Modo inválido.");

    const chave = `${modo}-${tipo}`;
    if (!filas[chave]) filas[chave] = [];

    if (filas[chave].includes(message.author.id)) {
      return message.reply("Você já está nessa fila.");
    }

    filas[chave].push(message.author.id);
    message.reply(`✅ Entrou na fila **${modo} ${tipo}** (${filas[chave].length}/${tamanho})`);

    if (filas[chave].length === tamanho) {
      await criarSala(message.guild, chave, filas[chave], modo, tipo);
      filas[chave] = [];
    }
  }

  // ===== PERFIL =====
  if (cmd === "perfil") {
    const user = message.mentions.users.first() || message.author;
    const s = stats[user.id] || { win: 0, lose: 0, tie: 0 };
    message.reply(
      `🏆 **Perfil de ${user.username}**\n` +
      `Vitórias: ${s.win}\nDerrotas: ${s.lose}\nEmpates: ${s.tie}`
    );
  }

  // ===== PLACAR =====
  if (cmd === "p") {
    const adversario = message.mentions.users.first();
    if (!adversario) return message.reply("Marque o adversário.");
    message.reply(`📊 Placar iniciado entre ${message.author} vs ${adversario}\nADM use .win / .lose / .tie`);
  }

  // ===== RESULTADOS (ADM) =====
  if (["win", "lose", "tie"].includes(cmd)) {
    if (!message.member.roles.cache.some(r => r.name === CARGO_ADM)) {
      return message.reply("❌ Só ADM pode usar.");
    }

    const user = message.mentions.users.first();
    if (!user && cmd !== "tie") return;

    if (cmd !== "tie") {
      if (!stats[user.id]) stats[user.id] = { win: 0, lose: 0, tie: 0 };
    }

    if (cmd === "win") stats[user.id].win++;
    if (cmd === "lose") stats[user.id].lose++;
    if (cmd === "tie") {
      message.reply("🤝 Empate registrado.");
      return;
    }

    fs.writeFileSync("stats.json", JSON.stringify(stats, null, 2));
    message.reply("✅ Resultado registrado.");
  }
});

// ===== CRIAR SALA =====
async function criarSala(guild, chave, jogadores, modo, tipo) {
  const categoria = guild.channels.cache.find(
    c => c.name === CATEGORIA_SALAS && c.type === ChannelType.GuildCategory
  );

  const channel = await guild.channels.create({
    name: `🎮-${modo}-${tipo}`,
    type: ChannelType.GuildText,
    parent: categoria?.id,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      ...jogadores.map(id => ({
        id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      }))
    ]
  });

  channel.send(
    `🎮 **Sala criada**\n` +
    `Jogadores: ${jogadores.map(id => `<@${id}>`).join(" vs ")}\n` +
    `ADM: @${CARGO_ADM}\n` +
    `Use .p @adversario`
  );
}

// ===== LOGIN =====
client.login(process.env.TOKEN);

// ===== SERVIDOR WEB (UPTIMEROBOT) =====
const app = express();
app.get("/", (req, res) => res.send("Bot online"));
app.listen(3000, () => console.log("Servidor web ligado"));
