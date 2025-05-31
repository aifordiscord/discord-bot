const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Get detailed information about the server'),

    async execute(interaction) {
        try {
            // Check if command is used in a guild
            if (!interaction.guild) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Server Only', 'This command can only be used in a server.')],
                    ephemeral: true
                });
            }

            const guild = interaction.guild;

            // Fetch guild owner
            const owner = await guild.fetchOwner().catch(() => null);

            // Create detailed embed
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(guild.name)
                .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
                .setTimestamp();

            // Basic server info
            embed.addFields(
                { name: '🆔 Server ID', value: guild.id, inline: true },
                { name: '👑 Owner', value: owner ? owner.user.tag : 'Unknown', inline: true },
                { name: '🌍 Region', value: guild.preferredLocale || 'Unknown', inline: true }
            );

            // Server creation date
            const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);
            embed.addFields(
                { name: '📅 Created', value: `<t:${createdTimestamp}:F>\n<t:${createdTimestamp}:R>`, inline: true }
            );

            // Verification level
            const verificationLevels = {
                0: 'None',
                1: 'Low',
                2: 'Medium',
                3: 'High',
                4: 'Very High'
            };
            embed.addFields(
                { name: '🔒 Verification Level', value: verificationLevels[guild.verificationLevel] || 'Unknown', inline: true }
            );

            // Boost info
            embed.addFields(
                { name: '✨ Boost Level', value: `Level ${guild.premiumTier}`, inline: true },
                { name: '🚀 Boosts', value: guild.premiumSubscriptionCount.toString(), inline: true }
            );

            // Member statistics
            const members = guild.memberCount;
            const bots = guild.members.cache.filter(member => member.user.bot).size;
            const humans = members - bots;

            embed.addFields(
                { name: '👥 Members', value: `${members} total`, inline: true },
                { name: '👤 Humans', value: humans.toString(), inline: true },
                { name: '🤖 Bots', value: bots.toString(), inline: true }
            );

            // Channel statistics
            const channels = guild.channels.cache;
            const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
            const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
            const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;

            embed.addFields(
                { name: '📝 Text Channels', value: textChannels.toString(), inline: true },
                { name: '🔊 Voice Channels', value: voiceChannels.toString(), inline: true },
                { name: '📁 Categories', value: categories.toString(), inline: true }
            );

            // Role count
            embed.addFields(
                { name: '🎭 Roles', value: guild.roles.cache.size.toString(), inline: true },
                { name: '😀 Emojis', value: guild.emojis.cache.size.toString(), inline: true },
                { name: '💎 Stickers', value: guild.stickers.cache.size.toString(), inline: true }
            );

            // Features
            const features = guild.features;
            if (features.length > 0) {
                const featureNames = features.map(feature => {
                    return feature.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                    ).join(' ');
                });
                
                const featureText = featureNames.length > 5 
                    ? `${featureNames.slice(0, 5).join(', ')} and ${featureNames.length - 5} more...`
                    : featureNames.join(', ');
                    
                embed.addFields(
                    { name: '✨ Features', value: featureText, inline: false }
                );
            }

            // Server icon and banner
            if (guild.iconURL()) {
                embed.addFields(
                    { name: '🖼️ Server Icon', value: `[Click here](${guild.iconURL({ dynamic: true, size: 512 })})`, inline: true }
                );
            }

            if (guild.bannerURL()) {
                embed.addFields(
                    { name: '🎨 Server Banner', value: `[Click here](${guild.bannerURL({ dynamic: true, size: 512 })})`, inline: true }
                );
                embed.setImage(guild.bannerURL({ dynamic: true, size: 512 }));
            }

            await interaction.reply({ embeds: [embed] });

            logger.info(`${interaction.user.tag} requested server info for ${guild.name}`);

        } catch (error) {
            logger.error('Error in serverinfo command:', error);
            
            const errorEmbed = createEmbed('error', 'Command Failed', 'An unexpected error occurred while fetching server information.');
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            }
        }
    }
};