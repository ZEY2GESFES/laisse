require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// userId -> channelId du salon "laisse"
const leashed = new Map();

// Set des salons en mode "image only"
const imageOnlyChannels = new Set();

client.once('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Double vérification (en plus des permissions par défaut de la commande)
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ Réservé aux administrateurs.', ephemeral: true });
  }

  if (interaction.commandName === 'laisse') {
    const user = interaction.options.getUser('user');
    const vocal = interaction.options.getChannel('vocal');

    if (vocal.type !== ChannelType.GuildVoice) {
      return interaction.reply({ content: '❌ Le salon choisi doit être un salon vocal.', ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: "❌ Membre introuvable sur ce serveur.", ephemeral: true });
    }

    leashed.set(user.id, vocal.id);

    // Si déjà en vocal, on le déplace tout de suite
    if (member.voice.channelId) {
      await member.voice.setChannel(vocal).catch(() => {});
    }

    return interaction.reply(`🔒 ${user} est maintenant en laisse dans ${vocal}. Toute tentative de rejoindre un autre salon le ramènera ici.`);
  }

  if (interaction.commandName === 'unlaisse') {
    const user = interaction.options.getUser('user');

    if (!leashed.has(user.id)) {
      return interaction.reply({ content: `${user} n'est pas en laisse.`, ephemeral: true });
    }

    leashed.delete(user.id);
    return interaction.reply(`🔓 ${user} n'est plus en laisse.`);
  }

  if (interaction.commandName === 'image') {
    const sub = interaction.options.getSubcommand();
    const salon = interaction.options.getChannel('salon');

    if (salon.type !== ChannelType.GuildText) {
      return interaction.reply({ content: '❌ Le salon choisi doit être un salon texte.', ephemeral: true });
    }

    if (sub === 'add') {
      imageOnlyChannels.add(salon.id);
      return interaction.reply(`🖼️ ${salon} est maintenant en mode image only. Tout message sans image sera supprimé automatiquement.`);
    }

    if (sub === 'del') {
      if (!imageOnlyChannels.has(salon.id)) {
        return interaction.reply({ content: `${salon} n'est pas en mode image only.`, ephemeral: true });
      }
      imageOnlyChannels.delete(salon.id);
      return interaction.reply(`✅ ${salon} n'est plus en mode image only.`);
    }
  }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  const userId = newState.id;
  if (!leashed.has(userId)) return;

  const leashChannelId = leashed.get(userId);

  // L'utilisateur a rejoint un salon différent de celui de sa laisse -> on le ramène
  if (newState.channelId && newState.channelId !== leashChannelId) {
    try {
      await newState.member.voice.setChannel(leashChannelId);
    } catch (err) {
      console.error(`Impossible de ramener ${newState.member.user.tag} :`, err.message);
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!imageOnlyChannels.has(message.channel.id)) return;

  // On autorise le message s'il contient au moins une pièce jointe de type image
  const hasImage = message.attachments.some(att =>
    att.contentType && att.contentType.startsWith('image/')
  );

  if (!hasImage) {
    try {
      await message.delete();
    } catch (err) {
      console.error('Impossible de supprimer le message :', err.message);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
