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

// userId -> { intervalId, interaction, vocal1, vocal2 } (troll en cours)
const activeTrolls = new Map();

// userId -> { intervalId, originalNick } (renommage aléatoire en cours)
const activeRenames = new Map();

const RANDOM_NAMES = [
  'Patate', 'Nouille', 'Fromage qui pue', 'Escargot Ninja', 'Baguette Magique',
  'Chaussette Perdue', 'Camembert Explosif', 'Zébulon', 'Girafe Timide',
  'Sanglier Discret', 'Pigeon Voyageur', 'Crevette Fantôme', 'Yaourt Nature',
  'Radis Sauvage', 'Champignon Suspect',
];

async function stopTroll(userId, reason) {
  const troll = activeTrolls.get(userId);
  if (!troll) return false;

  clearInterval(troll.intervalId);
  activeTrolls.delete(userId);

  if (reason) {
    await troll.interaction.followUp(reason).catch(() => {});
  }

  return true;
}

async function stopRename(guild, userId, reason, interaction) {
  const rename = activeRenames.get(userId);
  if (!rename) return false;

  clearInterval(rename.intervalId);
  activeRenames.delete(userId);

  const member = await guild.members.fetch(userId).catch(() => null);
  if (member) {
    await member.setNickname(rename.originalNick).catch(() => {});
  }

  if (reason && interaction) {
    await interaction.followUp(reason).catch(() => {});
  }

  return true;
}

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

  if (interaction.commandName === 'troll') {
    const user = interaction.options.getUser('user');
    const vocal1 = interaction.options.getChannel('vocal1');
    const vocal2 = interaction.options.getChannel('vocal2');
    const duree = interaction.options.getInteger('duree');

    if (vocal1.type !== ChannelType.GuildVoice || vocal2.type !== ChannelType.GuildVoice) {
      return interaction.reply({ content: '❌ Les deux salons doivent être des salons vocaux.', ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member || !member.voice.channelId) {
      return interaction.reply({ content: "❌ Cet utilisateur n'est pas en vocal.", ephemeral: true });
    }

    // Si un troll est déjà en cours sur cette personne, on l'arrête d'abord (sans message)
    await stopTroll(user.id, null);

    let toggle = true;
    let remaining = duree;

    await interaction.reply(`😈 ${user} rebondit entre ${vocal1} et ${vocal2}. Temps restant : ${remaining}s (décompte en pause si déconnecté).`);

    const intervalId = setInterval(async () => {
      const currentMember = await interaction.guild.members.fetch(user.id).catch(() => null);

      // Pas en vocal : le décompte est en pause, on ne fait rien ce tick
      if (!currentMember || !currentMember.voice.channelId) return;

      // La personne est en vocal : le temps décompte
      remaining -= 1;

      try {
        await currentMember.voice.setChannel(toggle ? vocal1 : vocal2);
        toggle = !toggle;
      } catch (err) {
        // Erreur ponctuelle (rate limit, permissions...) : on ignore et on continue
      }

      if (remaining <= 0) {
        await stopTroll(user.id, `✅ Troll terminé sur ${user}.`);
        return;
      }

      await interaction.editReply(`😈 ${user} rebondit entre ${vocal1} et ${vocal2}. Temps restant : ${remaining}s (décompte en pause si déconnecté).`).catch(() => {});
    }, 1000);

    activeTrolls.set(user.id, { intervalId, interaction, vocal1, vocal2 });
    return;
  }

  if (interaction.commandName === 'untroll') {
    const user = interaction.options.getUser('user');

    if (!activeTrolls.has(user.id)) {
      return interaction.reply({ content: `Aucun troll en cours sur ${user}.`, ephemeral: true });
    }

    await stopTroll(user.id, `🛑 Troll arrêté sur ${user}.`);
    return interaction.reply({ content: 'Fait.', ephemeral: true });
  }

  if (interaction.commandName === 'renomme-random') {
    const user = interaction.options.getUser('user');
    const duree = interaction.options.getInteger('duree');

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: "❌ Membre introuvable sur ce serveur.", ephemeral: true });
    }

    // Si un renommage est déjà en cours sur cette personne, on l'arrête d'abord (sans message)
    await stopRename(interaction.guild, user.id, null, null);

    const originalNick = member.nickname; // null = pas de pseudo custom (utilise le nom du compte)

    const intervalId = setInterval(async () => {
      const currentMember = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!currentMember) return;

      const randomName = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
      await currentMember.setNickname(randomName).catch(err => {
        console.error(`Impossible de renommer ${user.tag} :`, err.message);
      });
    }, 2000);

    // Arrêt automatique après la durée demandée
    setTimeout(() => {
      stopRename(interaction.guild, user.id, `✅ Renommage terminé sur ${user}, pseudo restauré.`, interaction);
    }, duree * 1000);

    activeRenames.set(user.id, { intervalId, originalNick });

    return interaction.reply(`🎭 ${user} va être renommé aléatoirement toutes les 3 secondes pendant ${duree} secondes.`);
  }

  if (interaction.commandName === 'unrenomme-random') {
    const user = interaction.options.getUser('user');

    if (!activeRenames.has(user.id)) {
      return interaction.reply({ content: `Aucun renommage en cours sur ${user}.`, ephemeral: true });
    }

    await stopRename(interaction.guild, user.id, `🛑 Renommage arrêté sur ${user}, pseudo restauré.`, interaction);
    return interaction.reply({ content: 'Fait.', ephemeral: true });
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
