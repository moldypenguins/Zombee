"use strict";
/**
 * @name Zombee.js
 * @version 2025-12-05
 * @summary The Old Republic
 **/

import {
  ActivityType,
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Routes,
  REST,
  EmbedBuilder,
  ChannelType,
  PresenceUpdateStatus,
  ActionRowBuilder,
  ButtonStyle,
  ButtonBuilder,
  time,
  userMention,
  roleMention,
  channelMention,
} from "discord.js";

import minimist from "minimist";
import RCON from "battleye-node";

import config from "./configuration.js";
import commands from "./commands.js";

const battleye = new RCON({
  address: config.battleye.address,
  port: config.battleye.port,
  password: config.battleye.password,
  connectionType: "udp4",
  connectionTimeout: 50000,
  connectionInterval: 10000,
  keepAliveInterval: 30000,
});

let argv = minimist(process.argv.slice(2), {
  string: [],
  boolean: ["register"],
  alias: { r: "register" },
  default: { register: false },
  unknown: false,
});

//register bot commands
if (argv.register) {
  const rest = new REST().setToken(config.discord.token);
  (async () => {
    try {
      const botCommands = [];
      for (let [key, value] of Object.entries(commands)) {
        botCommands.push(value.data.toJSON());
      }
      const data = await rest.put(Routes.applicationCommands(config.discord.client_id), {
        body: botCommands,
      });
      console.log(`Reloaded ${data.length} discord commands.`);
    } catch (err) {
      console.error(err);
    }
    process.exit(0);
  })();
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildExpressions,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessagePolls,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
  ],
  presence: {
    activities: [{ name: "Buzz, Buzz, Mother Fucker!", type: ActivityType.Custom }],
    status: PresenceUpdateStatus.Idle,
  },
});

let dsCommands = new Collection();
for (let [name, command] of Object.entries(commands)) {
  if (commands[name]) {
    if ("data" in command && "execute" in command) {
      dsCommands.set(command.data.name, command);
    } else {
      console.log(`[WARNING] The command ${name} is missing a required "data" or "execute" property.`);
    }
  } else {
    console.log(`[WARNING] The command ${name} was not found.`);
  }
}
client.commands = dsCommands;

client.on(Events.InteractionCreate, async (interaction) => {
  if (
    !interaction.isChatInputCommand() &&
    !interaction.isButton() &&
    !interaction.isStringSelectMenu() &&
    !interaction.isChannelSelectMenu() &&
    !interaction.isRoleSelectMenu() &&
    !interaction.isModalSubmit() &&
    !interaction.isAutocomplete()
  ) {
    return;
  }

  const command =
    interaction.isChatInputCommand() || interaction.isAutocomplete()
      ? interaction.client.commands.get(interaction.commandName)
      : interaction.client.commands.get(interaction.customId.split("_")[0]);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
  } else {
    try {
      await command.execute(client, battleye, interaction);
    } catch (err) {
      console.error(`[ERROR] ${err.code}: ${err.message}`);
      await client.channels.cache
        .get(config.channels.logs)
        ?.send(`There was an error while executing this command!\n${err.code}: ${err.message}`);
    }
  }
});

