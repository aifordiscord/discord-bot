const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { addModLog } = require('../../database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('delete_days')
                .setDescription('Number of days of messages to delete (0-7)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        try {
            // Check if command is used in a guild
            if (!interaction.guild) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Server Only', 'This command can only be used in a server.')],
                    ephemeral: true
                });
            }

            // Check if user has required permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Missing Permissions', 'You need the "Ban Members" permission to use this command.')],
                    ephemeral: true
                });
            }

            // Check if bot has required permissions
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Bot Missing Permissions', 'I need the "Ban Members" permission to execute this command.')],
                    ephemeral: true
                });
            }

            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const deleteDays = interaction.options.getInteger('delete_days') || 0;

            // Validate user parameter
            if (!targetUser) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Invalid User', 'Please provide a valid user to ban.')],
                    ephemeral: true
                });
            }

            // Check if user is trying to ban themselves
            if (targetUser.id === interaction.user.id) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Invalid Target', 'You cannot ban yourself.')],
                    ephemeral: true
                });
            }

            // Check if user is trying to ban the bot
            if (targetUser.id === interaction.client.user.id) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Invalid Target', 'I cannot ban myself.')],
                    ephemeral: true
                });
            }

            // Get target member
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            // Check if target is bannable (if they're still in the server)
            if (targetMember) {
                if (!targetMember.bannable) {
                    return await interaction.reply({
                        embeds: [createEmbed('error', 'Error', 'I cannot ban this user. They may have higher permissions than me.')],
                        ephemeral: true
                    });
                }

                // Check role hierarchy
                if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                    return await interaction.reply({
                        embeds: [createEmbed('error', 'Error', 'You cannot ban a user with equal or higher role than yours.')],
                        ephemeral: true
                    });
                }
            }

            // Try to send DM to user before banning
            try {
                const dmEmbed = createEmbed('error', 'You have been banned', 
                    `**Server:** ${interaction.guild.name}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`);
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                logger.warn(`Could not send DM to ${targetUser.tag}: ${error.message}`);
            }

            // Ban the user
            await interaction.guild.members.ban(targetUser, {
                reason: `${reason} | Moderator: ${interaction.user.tag}`,
                deleteMessageDays: deleteDays
            });

            // Log the action to database
            await addModLog(
                interaction.guild.id,
                targetUser.id,
                interaction.user.id,
                'ban',
                reason
            );

            // Create success embed
            const successEmbed = createEmbed('success', 'User Banned', 
                `**User:** ${targetUser.tag} (${targetUser.id})\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}\n**Messages Deleted:** ${deleteDays} day(s)`);

            await interaction.reply({ embeds: [successEmbed] });

            // Log to mod channel if configured
            const guildSettings = await require('../../database').getGuildSettings(interaction.guild.id);
            if (guildSettings?.mod_log_channel) {
                const logChannel = interaction.guild.channels.cache.get(guildSettings.mod_log_channel);
                if (logChannel) {
                    const logEmbed = createEmbed('error', 'Member Banned', 
                        `**User:** ${targetUser.tag} (${targetUser.id})\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}\n**Messages Deleted:** ${deleteDays} day(s)\n**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`);
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

            logger.info(`${interaction.user.tag} banned ${targetUser.tag} in ${interaction.guild.name} for: ${reason}`);

        } catch (error) {
            logger.error('Error in ban command:', error);
            
            let errorMessage = 'An unexpected error occurred while trying to ban the user.';
            
            if (error.code === 50013) {
                errorMessage = 'I do not have permission to ban this user. Please check my role hierarchy and permissions.';
            } else if (error.message.includes('Missing Permissions')) {
                errorMessage = 'I am missing the required permissions to ban users.';
            } else if (error.message.includes('Unknown User')) {
                errorMessage = 'The specified user could not be found.';
            } else if (error.message.includes('Cannot ban')) {
                errorMessage = 'This user cannot be banned. They may have higher permissions than me.';
            }
            
            const errorEmbed = createEmbed('error', 'Ban Failed', errorMessage);
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            }
        }
    }
};
