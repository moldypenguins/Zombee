"use strict";
import { FileUploadAssertions } from "discord.js";
/**
 * @name Configuration.js
 * @version 2025-12-05
 * @summary The Old Republic
 **/

//import util from "util";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
dotenvExpand.expand(dotenv.config({ path: [".env", ".env.mods"] }));

const config = () => {
  const configuration = {
    discord: {
      token: process.env.DISCORD_TOKEN,
      client_id: process.env.DISCORD_CLIENTID,
      guild_id: process.env.DISCORD_GUILDID,
    },
    battleye: {
      address: process.env.BATTLEYE_ADDRESS || "127.0.0.1",
      port: Number(process.env.BATTLEYE_PORT || 2308),
      password: process.env.BATTLEYE_PASSWORD || "",
    },
    channels: {
      alerts: process.env.CHANNELS_ALERTS,
      logs: process.env.CHANNELS_LOGS,
      chat: process.env.CHANNELS_CHAT,
      status: process.env.CHANNELS_STATUS,
    },
    steam: {
      api_key: process.env.STEAM_APIKEY,
    },
    modpacks: {},
  };

  // update configuration for process.env.["MODPACK_*"]
  let keys = Object.keys(process.env).filter((k) => k.startsWith("MODPACK_"));
  if (keys?.length > 0) {
    for (const k of keys) {
      configuration.modpacks[k.replace("MODPACK_", "")] = process.env[k] ? process.env[k].split(",") : [];
      delete process.env[k];
    }
  }

  //console.log(`CONFIG: ${util.inspect(configuration, true, null, true)}`);

  if (!configuration.discord.token || configuration.discord.token.length != 72) {
    console.error("⚠️ Missing or Invalid Discord Token.");
    process.exit(1);
  }

  if (!configuration.battleye.address) {
    // || configuration.battleye.address.isUrl()) {
    console.error("⚠️ Missing or Invalid BattlEye Address.");
    process.exit(1);
  }

  if (configuration.battleye.host != "127.0.0.1" && configuration.battleye.password.length <= 0) {
    console.error("⚠️ Missing BattlEye Password.");
    process.exit(1);
  }

  return configuration;
};

export default config();
