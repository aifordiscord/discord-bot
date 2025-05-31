const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { addModLog } = require('../../database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set or remove slowmode in a channel')
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('Slowmode duration in seconds (0 to disable, max 21600)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for setting slowmode')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

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
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Missing Permissions', 'You need the "Manage Channels" permission to use this command.')],
                    ephemeral: true
                });
            }

            // Check if bot has required permissions
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Bot Missing Permissions', 'I need the "Manage Channels" permission to execute this command.')],
                    ephemeral: true
                });
            }

            const seconds = interaction.options.getInteger('seconds');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            // Set slowmode
            await interaction.channel.setRateLimitPerUser(seconds, `${reason} | Set by ${interaction.user.tag}`);

            // Log the action
            await addModLog(
                interaction.guild.id,
                'channel',
                interaction.user.id,
                'slowmode',
                `${reason} | Channel: ${interaction.channel.name} | Duration: ${seconds}s`
            );

            // Create response message
            let responseMessage;
            if (seconds === 0) {
                responseMessage = `Slowmode has been **disabled** in ${interaction.channel}.`;
            } else {
                const duration = seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
                responseMessage = `Slowmode has been set to **${duration}** in ${interaction.channel}.`;
            }

            const successEmbed = createEmbed('success', 'Slowmode Updated', 
                `${responseMessage}\n\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`);

            await interaction.reply({ embeds: [successEmbed] });

            // Log to mod channel if configured
            const guildSettings = await require('../../database').getGuildSettings(interaction.guild.id);
            if (guildSettings?.mod_log_channel) {
                const logChannel = interaction.guild.channels.cache.get(guildSettings.mod_log_channel);
                if (logChannel) {
                    const logEmbed = createEmbed('info', 'Slowmode Changed', 
                        `**Channel:** ${interaction.channel}\n` +
                        `**Duration:** ${seconds === 0 ? 'Disabled' : `${seconds} seconds`}\n` +
                        `**Reason:** ${reason}\n` +
                        `**Moderator:** ${interaction.user.tag}\n` +
                        `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`
                    );
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

            logger.info(`${interaction.user.tag} set slowmode to ${seconds}s in ${interaction.channel.name} (${interaction.guild.name})`);

        } catch (error) {
            logger.error('Error in slowmode command:', error);
            
            let errorMessage = 'An unexpected error occurred while setting slowmode.';
            
            if (error.code === 50013) {
                errorMessage = 'I do not have permission to manage this channel.';
            } else if (error.message.includes('Missing Permissions')) {
                errorMessage = 'I am missing the required permissions to manage channels.';
            }
            
            const errorEmbed = createEmbed('error', 'Slowmode Failed', errorMessage);
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            }
        }
    }
};