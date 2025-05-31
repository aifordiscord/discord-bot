const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { getGuildSettings, updateGuildSettings } = require('../../database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup various bot features')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ticket')
                .setDescription('Setup ticket system with button')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel where the ticket embed will be sent')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Custom message for the ticket embed')
                        .setRequired(false))
                .addRoleOption(option =>
                    option.setName('support_role')
                        .setDescription('Role that will be pinged when tickets are created')
                        .setRequired(false)))
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

            // Check if bot has required permissions
            if (!interaction.guild.members.me.permissions.has([
                PermissionFlagsBits.ManageThreads,
                PermissionFlagsBits.CreatePrivateThreads,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.EmbedLinks
            ])) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Bot Missing Permissions', 'I need permissions to manage threads, create private threads, send messages, view channels, and embed links.')],
                    ephemeral: true
                });
            }

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'ticket') {
                await handleTicketSetup(interaction);
            }

        } catch (error) {
            logger.error('Error in setup command:', error);
            
            let errorMessage = 'An unexpected error occurred while setting up the feature.';
            
            if (error.code === 50013) {
                errorMessage = 'I do not have permission to perform this setup. Please check my permissions.';
            } else if (error.message.includes('Missing Permissions')) {
                errorMessage = 'I am missing the required permissions for this setup.';
            } else if (error.message.includes('Database')) {
                errorMessage = 'Database error occurred while saving settings. Please try again.';
            }
            
            const errorEmbed = createEmbed('error', 'Setup Failed', errorMessage);
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            }
        }
    }
};

async function handleTicketSetup(interaction) {
    const channel = interaction.options.getChannel('channel');
    const customMessage = interaction.options.getString('message');
    const supportRole = interaction.options.getRole('support_role');

    // Check bot permissions in the target channel
    const permissions = channel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Channel Permissions', 'I need View Channel, Send Messages, and Embed Links permissions in the target channel.')],
            ephemeral: true
        });
    }

    // Save ticket settings to database
    const currentSettings = await getGuildSettings(interaction.guild.id) || {};
    await updateGuildSettings(interaction.guild.id, {
        ...currentSettings,
        ticket_channel: channel.id,
        ticket_message: customMessage,
        ticket_support_role: supportRole?.id || null
    });

    // Create ticket embed
    const ticketEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎫 Support Tickets')
        .setDescription(
            customMessage || 
            `Need help? Create a support ticket by clicking the button below!\n\n` +
            `**What happens next:**\n` +
            `• A private thread will be created for you\n` +
            `• Our support team will be notified\n` +
            `• You can discuss your issue privately\n\n` +
            `**Before creating a ticket:**\n` +
            `• Check our FAQ for common questions\n` +
            `• Make sure your issue hasn't been resolved\n` +
            `• Be ready to provide details about your problem`
        )
        .setFooter({ 
            text: `${interaction.guild.name} Support System`, 
            iconURL: interaction.guild.iconURL({ dynamic: true }) 
        })
        .setTimestamp();

    // Create button
    const button = new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('📩 Create Ticket')
        .setStyle(ButtonStyle.Primary);

    const actionRow = new ActionRowBuilder().addComponents(button);

    try {
        // Send the ticket embed to the specified channel
        await channel.send({ 
            embeds: [ticketEmbed], 
            components: [actionRow] 
        });

        // Confirm setup completion
        const successEmbed = createEmbed('success', 'Ticket System Setup Complete', 
            `Ticket system has been successfully setup!\n\n` +
            `**Channel:** ${channel}\n` +
            `${supportRole ? `**Support Role:** ${supportRole}\n` : ''}` +
            `**Features:**\n` +
            `• Private thread creation\n` +
            `• Automatic support notifications\n` +
            `• Organized ticket management\n\n` +
            `Users can now click the button in ${channel} to create support tickets.`
        );

        await interaction.reply({ embeds: [successEmbed], ephemeral: true });

        logger.info(`${interaction.user.tag} setup ticket system in ${channel.name} (${interaction.guild.name})`);

    } catch (error) {
        logger.error('Error sending ticket embed:', error);
        
        const errorEmbed = createEmbed('error', 'Setup Failed', 
            'Failed to send the ticket embed to the specified channel. Please check my permissions and try again.');
        
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}