const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { addModLog, getGuildSettings } = require('../../database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a user in the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to mute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration (e.g., 1h, 30m, 1d)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the mute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            const durationString = interaction.options.getString('duration');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            // Check if user is trying to mute themselves
            if (targetUser.id === interaction.user.id) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Error', 'You cannot mute yourself!')],
                    ephemeral: true
                });
            }

            // Check if user is trying to mute the bot
            if (targetUser.id === interaction.client.user.id) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Error', 'I cannot mute myself!')],
                    ephemeral: true
                });
            }

            // Get target member
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (!targetMember) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Error', 'This user is not in the server.')],
                    ephemeral: true
                });
            }

            // Check if target is mutable
            if (!targetMember.moderatable) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Error', 'I cannot mute this user. They may have higher permissions than me.')],
                    ephemeral: true
                });
            }

            // Check role hierarchy
            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Error', 'You cannot mute a user with equal or higher role than yours.')],
                    ephemeral: true
                });
            }

            // Check if user is already muted
            if (targetMember.isCommunicationDisabled()) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Error', 'This user is already muted.')],
                    ephemeral: true
                });
            }

            // Parse duration
            let duration = null;
            let durationMs = null;
            if (durationString) {
                durationMs = parseDuration(durationString);
                if (!durationMs || durationMs > 28 * 24 * 60 * 60 * 1000) { // Max 28 days
                    return await interaction.reply({
                        embeds: [createEmbed('error', 'Error', 'Invalid duration. Use format like 1h, 30m, 1d (max 28 days)')],
                        ephemeral: true
                    });
                }
                duration = new Date(Date.now() + durationMs);
            }

            // Try to send DM to user before muting
            try {
                let dmMessage = `**Server:** ${interaction.guild.name}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`;
                if (duration) {
                    dmMessage += `\n**Duration:** Until <t:${Math.floor(duration.getTime() / 1000)}:F>`;
                }
                const dmEmbed = createEmbed('warning', 'You have been muted', dmMessage);
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                logger.warn(`Could not send DM to ${targetUser.tag}: ${error.message}`);
            }

            // Mute the user
            await targetMember.timeout(durationMs, `${reason} | Moderator: ${interaction.user.tag}`);

            // Log the action to database
            await addModLog(
                interaction.guild.id,
                targetUser.id,
                interaction.user.id,
                'mute',
                reason,
                durationMs
            );

            // Create success embed
            let successMessage = `**User:** ${targetUser.tag} (${targetUser.id})\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`;
            if (duration) {
                successMessage += `\n**Duration:** Until <t:${Math.floor(duration.getTime() / 1000)}:F>`;
            } else {
                successMessage += '\n**Duration:** Indefinite';
            }

            const successEmbed = createEmbed('success', 'User Muted', successMessage);
            await interaction.reply({ embeds: [successEmbed] });

            // Log to mod channel if configured
            const guildSettings = await getGuildSettings(interaction.guild.id);
            if (guildSettings?.mod_log_channel) {
                const logChannel = interaction.guild.channels.cache.get(guildSettings.mod_log_channel);
                if (logChannel) {
                    let logMessage = `**User:** ${targetUser.tag} (${targetUser.id})\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`;
                    if (duration) {
                        logMessage += `\n**Duration:** Until <t:${Math.floor(duration.getTime() / 1000)}:F>`;
                    } else {
                        logMessage += '\n**Duration:** Indefinite';
                    }
                    logMessage += `\n**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`;
                    
                    const logEmbed = createEmbed('warning', 'Member Muted', logMessage);
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

            logger.info(`${interaction.user.tag} muted ${targetUser.tag} in ${interaction.guild.name} for: ${reason}`);

        } catch (error) {
            logger.error('Error in mute command:', error);
            
            const errorEmbed = createEmbed('error', 'Error', 'An error occurred while trying to mute the user. Please check my permissions and try again.');
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};

/**
 * Parse duration string to milliseconds
 * @param {string} durationString - Duration string (e.g., "1h", "30m", "1d")
 * @returns {number|null} Duration in milliseconds or null if invalid
 */
function parseDuration(durationString) {
    const regex = /^(\d+)([smhd])$/i;
    const match = durationString.match(regex);
    
    if (!match) return null;
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    const multipliers = {
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000
    };
    
    return value * multipliers[unit];
}
