import { SlashCommandBuilder, EmbedBuilder } from "discord.js"
import type { Command } from "../types"

export const metaCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("meta")
    .setDescription("Current S-tier builds this league"),

  async execute(interaction) {
    await interaction.deferReply()

    const embed = new EmbedBuilder()
      .setTitle("Current Meta — S Tier Builds")
      .setDescription(
        `Live meta tracker coming soon.\n\n` +
        `[View full tier list](https://lootreference.com/meta) on LootReference`
      )
      .setColor(0xe67e22)
      .setFooter({ text: "LootReference — lootreference.com" })

    await interaction.editReply({ embeds: [embed] })
  },
}
