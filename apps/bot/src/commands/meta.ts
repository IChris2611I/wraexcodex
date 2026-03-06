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
        `[View full tier list](https://wraexcodex.com/meta) on Wraex Codex`
      )
      .setColor(0xe67e22)
      .setFooter({ text: "Wraex Codex — wraexcodex.com" })

    await interaction.editReply({ embeds: [embed] })
  },
}
