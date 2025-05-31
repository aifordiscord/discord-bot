const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { getTicket, closeTicket, getGuildSettings } = require('../../database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('Close a support ticket')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for closing the ticket')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const reason = interaction.options.getString('reason') || 'No reason provided';

            // Check if this is a ticket channel
            const ticket = await getTicket(interaction.channel.id);
            
            if (!ticket) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Error', 'This command can only be used in ticket channels.')],
                    ephemeral: true
                });
            }

            // Check permissions - ticket owner or staff can close
            const isTicketOwner = ticket.user_id === interaction.user.id;
            const hasPermissions = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

            if (!isTicketOwner && !hasPermissions) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Error', 'You can only close your own tickets or you need Manage Channels permission.')],
                    ephemeral: true
                });
            }

            await interaction.deferReply();

            // Create transcript
            let transcript = '';
            try {
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                
                transcript = `Ticket Transcript - ${interaction.channel.name}\n`;
                transcript += `Closed by: ${interaction.user.tag} (${interaction.user.id})\n`;
                transcript += `Closed at: ${new Date().toISOString()}\n`;
                transcript += `Reason: ${reason}\n`;
                transcript += '=' + '='.repeat(50) + '\n\n';

                sortedMessages.forEach(message => {
                    const timestamp = message.createdAt.toISOString();
                    const author = `${message.author.tag} (${message.author.id})`;
                    const content = message.content || '[No text content]';
                    
                    transcript += `[${timestamp}] ${author}: ${content}\n`;
                    
                    if (message.attachments.size > 0) {
                        message.attachments.forEach(attachment => {
                            transcript += `  📎 Attachment: ${attachment.name} (${attachment.url})\n`;
                        });
                    }
                    
                    if (message.embeds.length > 0) {
                        transcript += `  📋 Embed content present\n`;
                    }
                    
                    transcript += '\n';
                });
            } catch (error) {
                logger.error('Error creating transcript:', error);
                transcript = 'Error creating transcript';
            }

            // Create transcript file
            const transcriptBuffer = Buffer.from(transcript, 'utf-8');
            const transcriptAttachment = new AttachmentBuilder(transcriptBuffer, {
                name: `ticket-${interaction.channel.name}-transcript.txt`
            });

            // Update database
            await closeTicket(interaction.channel.id, interaction.user.id, reason);

            // Send closing message
            const closingEmbed = createEmbed('warning', 'Ticket Closing', 
                `This ticket is being closed by ${interaction.user}.\n\n**Reason:** ${reason}\n\nThe channel will be deleted in 10 seconds. A transcript has been saved.`);

            await interaction.editReply({ embeds: [closingEmbed] });

            // Send transcript to ticket owner if possible
            try {
                const ticketOwner = await interaction.client.users.fetch(ticket.user_id);
                const dmEmbed = createEmbed('info', 'Ticket Closed', 
                    `Your ticket in **${interaction.guild.name}** has been closed.\n\n**Reason:** ${reason}\n**Closed by:** ${interaction.user.tag}\n\nPlease find the transcript attached.`);
                
                await ticketOwner.send({ 
                    embeds: [dmEmbed], 
                    files: [transcriptAttachment] 
                });
            } catch (error) {
                logger.warn(`Could not send transcript to ticket owner: ${error.message}`);
            }

            // Send to ticket log channel if configured
            const guildSettings = await getGuildSettings(interaction.guild.id);
            if (guildSettings?.ticket_log_channel) {
                const logChannel = interaction.guild.channels.cache.get(guildSettings.ticket_log_channel);
                if (logChannel) {
                    const logEmbed = createEmbed('warning', 'Ticket Closed', 
                        `**Ticket:** ${interaction.channel.name}\n**Owner:** <@${ticket.user_id}> (${ticket.user_id})\n**Closed by:** ${interaction.user.tag} (${interaction.user.id})\n**Reason:** ${reason}\n**Opened:** <t:${Math.floor(new Date(ticket.created_at).getTime() / 1000)}:F>\n**Closed:** <t:${Math.floor(Date.now() / 1000)}:F>`);
                    
                    await logChannel.send({ 
                        embeds: [logEmbed], 
                        files: [transcriptAttachment] 
                    });
                }
            }

            logger.info(`${interaction.user.tag} closed ticket ${interaction.channel.name} in ${interaction.guild.name}`);

            // Delete channel after delay
            setTimeout(async () => {
                try {
                    await interaction.channel.delete('Ticket closed');
                } catch (error) {
                    logger.error('Error deleting ticket channel:', error);
                }
            }, 10000);

        } catch (error) {
            logger.error('Error in close command:', error);
            
            const errorEmbed = createEmbed('error', 'Error', 'An error occurred while closing the ticket. Please try again or contact an administrator.');
            
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};
