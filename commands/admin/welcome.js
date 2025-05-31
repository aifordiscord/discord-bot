const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, AttachmentBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { getGuildSettings, updateGuildSettings } = require('../../database');
const welcomeImage = require('../../utils/welcomeImage');
const config = require('../../config');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Configure welcome message system')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'Set Channel & Message', value: 'set' },
                    { name: 'Set Background Image', value: 'background' },
                    { name: 'Toggle Image Mode', value: 'toggle_image' },
                    { name: 'Disable Welcome', value: 'disable' },
                    { name: 'Test Welcome', value: 'test' },
                    { name: 'View Current Settings', value: 'view' }
                ))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to send welcome messages (required for set action)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Welcome message template (use {user} for mention)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('background_url')
                .setDescription('Background image URL for welcome cards (must be direct image link)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        try {
            const action = interaction.options.getString('action');
            const channel = interaction.options.getChannel('channel');
            const message = interaction.options.getString('message');

            switch (action) {
                case 'set':
                    await handleSetWelcome(interaction, channel, message);
                    break;
                case 'background':
                    await handleSetBackground(interaction);
                    break;
                case 'toggle_image':
                    await handleToggleImage(interaction);
                    break;
                case 'disable':
                    await handleDisableWelcome(interaction);
                    break;
                case 'test':
                    await handleTestWelcome(interaction);
                    break;
                case 'view':
                    await handleViewSettings(interaction);
                    break;
                default:
                    await interaction.reply({
                        embeds: [createEmbed('error', 'Error', 'Invalid action specified.')],
                        ephemeral: true
                    });
            }
        } catch (error) {
            logger.error('Error in welcome command:', error);
            
            const errorEmbed = createEmbed('error', 'Error', 'An error occurred while processing the welcome command. Please try again.');
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};

async function handleSetWelcome(interaction, channel, message) {
    if (!channel) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Error', 'You must specify a channel for welcome messages.')],
            ephemeral: true
        });
    }

    if (!message) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Error', 'You must specify a welcome message template.')],
            ephemeral: true
        });
    }

    // Check if bot can send messages in the channel
    const permissions = channel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(['ViewChannel', 'SendMessages'])) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Error', 'I do not have permission to send messages in that channel.')],
            ephemeral: true
        });
    }

    // Validate message length
    if (message.length > 1000) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Error', 'Welcome message must be 1000 characters or less.')],
            ephemeral: true
        });
    }

    // Update guild settings
    await updateGuildSettings(interaction.guild.id, {
        welcome_channel: channel.id,
        welcome_message: message
    });

    const successEmbed = createEmbed('success', 'Welcome System Configured', 
        `**Channel:** ${channel}\n**Message:** ${message}\n\n**Preview:**\n${message.replace('{user}', interaction.user)}\n\n**Tips:**\n• Use \`{user}\` to mention the new member\n• Use \`/welcome test\` to test the welcome message\n• Use \`/welcome disable\` to disable welcome messages`);

    await interaction.reply({ embeds: [successEmbed] });

    logger.info(`${interaction.user.tag} configured welcome system in ${interaction.guild.name} - Channel: ${channel.name}`);
}

async function handleDisableWelcome(interaction) {
    const guildSettings = await getGuildSettings(interaction.guild.id);

    if (!guildSettings?.welcome_channel) {
        return await interaction.reply({
            embeds: [createEmbed('info', 'Welcome System', 'Welcome messages are not currently enabled.')],
            ephemeral: true
        });
    }

    // Update guild settings to disable welcome
    await updateGuildSettings(interaction.guild.id, {
        welcome_channel: null,
        welcome_message: null
    });

    const successEmbed = createEmbed('success', 'Welcome System Disabled', 
        'Welcome messages have been disabled. New members will no longer receive welcome messages.\n\nYou can re-enable them anytime using `/welcome set`.');

    await interaction.reply({ embeds: [successEmbed] });

    logger.info(`${interaction.user.tag} disabled welcome system in ${interaction.guild.name}`);
}

