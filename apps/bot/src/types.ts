import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js"

/**
 * WHY the union type for `data`:
 * discord.js uses a builder pattern that narrows the type as you chain options.
 * Once you call .addStringOption() the type becomes SlashCommandOptionsOnlyBuilder
 * (no more subcommands allowed — enforced by the type system).
 * Our Command interface must accept any valid final state of the builder.
 */
export type Command = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>
}
