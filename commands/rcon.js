/**
 * @name admin.js
 * @version 2025/12/06
 * @summary Admin commands
 **/

import {
  ActionRowBuilder,
  PermissionFlagsBits,
  ButtonStyle,
  ChannelType,
  time,
  EmbedBuilder,
  ChannelSelectMenuBuilder,
  PresenceUpdateStatus,
  RoleSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  roleMention,
  channelMention,
  userMention,
  ButtonBuilder,
  InteractionResponse,
  Integration,
} from "discord.js";

import { encode } from "html-entities";
import numeral from "numeral";
import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat.js";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

import config from "../configuration.js";

export default {
  data: new SlashCommandBuilder()
    .setName("rcon")
    .setDescription("RCON Commands")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) => subcommand.setName("login").setDescription("Login."))
    .addSubcommand((subcommand) => subcommand.setName("logout").setDescription("Logout."))
    .addSubcommand((subcommand) => subcommand.setName("shutdown").setDescription("Shuts down the server immediately."))
    .addSubcommand((subcommand) => subcommand.setName("players").setDescription("Shows list of users on the server.")),

  async execute(client, battleye, interaction) {
    if (interaction.isChatInputCommand()) {
      switch (interaction.options._subcommand) {
        case "login":
          try {
            battleye.login(); // attempt RCon login
            client.user.setStatus(PresenceUpdateStatus.Online);
            await interaction.deferReply();
            await interaction.deleteReply();
          } catch (e) {
            const m = `Login Error: ${e?.message || e}`;
            console.warn(m);
            await interaction.reply({ content: m, flags: MessageFlags.Ephemeral });
          }
          break;
        case "logout":
          try {
            battleye.logout(); // attempt RCon logout
            client.user.setStatus(PresenceUpdateStatus.Idle);
            await interaction.deferReply();
            await interaction.deleteReply();
            const logs = await client.channels.fetch(config.channels.logs).catch(() => null);
            if (logs) {
              const rulesEmbed = new EmbedBuilder()
                .setColor("#0099FF")
                .setAuthor({ name: "Server Event", iconURL: "https://i.imgur.com/EoLa7sV.png" })
                .setDescription("RCon admin logged out");
              await logs.send({ embeds: [rulesEmbed] });
            }
            console.log("BattleEye Connected: ", false);
          } catch (e) {
            const m = `Logout Error: ${e?.message || e}`;
            console.warn(m);
            await interaction.reply({ content: m, flags: MessageFlags.Ephemeral });
          }
          break;
        case "shutdown":
          battleye.commandSend(`#${interaction.options._subcommand}`);
          await interaction.deferReply();
          await interaction.deleteReply();
          break;
        case "players":
          battleye.commandSend(`${interaction.options._subcommand}`);
          await interaction.deferReply();
          await interaction.deleteReply();
          break;
        default:
          const m = `Unknown subcommand '${interaction.options._subcommand}'`;
          console.warn(m);
          await interaction.reply({ content: m, flags: MessageFlags.Ephemeral });
          break;
      }
    }
  },
};
