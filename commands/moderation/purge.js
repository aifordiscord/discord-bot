const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { addModLog } = require('../../database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete multiple messages at once')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Only delete messages from this user')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for purging messages')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

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
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Missing Permissions', 'You need the "Manage Messages" permission to use this command.')],
                    ephemeral: true
                });
            }

            // Check if bot has required permissions
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Bot Missing Permissions', 'I need the "Manage Messages" permission to execute this command.')],
                    ephemeral: true
                });
            }

            const amount = interaction.options.getInteger('amount');
            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            // Defer the reply since this might take time
            await interaction.deferReply({ ephemeral: true });

            // Fetch messages
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            
            let messagesToDelete = messages.first(amount);

            // Filter by user if specified
            if (targetUser) {
                messagesToDelete = messages.filter(msg => msg.author.id === targetUser.id).first(amount);
                if (messagesToDelete.length === 0) {
                    return await interaction.editReply({
                        embeds: [createEmbed('error', 'No Messages Found', `No messages from ${targetUser.tag} found in the recent history.`)]
                    });
                }
            }

            // Filter out messages older than 14 days (Discord limitation)
            const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
            messagesToDelete = messagesToDelete.filter(msg => msg.createdTimestamp > twoWeeksAgo);

            if (messagesToDelete.length === 0) {
                return await interaction.editReply({
                    embeds: [createEmbed('error', 'No Messages to Delete', 'No messages found that can be deleted (messages older than 14 days cannot be bulk deleted).')]
                });
            }

            // Delete messages
            await interaction.channel.bulkDelete(messagesToDelete, true);

            // Log the action
            await addModLog(
                interaction.guild.id,
                targetUser?.id || 'all',
                interaction.user.id,
                'purge',
                `${reason} | Deleted ${messagesToDelete.length} messages`
            );

            // Send success message
            const successEmbed = createEmbed('success', 'Messages Purged', 
                `Successfully deleted **${messagesToDelete.length}** message(s).\n\n` +
                `**Channel:** ${interaction.channel}\n` +
                `${targetUser ? `**User:** ${targetUser.tag}\n` : ''}` +
                `**Reason:** ${reason}\n` +
                `**Moderator:** ${interaction.user.tag}`
            );

            await interaction.editReply({ embeds: [successEmbed] });

            // Log to mod channel if configured
            const guildSettings = await require('../../database').getGuildSettings(interaction.guild.id);
            if (guildSettings?.mod_log_channel) {
                const logChannel = interaction.guild.channels.cache.get(guildSettings.mod_log_channel);
                if (logChannel) {
                    const logEmbed = createEmbed('warning', 'Messages Purged', 
                        `**Channel:** ${interaction.channel}\n` +
                        `**Messages Deleted:** ${messagesToDelete.length}\n` +
                        `${targetUser ? `**Target User:** ${targetUser.tag}\n` : ''}` +
                        `**Reason:** ${reason}\n` +
                        `**Moderator:** ${interaction.user.tag}\n` +
                        `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`
                    );
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

            logger.info(`${interaction.user.tag} purged ${messagesToDelete.length} messages in ${interaction.channel.name} (${interaction.guild.name})`);

        } catch (error) {
            logger.error('Error in purge command:', error);
            
            let errorMessage = 'An unexpected error occurred while purging messages.';
            
            if (error.code === 50013) {
                errorMessage = 'I do not have permission to delete messages in this channel.';
            } else if (error.message.includes('Missing Permissions')) {
                errorMessage = 'I am missing the required permissions to manage messages.';
            } else if (error.message.includes('bulk delete')) {
                errorMessage = 'Failed to bulk delete messages. Some messages may be too old (older than 14 days).';
            }
            
            const errorEmbed = createEmbed('error', 'Purge Failed', errorMessage);
            
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            }
        }
    }
};