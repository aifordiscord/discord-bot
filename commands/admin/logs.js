const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { getGuildSettings, updateGuildSettings } = require('../../database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('Configure server logging settings')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'Set Mod Log Channel', value: 'mod_log' },
                    { name: 'Set Join/Leave Log', value: 'member_log' },
                    { name: 'Set Message Log', value: 'message_log' },
                    { name: 'Disable Logging', value: 'disable' },
                    { name: 'View Settings', value: 'view' }
                ))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel for logging (required for setting logs)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

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
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Missing Permissions', 'You need the "Manage Server" permission to use this command.')],
                    ephemeral: true
                });
            }

            const action = interaction.options.getString('action');
            const channel = interaction.options.getChannel('channel');

            switch (action) {
                case 'mod_log':
                    await handleModLog(interaction, channel);
                    break;
                case 'member_log':
                    await handleMemberLog(interaction, channel);
                    break;
                case 'message_log':
                    await handleMessageLog(interaction, channel);
                    break;
                case 'disable':
                    await handleDisableLogging(interaction);
                    break;
                case 'view':
                    await handleViewSettings(interaction);
                    break;
                default:
                    await interaction.reply({
                        embeds: [createEmbed('error', 'Invalid Action', 'Please select a valid action.')],
                        ephemeral: true
                    });
            }

        } catch (error) {
            logger.error('Error in logs command:', error);
            
            let errorMessage = 'An unexpected error occurred while configuring logging.';
            
            if (error.message.includes('Missing Permissions')) {
                errorMessage = 'I am missing the required permissions to set up logging.';
            } else if (error.message.includes('Database')) {
                errorMessage = 'Database error occurred while saving logging settings. Please try again.';
            }
            
            const errorEmbed = createEmbed('error', 'Logging Failed', errorMessage);
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            }
        }
    }
};

async function handleModLog(interaction, channel) {
    if (!channel) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Missing Channel', 'Please specify a channel for moderation logs.')],
            ephemeral: true
        });
    }

    // Check bot permissions in the channel
    const permissions = channel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Missing Permissions', 'I need View Channel, Send Messages, and Embed Links permissions in that channel.')],
            ephemeral: true
        });
    }

    const currentSettings = await getGuildSettings(interaction.guild.id) || {};
    await updateGuildSettings(interaction.guild.id, {
        ...currentSettings,
        mod_log_channel: channel.id
    });

    const successEmbed = createEmbed('success', 'Mod Log Configured', 
        `Moderation log channel has been set to ${channel}.\n\nAll moderation actions (bans, kicks, mutes, warnings) will now be logged there.`);

    await interaction.reply({ embeds: [successEmbed] });
    logger.info(`${interaction.user.tag} set mod log channel to ${channel.name} in ${interaction.guild.name}`);
}

async function handleMemberLog(interaction, channel) {
    if (!channel) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Missing Channel', 'Please specify a channel for member join/leave logs.')],
            ephemeral: true
        });
    }

    const permissions = channel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Missing Permissions', 'I need View Channel, Send Messages, and Embed Links permissions in that channel.')],
            ephemeral: true
        });
    }

    const currentSettings = await getGuildSettings(interaction.guild.id) || {};
    await updateGuildSettings(interaction.guild.id, {
        ...currentSettings,
        member_log_channel: channel.id
    });

    const successEmbed = createEmbed('success', 'Member Log Configured', 
        `Member log channel has been set to ${channel}.\n\nAll member joins and leaves will now be logged there.`);

    await interaction.reply({ embeds: [successEmbed] });
    logger.info(`${interaction.user.tag} set member log channel to ${channel.name} in ${interaction.guild.name}`);
}

async function handleMessageLog(interaction, channel) {
    if (!channel) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Missing Channel', 'Please specify a channel for message logs.')],
            ephemeral: true
        });
    }

    const permissions = channel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Missing Permissions', 'I need View Channel, Send Messages, and Embed Links permissions in that channel.')],
            ephemeral: true
        });
    }

    const currentSettings = await getGuildSettings(interaction.guild.id) || {};
    await updateGuildSettings(interaction.guild.id, {
        ...currentSettings,
        message_log_channel: channel.id
    });

    const successEmbed = createEmbed('success', 'Message Log Configured', 
        `Message log channel has been set to ${channel}.\n\nDeleted and edited messages will now be logged there.`);

    await interaction.reply({ embeds: [successEmbed] });
    logger.info(`${interaction.user.tag} set message log channel to ${channel.name} in ${interaction.guild.name}`);
}

async function handleDisableLogging(interaction) {
    const currentSettings = await getGuildSettings(interaction.guild.id) || {};
    await updateGuildSettings(interaction.guild.id, {
        ...currentSettings,
        mod_log_channel: null,
        member_log_channel: null,
        message_log_channel: null
    });

    const successEmbed = createEmbed('success', 'Logging Disabled', 
        'All logging has been disabled. You can re-enable specific logs using `/logs` commands.');

    await interaction.reply({ embeds: [successEmbed] });
    logger.info(`${interaction.user.tag} disabled all logging in ${interaction.guild.name}`);
}

async function handleViewSettings(interaction) {
    const guildSettings = await getGuildSettings(interaction.guild.id);

    if (!guildSettings) {
        return await interaction.reply({
            embeds: [createEmbed('info', 'No Settings', 'No logging settings have been configured yet.')],
            ephemeral: true
        });
    }

    let settingsText = '';

    if (guildSettings.mod_log_channel) {
        const modChannel = interaction.guild.channels.cache.get(guildSettings.mod_log_channel);
        settingsText += `**Moderation Log:** ${modChannel || 'Channel not found'}\n`;
    }

    if (guildSettings.member_log_channel) {
        const memberChannel = interaction.guild.channels.cache.get(guildSettings.member_log_channel);
        settingsText += `**Member Log:** ${memberChannel || 'Channel not found'}\n`;
    }

    if (guildSettings.message_log_channel) {
        const messageChannel = interaction.guild.channels.cache.get(guildSettings.message_log_channel);
        settingsText += `**Message Log:** ${messageChannel || 'Channel not found'}\n`;
    }

    if (!settingsText) {
        settingsText = 'No logging channels configured.';
    }

    const embed = createEmbed('info', 'Current Logging Settings', settingsText);
    await interaction.reply({ embeds: [embed], ephemeral: true });
}