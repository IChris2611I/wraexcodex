import { SlashCommandBuilder, EmbedBuilder } from "discord.js"
import type { Command } from "../types"

export const priceCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("price")
    .setDescription("Check the current trade value of an item")
    .addStringOption((opt) =>
      opt.setName("item").setDescription("Item name").setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply()
    const itemName = interaction.options.getString("item", true)

    const embed = new EmbedBuilder()
      .setTitle(`Price: ${itemName}`)
      .setDescription(
        `Live price integration (poe.ninja) coming soon.\n\n` +
        `[Check price](https://lootreference.com/economy?q=${encodeURIComponent(itemName)}) on LootReference`
      )
      .setColor(0xe67e22)
      .setFooter({ text: "LootReference — lootreference.com" })

    await interaction.editReply({ embeds: [embed] })
  },
}
