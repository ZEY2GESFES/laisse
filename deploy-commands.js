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

  new SlashCommandBuilder()
    .setName('image')
    .setDescription('Gère les salons "image only"')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Active le mode image only sur un salon')
        .addChannelOption(opt =>
          opt.setName('salon')
            .setDescription('Salon texte à passer en image only')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('del')
        .setDescription('Désactive le mode image only sur un salon')
        .addChannelOption(opt =>
          opt.setName('salon')
            .setDescription('Salon texte à désactiver')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('troll')
    .setDescription('Fait rebondir un utilisateur entre deux salons vocaux pendant une durée donnée')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Utilisateur à trolls')
        .setRequired(true))
    .addChannelOption(opt =>
      opt.setName('vocal1')
        .setDescription('Premier salon vocal')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(true))
    .addChannelOption(opt =>
      opt.setName('vocal2')
        .setDescription('Deuxième salon vocal')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('duree')
        .setDescription('Durée en secondes')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(600))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('untroll')
    .setDescription("Arrête le troll en cours sur un utilisateur")
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Utilisateur à arrêter')
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