client.on(Events.ClientReady, async () => {
  console.log(`Discord: Logged in as ${client.user.username}!`);

  const _guild = await client.guilds.fetch(config.discord.guild_id).catch(() => null);
  const _channels = {
    alerts: await client.channels.fetch(config.channels.alerts).catch(() => null),
    logs: await client.channels.fetch(config.channels.logs).catch(() => null),
    chat: await client.channels.fetch(config.channels.chat).catch(() => null),
    status: await client.channels.fetch(config.channels.status).catch(() => null),
  };

  // Set connected presence
  battleye.on("onConnect", (isConnected) => {
    console.log("BattleEye Connected: ", isConnected);
    client.user.setStatus(isConnected ? PresenceUpdateStatus.Online : PresenceUpdateStatus.DoNotDisturb);
  });

  // Log error
  battleye.on("error", async (e) => {
    console.warn("BattleEye Error: ", e?.message || e);
    client.user.setStatus(PresenceUpdateStatus.DoNotDisturb);
    if (_channels.logs) {
      const rulesEmbed = new EmbedBuilder()
        .setColor("#FF9900")
        .setAuthor({ name: "Error", iconURL: "https://i.imgur.com/wZ1xLrf.png" })
        .setDescription(`${e?.message || e}`);
      await _channels.logs.send({ embeds: [rulesEmbed] });
    }
  });

  battleye.on("message", async (msg) => {
    console.log(msg); // log all messages to console

    // detect player count message and update Discord voice channel with current in game players count
    if (
      msg.includes("[#] [IP Address]:[Port] [Ping] [GUID] [Name]") &&
      _channels.status &&
      (_channels.status.type === ChannelType.GuildVoice || _channels.status.type === ChannelType.GuildStageVoice)
    ) {
      const m = String(msg).match(/\((\d+)\s+players?\s+in\s+total\)/i);
      const total = m && m[1] ? Number(m[1]) : null;
      if (total != null) {
        try {
          const newName = `🛜 Survivors Online: ${total}`;
          if (_channels.status.name !== newName) {
            await _channels.status.setName(newName);
          }
        } catch (e) {
          console.warn("Survivors Online Error:", e?.message || e); // catch any errors
        }
      }
    }

    // detect player connected/disconnected messages and send them to log Discord channel
    if (msg.includes("Player #") && _channels.alerts) {
      // ignore player Welcome message to console
      if (msg.includes("Welcome")) return;

      // display disconnected player to Discord channel
      if (msg.includes(" disconnected")) {
        battleye.commandSend("players"); // triggers player count command
        const rulesEmbed = new EmbedBuilder()
          .setColor("#CC0000")
          .setAuthor({ name: "Player Disconnected", iconURL: "https://i.imgur.com/VttZve9.png" })
          .setDescription(`\`\`\`diff\n- ${msg}\n\`\`\``);
        await _channels.alerts.send({ embeds: [rulesEmbed] });
      }

      // display connected player to Discord channel + query current player count
      else if (msg.includes(" connected")) {
        battleye.commandSend("players"); // triggers player count command
        const rulesEmbed = new EmbedBuilder()
          .setColor("#009900")
          .setAuthor({ name: "Player Connected", iconURL: "https://i.imgur.com/E4ukBbS.png" })
          .setDescription(`\`\`\`diff\n+ ${msg}\n\`\`\``);
        await _channels.alerts.send({ embeds: [rulesEmbed] });
      }
    }

    // detect in-game chat messages and send them to global Discord channel
    if (msg.includes("(Global)") && _channels.chat) {
      // parse chat message
      const chat = null;
      let s = (line || "").replace(/^.*BattlEye Server:\s*/i, "").trim();
      if (
        /^Player\s+#\d+\s+/i.test(s) ||
        /^\d{2}:\d{2}:\d{2}\s+Player\s+/i.test(s) ||
        /-+\s*BE GUID:/i.test(s) ||
        /^RCon admin\s+#\d+/i.test(s) ||
        /\b(?:connecting|connected|disconnected)\b\.?$/i.test(s)
      )
        return null;
      const arrowRe = /^(?:ᐅ|▶|▷|>)+\s*/;
      const build = (name, text) => {
        name = (name || "").trim();
        text = (text || "").trim();
        const isGlobal = arrowRe.test(text);
        // understaind the diffrence between Global and Direct message by the arrow at the start of the message (▶)
        if (isGlobal) text = text.replace(arrowRe, "");
        chat = { type: isGlobal ? "Global" : "Direct", name, text };
      };
      let m = s.match(/\(Global\)\s*([^:]+):\s*(.+)$/i);
      if (m) {
        chat = build(m[1], m[2]);
      }
      m = s.match(/^\s*([^:]+):\s*(.+)$/);
      if (m) {
        chat = build(m[1], m[2]);
      }

      if (chat) {
        // if the type really is Global, use diff + else use fix - (for Direct messages)
        await _channels.chat.send(
          `\`\`\`` +
            (chat.type === "Global" ? `diff\n+ ` : `fix\n`) +
            `(${chat.type}) ${chat.name}: ${chat.text}\n\`\`\``
        );
      }
    }

    // detect RCon and GUID messages and send them to server events Discord channel
    // if ((msg.includes("RCon") || msg.includes("GUID")) && !msg.includes("Welcome") && _channels.logs) {
    //   const rulesEmbed = new EmbedBuilder().setColor("#ff9900").setTitle("💻 Server Event").setDescription(`${msg}`);
    //   await _channels.logs.send({ embeds: [rulesEmbed] });
    // }
    if (_channels.logs) {
      const rulesEmbed = new EmbedBuilder()
        .setColor("#0099FF")
        .setAuthor({ name: "Server Event", iconURL: "https://i.imgur.com/EoLa7sV.png" })
        .setDescription(`${msg}`);
      await _channels.logs.send({ embeds: [rulesEmbed] });
    }
  }); // end battleye.on("message", ...);

  try {
    battleye.login(); // attempt RCon login
  } catch (e) {
    console.warn("Login Error: ", e?.message || e); // catch any login errors
  }
});

client.on(Events.Error, async (e) => {
  if (_channels.logs) {
    const rulesEmbed = new EmbedBuilder()
      .setColor("#FF9900")
      .setAuthor({ name: "Error", iconURL: "https://i.imgur.com/wZ1xLrf.png" })
      .setDescription(`${e?.message || e}`);
    await _channels.logs.send({ embeds: [rulesEmbed] });
  }
});

// *******************************************************************************************************************
// Run bot
// *******************************************************************************************************************
console.log("Starting...");
client.login(config.discord.token);

process.on("SIGINT", function () {
  console.log("\nGracefully shutting down from SIGINT (Ctrl-C)");
  try {
    battleye.logout(); // attempt RCon logout
  } catch (e) {
    console.warn("Logout Error: ", e?.message || e); // catch any logout errors
  }
  process.exit(0);
});
