const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { addWarning, getWarningCount, addModLog, getGuildSettings } = require('../../database');
const config = require('../../config');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to warn')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the warning')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');

            // Check if user is trying to warn themselves
            if (targetUser.id === interaction.user.id) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Error', 'You cannot warn yourself!')],
                    ephemeral: true
                });
            }

            // Check if user is trying to warn the bot
            if (targetUser.id === interaction.client.user.id) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Error', 'I cannot warn myself!')],
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

            // Check role hierarchy
            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Error', 'You cannot warn a user with equal or higher role than yours.')],
                    ephemeral: true
                });
            }

            // Add warning to database
            const warningId = await addWarning(
                interaction.guild.id,
                targetUser.id,
                interaction.user.id,
                reason
            );

            // Get current warning count
            const warningCount = await getWarningCount(interaction.guild.id, targetUser.id);

            // Log the action to database
            await addModLog(
                interaction.guild.id,
                targetUser.id,
                interaction.user.id,
                'warn',
                reason
            );

            // Try to send DM to user
            try {
                const dmEmbed = createEmbed('warning', 'You have received a warning', 
                    `**Server:** ${interaction.guild.name}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}\n**Warning Count:** ${warningCount}/${config.moderation.maxWarnings}`);
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                logger.warn(`Could not send DM to ${targetUser.tag}: ${error.message}`);
            }

            // Create success embed
            let successMessage = `**User:** ${targetUser.tag} (${targetUser.id})\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}\n**Warning ID:** ${warningId}\n**Total Warnings:** ${warningCount}/${config.moderation.maxWarnings}`;

            // Check if user should be auto-punished for too many warnings
            if (warningCount >= config.moderation.maxWarnings) {
                try {
                    // Auto-mute for 24 hours
                    const duration = 24 * 60 * 60 * 1000; // 24 hours
                    await targetMember.timeout(duration, `Automatic punishment for reaching ${config.moderation.maxWarnings} warnings`);
                    
                    successMessage += `\n\n⚠️ **Auto-punishment:** User has been muted for 24 hours due to reaching the warning limit.`;
                    
                    // Log auto-punishment
                    await addModLog(
                        interaction.guild.id,
                        targetUser.id,
                        interaction.client.user.id,
                        'auto-mute',
                        `Automatic punishment for ${config.moderation.maxWarnings} warnings`,
                        duration
                    );
                } catch (autoMuteError) {
                    logger.error('Failed to auto-mute user:', autoMuteError);
                    successMessage += `\n\n⚠️ **Warning:** User has reached the warning limit but auto-punishment failed.`;
                }
            }

            const successEmbed = createEmbed('warning', 'User Warned', successMessage);
            await interaction.reply({ embeds: [successEmbed] });

            // Log to mod channel if configured
            const guildSettings = await getGuildSettings(interaction.guild.id);
            if (guildSettings?.mod_log_channel) {
                const logChannel = interaction.guild.channels.cache.get(guildSettings.mod_log_channel);
                if (logChannel) {
                    let logMessage = `**User:** ${targetUser.tag} (${targetUser.id})\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}\n**Warning ID:** ${warningId}\n**Total Warnings:** ${warningCount}/${config.moderation.maxWarnings}\n**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`;
                    
                    if (warningCount >= config.moderation.maxWarnings) {
                        logMessage += `\n\n⚠️ **Auto-punishment:** User muted for 24 hours`;
                    }
                    
                    const logEmbed = createEmbed('warning', 'Member Warned', logMessage);
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

            logger.info(`${interaction.user.tag} warned ${targetUser.tag} in ${interaction.guild.name} for: ${reason} (Warning ${warningCount}/${config.moderation.maxWarnings})`);

        } catch (error) {
            logger.error('Error in warn command:', error);
            
            const errorEmbed = createEmbed('error', 'Error', 'An error occurred while trying to warn the user. Please try again.');
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};
