import { SlashCommandBuilder, EmbedBuilder } from "discord.js"
import type { Command } from "../types"

/**
 * /item [name] — instant item tooltip embed
 *
 * Returns a Discord embed styled to match the in-game item tooltip.
 * This is our highest-usage command — players use it constantly in build channels.
 */
export const itemCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("item")
    .setDescription("Look up a Path of Exile 2 item")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Item name to look up")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async execute(interaction) {
    await interaction.deferReply()

    const itemName = interaction.options.getString("name", true)

    // TODO Week 1: Wire to DB via @wraexcodex/db
    // For now, return a placeholder embed showing the structure
    const embed = new EmbedBuilder()
      .setTitle(itemName)
      .setDescription(
        "Item data coming soon — database integration in Week 1.\n\n" +
        `Search [${itemName}](https://wraexcodex.com/items?q=${encodeURIComponent(itemName)}) on Wraex Codex`
      )
      .setColor(0xe67e22) // ember orange
      .setFooter({ text: "Wraex Codex — wraexcodex.com" })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  },
}
