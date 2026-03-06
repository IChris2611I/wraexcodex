import { SlashCommandBuilder, EmbedBuilder } from "discord.js"
import type { Command } from "../types"

export const buildCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("build")
    .setDescription("Find top builds for a class and budget")
    .addStringOption((opt) =>
      opt.setName("class").setDescription("Character class").setRequired(true).addChoices(
        { name: "Warrior", value: "warrior" },
        { name: "Ranger", value: "ranger" },
        { name: "Witch", value: "witch" },
        { name: "Sorceress", value: "sorceress" },
        { name: "Mercenary", value: "mercenary" },
        { name: "Monk", value: "monk" }
      )
    )
    .addIntegerOption((opt) =>
      opt.setName("budget").setDescription("Budget in divine orbs").setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply()
    const cls = interaction.options.getString("class", true)
    const budget = interaction.options.getInteger("budget")

    const embed = new EmbedBuilder()
      .setTitle(`Top ${cls.charAt(0).toUpperCase() + cls.slice(1)} Builds`)
      .setDescription(
        `Build database integration coming soon.\n\n` +
        `[Browse ${cls} builds](https://lootreference.com/builds?class=${cls}${budget ? `&budget=${budget}` : ""}) on LootReference`
      )
      .setColor(0xe67e22)
      .setFooter({ text: "LootReference — lootreference.com" })

    await interaction.editReply({ embeds: [embed] })
  },
}
