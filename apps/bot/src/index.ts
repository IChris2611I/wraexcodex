/**
 * The Herald — Wraex Codex Discord Bot
 *
 * Runtime: Bun (not Node.js)
 * WHY Bun for the bot: Bun's startup time is ~3x faster than Node.js.
 * Discord bots restart on deploy. Faster restart = less downtime in production.
 * Bun's native TypeScript support means zero transpilation step.
 *
 * Architecture: discord.js handles the WebSocket connection to Discord's gateway.
 * Commands are defined in separate files and registered via Discord's slash command API.
 *
 * Deployment: Railway (always-on process, unlike serverless functions)
 * WHY Railway: Discord bots need a persistent WebSocket connection.
 * Serverless functions sleep between invocations — incompatible with WebSockets.
 */

import { Client, GatewayIntentBits, Collection } from "discord.js"
import type { Command } from "./types"
import { itemCommand } from "./commands/item"
import { buildCommand } from "./commands/build"
import { priceCommand } from "./commands/price"
import { metaCommand } from "./commands/meta"

const token = process.env.DISCORD_BOT_TOKEN
if (!token) {
  throw new Error("DISCORD_BOT_TOKEN environment variable is required")
}

// Create the Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,         // Basic guild info — required for slash commands
    GatewayIntentBits.GuildMessages,  // Message events in guild channels
  ],
})

// Command registry — Collection is Discord.js's Map with extra utilities
const commands = new Collection<string, Command>()
commands.set(itemCommand.data.name, itemCommand)
commands.set(buildCommand.data.name, buildCommand)
commands.set(priceCommand.data.name, priceCommand)
commands.set(metaCommand.data.name, metaCommand)

// Bot ready event
client.once("ready", (c) => {
  console.log(`[Herald] Logged in as ${c.user.tag}`)
  console.log(`[Herald] Serving ${c.guilds.cache.size} guilds`)
})

// Slash command handler
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  const command = commands.get(interaction.commandName)
  if (!command) {
    console.warn(`[Herald] Unknown command: ${interaction.commandName}`)
    return
  }

  try {
    await command.execute(interaction)
  } catch (error) {
    console.error(`[Herald] Error in command ${interaction.commandName}:`, error)

    const errorMessage = {
      content: "An error occurred while executing this command. The forge spirits are displeased.",
      ephemeral: true,
    }

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage)
    } else {
      await interaction.reply(errorMessage)
    }
  }
})

// Connect to Discord
await client.login(token)