async function handleSetBackground(interaction) {
    const backgroundUrl = interaction.options.getString('background_url');
    
    if (!backgroundUrl) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Missing URL', 'Please provide a background image URL.')],
            ephemeral: true
        });
    }

    // Validate URL format
    try {
        new URL(backgroundUrl);
    } catch {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Invalid URL', 'Please provide a valid image URL.')],
            ephemeral: true
        });
    }

    try {
        const currentSettings = await getGuildSettings(interaction.guild.id) || {};
        await updateGuildSettings(interaction.guild.id, {
            ...currentSettings,
            background_url: backgroundUrl
        });

        const successEmbed = createEmbed('success', 'Background Updated', 
            `Welcome card background has been set to the provided image.\n\n**URL:** ${backgroundUrl}\n\nUse \`/welcome test\` to see how it looks!`);

        await interaction.reply({ embeds: [successEmbed], ephemeral: true });

        logger.info(`${interaction.user.tag} set welcome background in ${interaction.guild.name}`);
    } catch (error) {
        logger.error('Error setting welcome background:', error);
        
        const errorEmbed = createEmbed('error', 'Error', 'Failed to update welcome background. Please try again.');
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

async function handleToggleImage(interaction) {
    try {
        const currentSettings = await getGuildSettings(interaction.guild.id) || {};
        const currentState = currentSettings.welcome_image_enabled !== false;
        const newState = !currentState;

        await updateGuildSettings(interaction.guild.id, {
            ...currentSettings,
            welcome_image_enabled: newState
        });

        const statusText = newState ? 'enabled' : 'disabled';
        const successEmbed = createEmbed('success', 'Image Mode Updated', 
            `Welcome image generation has been **${statusText}**.\n\n${newState ? 
                'New members will receive welcome cards with images.' : 
                'New members will receive text-only welcome messages.'}`);

        await interaction.reply({ embeds: [successEmbed], ephemeral: true });

        logger.info(`${interaction.user.tag} ${statusText} welcome images in ${interaction.guild.name}`);
    } catch (error) {
        logger.error('Error toggling welcome image:', error);
        
        const errorEmbed = createEmbed('error', 'Error', 'Failed to toggle image mode. Please try again.');
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

async function handleTestWelcome(interaction) {
    const guildSettings = await getGuildSettings(interaction.guild.id);

    if (!guildSettings?.welcome_channel || !guildSettings?.welcome_message) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Error', 'Welcome system is not configured. Use `/welcome set` to configure it first.')],
            ephemeral: true
        });
    }

    const welcomeChannel = interaction.guild.channels.cache.get(guildSettings.welcome_channel);
    if (!welcomeChannel) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Error', 'Configured welcome channel no longer exists. Please reconfigure with `/welcome set`.')],
            ephemeral: true
        });
    }

    // Check permissions
    const permissions = welcomeChannel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(['ViewChannel', 'SendMessages'])) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Error', 'I do not have permission to send messages in the configured welcome channel.')],
            ephemeral: true
        });
    }

    try {
        // Test with image if enabled
        if (guildSettings.welcome_image_enabled !== false) {
            try {
                const imageBuffer = await welcomeImage.generateWelcomeImage(interaction.member, guildSettings);
                const attachment = new AttachmentBuilder(imageBuffer, { name: 'test-welcome.png' });

                const testEmbed = createEmbed('info', '🧪 Test Welcome Image', 
                    guildSettings.welcome_message ? 
                    guildSettings.welcome_message.replace('{user}', `<@${interaction.user.id}>`) : 
                    `Welcome to **${interaction.guild.name}**, <@${interaction.user.id}>! 🎉`
                );
                testEmbed.setImage('attachment://test-welcome.png');
                testEmbed.setFooter({ text: 'This is a test message triggered by ' + interaction.user.tag });

                await welcomeChannel.send({ embeds: [testEmbed], files: [attachment] });
            } catch (imageError) {
                logger.warn('Failed to generate test welcome image, using fallback:', imageError);
                
                // Fallback to text-only
                const testMessage = guildSettings.welcome_message.replace('{user}', `<@${interaction.user.id}>`);
                const testEmbed = createEmbed('info', '🧪 Test Welcome Message', testMessage);
                testEmbed.setFooter({ text: 'This is a test message triggered by ' + interaction.user.tag });
                
                await welcomeChannel.send({ embeds: [testEmbed] });
            }
        } else {
            // Text-only welcome
            const testMessage = guildSettings.welcome_message.replace('{user}', `<@${interaction.user.id}>`);
            const testEmbed = createEmbed('info', '🧪 Test Welcome Message', testMessage);
            testEmbed.setFooter({ text: 'This is a test message triggered by ' + interaction.user.tag });
            
            await welcomeChannel.send({ embeds: [testEmbed] });
        }

        const successEmbed = createEmbed('success', 'Test Sent', 
            `Test welcome message has been sent to ${welcomeChannel}!\n\nCheck the channel to see how it looks.`);

        await interaction.reply({ embeds: [successEmbed], ephemeral: true });

        logger.info(`${interaction.user.tag} tested welcome message in ${interaction.guild.name}`);
    } catch (error) {
        logger.error('Error sending test welcome message:', error);
        
        const errorEmbed = createEmbed('error', 'Error', 'Failed to send test message. Please check my permissions in the welcome channel.');
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

async function handleViewSettings(interaction) {
    const guildSettings = await getGuildSettings(interaction.guild.id);

    if (!guildSettings?.welcome_channel || !guildSettings?.welcome_message) {
        return await interaction.reply({
            embeds: [createEmbed('info', 'Welcome System Settings', 
                '**Status:** Disabled\n\nWelcome messages are not currently configured.\n\n**To get started:**\nUse `/welcome set <channel> <message>` to enable welcome messages.\n\n**Example:**\n`/welcome set #welcome Welcome to the server, {user}! Please read the rules.`')],
            ephemeral: true
        });
    }

    const welcomeChannel = interaction.guild.channels.cache.get(guildSettings.welcome_channel);
    const channelText = welcomeChannel ? welcomeChannel.toString() : `#deleted-channel (${guildSettings.welcome_channel})`;

    const embed = createEmbed('info', 'Welcome System Settings', 
        `**Status:** Enabled\n**Channel:** ${channelText}\n**Message:** ${guildSettings.welcome_message}\n\n**Preview:**\n${guildSettings.welcome_message.replace('{user}', interaction.user)}\n\n**Management:**\n• Use \`/welcome test\` to send a test message\n• Use \`/welcome set\` to change settings\n• Use \`/welcome disable\` to disable welcome messages`);

    await interaction.reply({ embeds: [embed], ephemeral: true });
}
