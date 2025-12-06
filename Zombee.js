"use strict";
/**
 * Zombee
 * Copyright (c) 2023 The Old Republic - Craig Roberts
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/gpl-3.0.html
 *
 * @name Zombee.js
 * @version 2025-11-30
 * @summary The Old Republic
 **/

import 'dotenv/config'

if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN.length != 72) {
  //throw new Error();
  console.error('Invalid Discord Token.', `TOKEN: ${process.env.DISCORD_TOKEN}`);
  process.exit();
}

import RCON from "battleye-node";

import {
  ActivityType,
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Routes,
  REST,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ButtonBuilder,
  time,
  userMention,
  roleMention,
  channelMention,
} from "discord.js";

import BotCommands from "./BotCommands.js";
import BotEvents from "./BotEvents.js";

import minimist from "minimist";

let argv = minimist(process.argv.slice(2), {
  string: [],
  boolean: ["register"],
  alias: { r: "register" },
  default: { register: false },
  unknown: false,
});

//register bot commands
if (argv.register) {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  (async () => {
    try {
      const botCommands = [];
      for (let [key, value] of Object.entries(BotCommands)) {
        botCommands.push(value.data.toJSON());
      }
      const data = await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENTID), {
        body: botCommands,
      });
      console.log(`Reloaded ${data.length} discord commands.`);
    } catch (err) {
      console.error(err);
    }
    process.exit(0);
  })();
}


(async () => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMessageTyping,
      GatewayIntentBits.GuildEmojisAndStickers,
      GatewayIntentBits.MessageContent
    ],
  });

  let dsCommands = new Collection();
  for (let [name, command] of Object.entries(BotCommands)) {
    if (BotCommands[name]) {
      if ("data" in command && "execute" in command) {
        dsCommands.set(command.data.name, command);
      } else {
        console.log(
          `[WARNING] The command ${name} is missing a required "data" or "execute" property.`
        );
      }
    } else {
      console.log(`[WARNING] The command ${name} was not found.`);
    }
  }
  client.commands = dsCommands;

  //handle discord events
  for (const ev in BotEvents) {
    //console.error(`HERE: ${util.inspect(BotEvents[ev], true, null, true)}`);
    if (BotEvents[ev].once) {
      client.once(BotEvents[ev].name, (...args) => BotEvents[ev].execute(client, ...args));
    } else {
      client.on(BotEvents[ev].name, (...args) => BotEvents[ev].execute(client, ...args));
    }
  }

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
        await command.execute(client, interaction);
      } catch (err) {
        console.error(`[ERROR] ${err.code}: ${err.message}`);
        await client.channels.cache
          .get(_guild.guild_logs)
          .send(`There was an error while executing this command!\n${err.code}: ${err.message}`);
      }
    }
  });

  client.on(Events.ClientReady, async () => {
    console.log(`Discord: Logged in as ${client.user.username}!`);
    client.user.setPresence({
        activities: [{name: "Buzz, Buzz, Mother Fucker!", type: ActivityType.Custom }],
        status: 'dnd'
    });
    const channels = {
      ALERTS: await client.channels.fetch('1402341626113818725').catch(() => null),
      LOGS: await client.channels.fetch('1109253326467510402').catch(() => null),
      CHAT: await client.channels.fetch('1389961695685902578').catch(() => null),
      STATUS: await client.channels.fetch('1444958236481425478').catch(() => null),
    }
    const BE = new BattleEye(client, channels, {
      address: "89.34.97.20",
      port: 2308,
      password: "t33nG0han",
      connectionType: "udp4",
      connectionTimeout: 50000,
      connectionInterval: 10000,
      keepAliveInterval: 30000
    });
    BE.start();
  });

  // *******************************************************************************************************************
  // Run bot
  // *******************************************************************************************************************
  console.log("Starting...");
  await client.login(process.env.DISCORD_TOKEN);
})();

process.on("SIGINT", function () {
  console.log("\nGracefully shutting down from SIGINT (Ctrl-C)");
  process.exit(0);
});


class BattleEye {
  constructor(client, chans, params) {
    this.RCON = new RCON(params);

    this.RCON.on("onConnect", (c) => {
      console.log("BattleEye Connected: ", c);
      client.user.setPresence({ status: 'online' });
    });
    this.RCON.on("disconnect", () => {
      console.log("BattleEye Disconnected.");
      client.user.setPresence({ status: 'dnd' });
    });
    this.RCON.on("error", (e) => { console.warn("BattleEye Error: ", e?.message || e); });

    this.RCON.on("message", async (msg) => {
      console.log(msg); // log all messages to console
      
      // detect player count message and update Discord voice channel with current in game players count
      if (msg.includes("[IP Address]:[Port] [Ping] [GUID] [Name]")) {
        const m = String(msg).match(/\((\d+)\s+players?\s+in\s+total\)/i);
        const total = (m && m[1]) ? Number(m[1]) : null;
        if (total != null) {
          try {
            if (chans.STATUS && (chans.STATUS.type === ChannelType.GuildVoice || chans.STATUS.type === ChannelType.GuildStageVoice)) {
              const newName = `🪖 Survivors Online: ${n}`;
              if (chans.STATUS.name !== newName) { await chans.STATUS.setName(newName); }
            }
          } catch (e) {
            console.warn("Survivors Online Error:", e?.message || e); // catch any errors
          }
        }
      }

      // detect RCon and GUID messages and send them to server events Discord channel
      if (msg.includes("RCon") || msg.includes("GUID")) {
          if (!msg.includes("Welcome")) {
              const rulesEmbed = new EmbedBuilder()
                  .setColor("#ff9900")
                  .setTitle("💻 Server Event")
                  .setDescription(`${msg}`)
              await chans.LOGS.send({ embeds: [rulesEmbed] });
          }
          return this;
      }

      // detect player connected/disconnected messages and send them to log Discord channel
      if (msg.includes("Player #")) {
          // ignore player Welcome message to console
          if (msg.includes("Welcome")) return;

          // display disconnected player to Discord channel
          if (msg.includes(" disconnected")) {
              //  be.commandSend?.("players"); // can uncomment this line if you want to query current player count to update on disconnect too
              const rulesEmbed = new EmbedBuilder()
                  .setColor("#ff0000")
                  .setTitle("🔌 Disconnected Player")
                  .setDescription(`\`\`\`diff\n- ${msg}\n\`\`\``)
              await chans.ALERTS.send({ embeds: [rulesEmbed] });
          }

          // display connected player to Discord channel + query current player count
          else if (msg.includes(" connected")) {
              this.RCON.commandSend?.("players"); // triggers player count command
              const rulesEmbed = new EmbedBuilder()
                  .setColor("#2bff00")
                  .setTitle("🪖 Player Connected")
                  .setDescription(`\`\`\`diff\n+ ${msg}\n\`\`\``)
              await chans.ALERTS.send({ embeds: [rulesEmbed] });
          }
          return this;
      }

    });
    return this;
  }

  start() {
    try {
      this.RCON.login(); // attempt RCon login
    } catch (e) {
      console.warn("Login Error: ", e?.message || e); // catch any login errors
    }
    return this;
  }

}
