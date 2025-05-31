const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { addModLog } = require('../../database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            // Check if user is trying to kick themselves
            if (targetUser.id === interaction.user.id) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Error', 'You cannot kick yourself!')],
                    ephemeral: true
                });
            }

            // Check if user is trying to kick the bot
            if (targetUser.id === interaction.client.user.id) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Error', 'I cannot kick myself!')],
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

            // Check if target is kickable
            if (!targetMember.kickable) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Error', 'I cannot kick this user. They may have higher permissions than me.')],
                    ephemeral: true
                });
            }

            // Check role hierarchy
            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Error', 'You cannot kick a user with equal or higher role than yours.')],
                    ephemeral: true
                });
            }

            // Try to send DM to user before kicking
            try {
                const dmEmbed = createEmbed('warning', 'You have been kicked', 
                    `**Server:** ${interaction.guild.name}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`);
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                logger.warn(`Could not send DM to ${targetUser.tag}: ${error.message}`);
            }

            // Kick the user
            await targetMember.kick(`${reason} | Moderator: ${interaction.user.tag}`);

            // Log the action to database
            await addModLog(
                interaction.guild.id,
                targetUser.id,
                interaction.user.id,
                'kick',
                reason
            );

            // Create success embed
            const successEmbed = createEmbed('success', 'User Kicked', 
                `**User:** ${targetUser.tag} (${targetUser.id})\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`);

            await interaction.reply({ embeds: [successEmbed] });

            // Log to mod channel if configured
            const guildSettings = await require('../../database').getGuildSettings(interaction.guild.id);
            if (guildSettings?.mod_log_channel) {
                const logChannel = interaction.guild.channels.cache.get(guildSettings.mod_log_channel);
                if (logChannel) {
                    const logEmbed = createEmbed('warning', 'Member Kicked', 
                        `**User:** ${targetUser.tag} (${targetUser.id})\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}\n**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`);
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

            logger.info(`${interaction.user.tag} kicked ${targetUser.tag} from ${interaction.guild.name} for: ${reason}`);

        } catch (error) {
            logger.error('Error in kick command:', error);
            
            const errorEmbed = createEmbed('error', 'Error', 'An error occurred while trying to kick the user. Please check my permissions and try again.');
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};
