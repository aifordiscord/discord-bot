const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { createTicket, getUserTickets, getGuildSettings } = require('../../database');
const config = require('../../config');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a support ticket')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Brief description of your issue')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const reason = interaction.options.getString('reason') || 'No reason provided';
            
            // Check if user already has an open ticket
            const existingTickets = await getUserTickets(interaction.guild.id, interaction.user.id);
            const openTickets = existingTickets.filter(ticket => ticket.status === 'open');
            
            if (openTickets.length > 0) {
                const ticketChannel = interaction.guild.channels.cache.get(openTickets[0].channel_id);
                if (ticketChannel) {
                    return await interaction.reply({
                        embeds: [createEmbed('error', 'Ticket Already Exists', `You already have an open ticket: ${ticketChannel}`)],
                        ephemeral: true
                    });
                }
            }

            // Get guild settings for ticket category
            const guildSettings = await getGuildSettings(interaction.guild.id);
            let ticketCategory = null;

            // Find or create ticket category
            if (guildSettings?.ticket_category) {
                ticketCategory = interaction.guild.channels.cache.get(guildSettings.ticket_category);
            }
            
            if (!ticketCategory) {
                // Try to find by name
                ticketCategory = interaction.guild.channels.cache.find(
                    channel => channel.name.toLowerCase() === config.tickets.categoryName.toLowerCase() && 
                              channel.type === ChannelType.GuildCategory
                );
                
                // Create category if it doesn't exist
                if (!ticketCategory) {
                    try {
                        ticketCategory = await interaction.guild.channels.create({
                            name: config.tickets.categoryName,
                            type: ChannelType.GuildCategory,
                            permissionOverwrites: [
                                {
                                    id: interaction.guild.roles.everyone,
                                    deny: [PermissionFlagsBits.ViewChannel]
                                }
                            ]
                        });
                    } catch (error) {
                        logger.error('Failed to create ticket category:', error);
                        return await interaction.reply({
                            embeds: [createEmbed('error', 'Error', 'Failed to create ticket category. Please check my permissions.')],
                            ephemeral: true
                        });
                    }
                }
            }

            // Find support role
            let supportRole = null;
            if (guildSettings?.support_role) {
                supportRole = interaction.guild.roles.cache.get(guildSettings.support_role);
            }
            
            if (!supportRole) {
                supportRole = interaction.guild.roles.cache.find(role => 
                    role.name.toLowerCase() === config.tickets.supportRoleName.toLowerCase()
                );
            }

            // Create ticket channel
            const ticketNumber = Date.now().toString().slice(-6);
            const channelName = `ticket-${interaction.user.username}-${ticketNumber}`;
            
            const permissionOverwrites = [
                {
                    id: interaction.guild.roles.everyone,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles
                    ]
                },
                {
                    id: interaction.client.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ManageChannels,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                }
            ];

            if (supportRole) {
                permissionOverwrites.push({
                    id: supportRole.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles
                    ]
                });
            }

            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: ticketCategory.id,
                permissionOverwrites
            });

            // Add ticket to database
            await createTicket(interaction.guild.id, ticketChannel.id, interaction.user.id, reason);

            // Create welcome message in ticket channel
            const welcomeEmbed = createEmbed('info', 'Support Ticket Created', 
                `Hello ${interaction.user}! Thank you for creating a support ticket.\n\n**Reason:** ${reason}\n\nOur support team will be with you shortly. Please describe your issue in detail and provide any relevant information.\n\nTo close this ticket, use the \`/close\` command.`);

            await ticketChannel.send({ 
                content: supportRole ? `${supportRole}` : null,
                embeds: [welcomeEmbed] 
            });

            // Reply to user
            const successEmbed = createEmbed('success', 'Ticket Created', 
                `Your support ticket has been created: ${ticketChannel}\n\nPlease head over to your ticket channel to continue.`);

            await interaction.reply({ embeds: [successEmbed], ephemeral: true });

            // Log to ticket log channel if configured
            if (guildSettings?.ticket_log_channel) {
                const logChannel = interaction.guild.channels.cache.get(guildSettings.ticket_log_channel);
                if (logChannel) {
                    const logEmbed = createEmbed('info', 'Ticket Created', 
                        `**User:** ${interaction.user.tag} (${interaction.user.id})\n**Channel:** ${ticketChannel}\n**Reason:** ${reason}\n**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`);
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

            logger.info(`${interaction.user.tag} created ticket ${ticketChannel.name} in ${interaction.guild.name}`);

        } catch (error) {
            logger.error('Error in ticket command:', error);
            
            const errorEmbed = createEmbed('error', 'Error', 'An error occurred while creating your ticket. Please try again or contact an administrator.');
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};
