require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('laisse')
    .setDescription('Met un utilisateur en laisse dans un salon vocal')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Utilisateur à mettre en laisse')
        .setRequired(true))
    .addChannelOption(opt =>
      opt.setName('vocal')
        .setDescription('Salon vocal de la laisse')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('unlaisse')
    .setDescription("Retire la laisse d'un utilisateur")
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Utilisateur à libérer')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Déploiement des commandes...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Commandes déployées avec succès.');
  } catch (err) {
    console.error(err);
  }
})();
