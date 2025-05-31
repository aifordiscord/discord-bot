const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Display a user\'s avatar')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user whose avatar to display')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`${targetUser.username}'s Avatar`)
                .setImage(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
                .setTimestamp();

            // Add download links
            const avatarLinks = [
                `[PNG](${targetUser.displayAvatarURL({ extension: 'png', size: 512 })})`,
                `[JPG](${targetUser.displayAvatarURL({ extension: 'jpg', size: 512 })})`,
                `[WEBP](${targetUser.displayAvatarURL({ extension: 'webp', size: 512 })})`
            ];

            if (targetUser.displayAvatarURL().includes('.gif')) {
                avatarLinks.push(`[GIF](${targetUser.displayAvatarURL({ extension: 'gif', size: 512 })})`);
            }

            embed.setDescription(`**Download:** ${avatarLinks.join(' • ')}`);
            embed.setFooter({ text: `User ID: ${targetUser.id}` });

            await interaction.reply({ embeds: [embed] });

            logger.info(`${interaction.user.tag} requested avatar for ${targetUser.tag}`);

        } catch (error) {
            logger.error('Error in avatar command:', error);
            
            const errorEmbed = createEmbed('error', 'Command Failed', 'An unexpected error occurred while fetching the avatar.');
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            }
        }
    }
};