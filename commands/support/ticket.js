const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { createTicket, getUserTickets, getGuildSettings } = require('../../database');
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
            // Check if command is used in a guild
            if (!interaction.guild) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Server Only', 'This command can only be used in a server.')],
                    ephemeral: true
                });
            }

            // Check if bot has required permissions for threads
            if (!interaction.guild.members.me.permissions.has([
                PermissionFlagsBits.ManageThreads,
                PermissionFlagsBits.CreatePrivateThreads,
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages
            ])) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Bot Missing Permissions', 'I need permissions to manage threads, create private threads, view channels, and send messages to create tickets.')],
                    ephemeral: true
                });
            }

            const reason = interaction.options.getString('reason') || 'No reason provided';

            // Validate reason length
            if (reason.length > 200) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Reason Too Long', 'Please keep the reason under 200 characters.')],
                    ephemeral: true
                });
            }
            
            // Check if user already has an open ticket
            const existingTickets = await getUserTickets(interaction.guild.id, interaction.user.id);
            const openTickets = existingTickets.filter(ticket => ticket.status === 'open');
            
            if (openTickets.length > 0) {
                const ticketThread = interaction.guild.channels.cache.get(openTickets[0].channel_id);
                if (ticketThread) {
                    return await interaction.reply({
                        embeds: [createEmbed('error', 'Ticket Already Exists', `You already have an open ticket: ${ticketThread}`)],
                        ephemeral: true
                    });
                }
            }

            // Create private thread in current channel
            const threadName = `ticket-${interaction.user.username}-${Date.now().toString().slice(-4)}`;
            const thread = await interaction.channel.threads.create({
                name: threadName,
                type: 12, // GUILD_PRIVATE_THREAD
                reason: `Support ticket created by ${interaction.user.tag}: ${reason}`
            });

            // Add user to thread
            await thread.members.add(interaction.user.id);

            // Get guild settings for support role
            const guildSettings = await getGuildSettings(interaction.guild.id);
            
            // Add support role members to thread if configured
            if (guildSettings?.ticket_support_role) {
                const supportRole = interaction.guild.roles.cache.get(guildSettings.ticket_support_role);
                if (supportRole) {
                    // Add all online members with the support role to the thread
                    const supportMembers = supportRole.members.filter(member => 
                        member.presence?.status !== 'offline' && !member.user.bot
                    );
                    
                    for (const [, member] of supportMembers) {
                        try {
                            await thread.members.add(member.id);
                        } catch (error) {
                            logger.warn(`Failed to add support member ${member.user.tag} to ticket thread`);
                        }
                    }
                }
            }

            // Save ticket to database
            await createTicket(interaction.guild.id, thread.id, interaction.user.id, reason);

            // Create welcome message in thread
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎫 New Support Ticket')
                .setDescription(
                    `Hello ${interaction.user}! Thank you for creating a support ticket.\n\n` +
                    `**Your Issue:** ${reason}\n\n` +
                    `**Please provide additional details:**\n` +
                    `• What problem are you experiencing?\n` +
                    `• When did this issue start?\n` +
                    `• Have you tried any solutions already?\n\n` +
                    `Our support team has been notified and will assist you soon!`
                )
                .setFooter({ text: `Ticket ID: ${thread.id}` })
                .setTimestamp();

            // Create close button
            const closeButton = new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('🔒 Close Ticket')
                .setStyle(ButtonStyle.Danger);

            const actionRow = new ActionRowBuilder().addComponents(closeButton);

            await thread.send({ 
                content: guildSettings?.ticket_support_role ? `<@&${guildSettings.ticket_support_role}>` : '',
                embeds: [welcomeEmbed], 
                components: [actionRow] 
            });

            // Confirm ticket creation
            await interaction.reply({
                embeds: [createEmbed('success', 'Ticket Created', `Your support ticket has been created: ${thread}\n\nPlease head to the thread to discuss your issue with our support team.`)],
                ephemeral: true
            });

            logger.info(`${interaction.user.tag} created ticket thread ${thread.name} in ${interaction.guild.name} - Reason: ${reason}`);

        } catch (error) {
            logger.error('Error in ticket command:', error);
            
            let errorMessage = 'An unexpected error occurred while creating the ticket.';
            
            if (error.code === 50013) {
                errorMessage = 'I do not have permission to create threads in this channel. Please check my permissions.';
            } else if (error.message.includes('Missing Permissions')) {
                errorMessage = 'I am missing the required permissions to create private threads.';
            } else if (error.message.includes('Database')) {
                errorMessage = 'Database error occurred while saving the ticket. Please try again.';
            }
            
            const errorEmbed = createEmbed('error', 'Ticket Creation Failed', errorMessage);
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            }
        }
    }
};