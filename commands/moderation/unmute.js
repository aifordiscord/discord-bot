const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { addModLog, getGuildSettings } = require('../../database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Unmute a user in the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to unmute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the unmute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

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
            if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Missing Permissions', 'You need the "Moderate Members" permission to use this command.')],
                    ephemeral: true
                });
            }

            // Check if bot has required permissions
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Bot Missing Permissions', 'I need the "Moderate Members" permission to execute this command.')],
                    ephemeral: true
                });
            }

            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            // Validate user parameter
            if (!targetUser) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Invalid User', 'Please provide a valid user to unmute.')],
                    ephemeral: true
                });
            }

            // Get target member
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (!targetMember) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'User Not Found', 'This user is not in the server.')],
                    ephemeral: true
                });
            }

            // Check if target is mutable
            if (!targetMember.moderatable) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Permission Error', 'I cannot unmute this user. They may have higher permissions than me.')],
                    ephemeral: true
                });
            }

            // Check if user is actually muted
            if (!targetMember.isCommunicationDisabled()) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Error', 'This user is not muted.')],
                    ephemeral: true
                });
            }

            // Try to send DM to user before unmuting
            try {
                const dmEmbed = createEmbed('success', 'You have been unmuted', 
                    `**Server:** ${interaction.guild.name}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`);
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                logger.warn(`Could not send DM to ${targetUser.tag}: ${error.message}`);
            }

            // Unmute the user
            await targetMember.timeout(null, `${reason} | Moderator: ${interaction.user.tag}`);

            // Log the action to database
            await addModLog(
                interaction.guild.id,
                targetUser.id,
                interaction.user.id,
                'unmute',
                reason
            );

            // Create success embed
            const successEmbed = createEmbed('success', 'User Unmuted', 
                `**User:** ${targetUser.tag} (${targetUser.id})\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`);

            await interaction.reply({ embeds: [successEmbed] });

            // Log to mod channel if configured
            const guildSettings = await getGuildSettings(interaction.guild.id);
            if (guildSettings?.mod_log_channel) {
                const logChannel = interaction.guild.channels.cache.get(guildSettings.mod_log_channel);
                if (logChannel) {
                    const logEmbed = createEmbed('success', 'Member Unmuted', 
                        `**User:** ${targetUser.tag} (${targetUser.id})\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}\n**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`);
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

            logger.info(`${interaction.user.tag} unmuted ${targetUser.tag} in ${interaction.guild.name} for: ${reason}`);

        } catch (error) {
            logger.error('Error in unmute command:', error);
            
            const errorEmbed = createEmbed('error', 'Error', 'An error occurred while trying to unmute the user. Please check my permissions and try again.');
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};
