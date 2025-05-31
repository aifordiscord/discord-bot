const { createEmbed } = require('../utils/embed');
const { checkPermissions } = require('../utils/permissions');
const config = require('../config');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            await handleSlashCommand(interaction);
        }
        
        // Handle select menu interactions
        if (interaction.isStringSelectMenu()) {
            await handleSelectMenu(interaction);
        }
        
        // Handle button interactions
        if (interaction.isButton()) {
            await handleButton(interaction);
        }
    }
};

async function handleSlashCommand(interaction) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        logger.error(`No command matching ${interaction.commandName} was found.`);
        await interaction.reply({
            content: 'This command is not available or has been removed.',
            ephemeral: true
        }).catch(console.error);
        return;
    }

    // Check rate limiting
    if (!checkRateLimit(interaction)) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Rate Limited', 'You are sending commands too quickly. Please wait a moment and try again.')],
            ephemeral: true
        });
    }

    // Check permissions
    if (!checkPermissions(interaction, command)) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Permission Denied', 'You do not have permission to use this command.')],
            ephemeral: true
        });
    }

    try {
        await command.execute(interaction);
        logger.info(`${interaction.user.tag} used /${interaction.commandName} in ${interaction.guild?.name || 'DM'}`);
    } catch (error) {
        logger.error(`Error executing ${interaction.commandName}:`, error);
        
        const errorEmbed = createEmbed('error', 'Command Error', 
            'There was an error while executing this command! Please try again later or contact an administrator if the problem persists.');

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
        }
    }
}

async function handleSelectMenu(interaction) {
    try {
        if (interaction.customId === 'help_category_dynamic') {
            const selection = interaction.values[0];
            await handleDynamicHelpSelection(interaction, selection);
        } else if (interaction.customId === 'help_category_select') {
            const category = interaction.values[0];
            await sendCategoryHelpForSelectMenu(interaction, category);
        } else if (interaction.customId === 'faq_select') {
            const topic = interaction.values[0];
            await sendFAQForSelectMenu(interaction, topic);
        }
    } catch (error) {
        logger.error('Error handling select menu interaction:', error);
        
        const errorEmbed = createEmbed('error', 'Error', 'An error occurred while processing your selection.');
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
        }
    }
}

async function sendCategoryHelpForSelectMenu(interaction, category) {
    const config = require('../config');
    let embed;

    switch (category) {
        case 'moderation':
            embed = createEmbed('info', '🔨 Moderation Commands', 
                `**Available Moderation Commands:**\n\n\`/ban <user> [reason] [delete_days]\`\n• Ban a user from the server\n• Optionally delete their recent messages\n• Requires: Ban Members permission\n\n\`/kick <user> [reason]\`\n• Kick a user from the server\n• Requires: Kick Members permission\n\n\`/mute <user> [duration] [reason]\`\n• Timeout a user (prevents them from sending messages)\n• Duration format: 1h, 30m, 1d (max 28 days)\n• Requires: Moderate Members permission\n\n\`/unmute <user> [reason]\`\n• Remove timeout from a user\n• Requires: Moderate Members permission\n\n\`/warn <user> <reason>\`\n• Issue a warning to a user\n• Auto-punishment after ${config.moderation.maxWarnings} warnings\n• Requires: Moderate Members permission\n\n**Features:**\n• All actions are logged to the mod log channel\n• Users receive DM notifications when possible\n• Role hierarchy is respected\n• Automatic punishments for repeated violations`);
            break;

        case 'support':
            embed = createEmbed('info', '🎫 Support Commands', 
                `**Available Support Commands:**\n\n\`/ticket [reason]\`\n• Create a new support ticket\n• Opens a private channel for you and support staff\n• Provide a reason to help staff understand your issue\n\n\`/close [reason]\`\n• Close your support ticket\n• Can only be used in ticket channels\n• Creates a transcript that's saved and sent to you\n• Can be used by ticket owner or staff\n\n**Ticket System Features:**\n• Private channels for each ticket\n• Automatic transcript generation\n• Support team notifications\n• Ticket logging and history\n• Only one open ticket per user\n\n**Getting Support:**\n1. Use \`/ticket\` to create a ticket\n2. Describe your issue in the ticket channel\n3. Wait for support team response\n4. Use \`/close\` when your issue is resolved`);
            break;

        case 'utility':
            embed = createEmbed('info', '🔧 Utility Commands', 
                `**Available Utility Commands:**\n\n\`/help [category]\`\n• Show this help message\n• Optionally specify a category for detailed info\n\n\`/faq [topic]\`\n• View frequently asked questions\n• Shows all FAQs or specific topic\n• Topics: ${Object.keys(config.faq).map(key => \`\`${key}\`\`).join(', ')}\n\n**General Features:**\n• User-friendly error messages\n• Comprehensive help system\n• FAQ system for common questions\n• Slash command interface\n\n**Bot Information:**\n• Built with Discord.js v14\n• Modular command system\n• Comprehensive logging\n• Multi-server support`);
            break;

        case 'admin':
            embed = createEmbed('info', '⚙️ Admin Commands', 
                `**Available Admin Commands:**\n\n\`/autorole <action> [role]\`\n• Configure automatic role assignment\n• Actions: \`add\`, \`remove\`, \`list\`\n• Automatically assigns roles to new members\n• Requires: Manage Roles permission\n\n\`/welcome <action> [channel] [message]\`\n• Configure welcome message system\n• Actions: \`set\`, \`disable\`, \`test\`\n• Customize welcome messages for new members\n• Use \`{user}\` placeholder for mentions\n• Requires: Manage Guild permission\n\n**Configuration Features:**\n• Persistent settings stored in database\n• Per-server configuration\n• Real-time updates\n• Easy setup and management\n\n**Required Permissions:**\n• Bot needs appropriate permissions for each feature\n• Admin commands require elevated permissions\n• Settings are saved automatically`);
            break;

        default:
            embed = createEmbed('error', 'Error', 'Invalid category specified.');
            break;
    }

    await interaction.update({ embeds: [embed], components: [], ephemeral: true });
}

async function sendFAQForSelectMenu(interaction, topic) {
    const config = require('../config');
    const faqEntry = config.faq[topic];
    
    if (!faqEntry) {
        const embed = createEmbed('error', 'Error', 'FAQ topic not found.');
        await interaction.update({ embeds: [embed], components: [], ephemeral: true });
        return;
    }

    const embed = createEmbed('info', '❓ ' + faqEntry.question, faqEntry.answer);
    await interaction.update({ embeds: [embed], components: [], ephemeral: true });
}

async function handleButton(interaction) {
    try {
        if (interaction.customId === 'create_ticket') {
            await handleCreateTicket(interaction);
        } else if (interaction.customId === 'close_ticket') {
            await handleCloseTicket(interaction);
        } else {
            logger.info(`Unknown button interaction: ${interaction.customId} by ${interaction.user.tag}`);
        }
    } catch (error) {
        logger.error('Error handling button interaction:', error);
        
        const errorEmbed = createEmbed('error', 'Error', 'An error occurred while processing your button click.');
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
        }
    }
}

async function handleCreateTicket(interaction) {
    const { createTicket, getUserTickets } = require('../database');
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
    
    try {
        // Check if user already has an open ticket
        const existingTickets = await getUserTickets(interaction.guild.id, interaction.user.id);
        const openTickets = existingTickets.filter(ticket => ticket.status === 'open');
        
        if (openTickets.length > 0) {
            // Find the thread
            const existingThread = interaction.guild.channels.cache.get(openTickets[0].channel_id);
            if (existingThread) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Ticket Already Exists', `You already have an open ticket: ${existingThread}`)],
                    ephemeral: true
                });
            }
        }

        // Create private thread
        const threadName = `ticket-${interaction.user.username}-${Date.now().toString().slice(-4)}`;
        const thread = await interaction.channel.threads.create({
            name: threadName,
            type: 12, // GUILD_PRIVATE_THREAD
            reason: `Support ticket created by ${interaction.user.tag}`
        });

        // Add user to thread
        await thread.members.add(interaction.user.id);

        // Get guild settings for support role
        const guildSettings = await require('../database').getGuildSettings(interaction.guild.id);
        
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
        await createTicket(interaction.guild.id, thread.id, interaction.user.id, 'Ticket created via button');

        // Create welcome message in thread
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎫 New Support Ticket')
            .setDescription(
                `Hello ${interaction.user}! Thank you for creating a support ticket.\n\n` +
                `**Please describe your issue in detail:**\n` +
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
            embeds: [createEmbed('success', 'Ticket Created', `Your support ticket has been created: ${thread}`)],
            ephemeral: true
        });

        logger.info(`${interaction.user.tag} created ticket thread ${thread.name} in ${interaction.guild.name}`);

    } catch (error) {
        logger.error('Error creating ticket thread:', error);
        
        let errorMessage = 'Failed to create ticket. Please try again or contact an administrator.';
        
        if (error.code === 50013) {
            errorMessage = 'I do not have permission to create threads in this channel.';
        } else if (error.message.includes('Missing Permissions')) {
            errorMessage = 'I am missing the required permissions to create private threads.';
        }
        
        await interaction.reply({
            embeds: [createEmbed('error', 'Ticket Creation Failed', errorMessage)],
            ephemeral: true
        });
    }
}

async function handleCloseTicket(interaction) {
    const { closeTicket, getTicket } = require('../database');
    
    try {
        // Check if this is a ticket thread
        const ticket = await getTicket(interaction.channel.id);
        
        if (!ticket) {
            return await interaction.reply({
                embeds: [createEmbed('error', 'Not a Ticket', 'This command can only be used in ticket threads.')],
                ephemeral: true
            });
        }

        if (ticket.status === 'closed') {
            return await interaction.reply({
                embeds: [createEmbed('error', 'Already Closed', 'This ticket is already closed.')],
                ephemeral: true
            });
        }

        // Check if user can close the ticket (ticket owner or staff)
        const canClose = ticket.user_id === interaction.user.id || 
                        interaction.member.permissions.has('ModerateMembers') ||
                        interaction.member.permissions.has('ManageThreads');

        if (!canClose) {
            return await interaction.reply({
                embeds: [createEmbed('error', 'Permission Denied', 'You can only close your own tickets or you need moderation permissions.')],
                ephemeral: true
            });
        }

        // Close ticket in database
        await closeTicket(interaction.channel.id, interaction.user.id, 'Ticket closed via button');

        // Send closing message
        const closeEmbed = createEmbed('warning', 'Ticket Closed', 
            `This ticket has been closed by ${interaction.user}.\n\n` +
            `**Closed at:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
            `This thread will be archived automatically.`
        );

        await interaction.reply({ embeds: [closeEmbed] });

        // Archive and lock the thread
        setTimeout(async () => {
            try {
                await interaction.channel.setArchived(true);
                await interaction.channel.setLocked(true);
            } catch (error) {
                logger.warn(`Failed to archive ticket thread ${interaction.channel.name}:`, error);
            }
        }, 5000); // 5 second delay

        logger.info(`${interaction.user.tag} closed ticket ${interaction.channel.name} in ${interaction.guild.name}`);

    } catch (error) {
        logger.error('Error closing ticket:', error);
        
        const errorEmbed = createEmbed('error', 'Close Failed', 'Failed to close the ticket. Please try again.');
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
        }
    }
}

function checkRateLimit(interaction) {
    const userId = interaction.user.id;
    const now = Date.now();
    const cooldownAmount = config.rateLimits.interval;

    if (!interaction.client.cooldowns.has(userId)) {
        interaction.client.cooldowns.set(userId, []);
    }

    const userCooldowns = interaction.client.cooldowns.get(userId);
    
    // Remove expired cooldowns
    while (userCooldowns.length > 0 && userCooldowns[0] <= now - cooldownAmount) {
        userCooldowns.shift();
    }

    // Check if user has exceeded rate limit
    if (userCooldowns.length >= config.rateLimits.commands) {
        return false;
    }

    // Add current command to cooldowns
    userCooldowns.push(now);
    return true;
}

async function handleDynamicHelpSelection(interaction, selection) {
    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
    
    const commands = interaction.client.commands;
    
    if (selection === 'back_to_main') {
        // Return to main help menu
        await sendMainHelpForUpdate(interaction);
        return;
    }
    
    if (selection === 'overview') {
        // Show all commands overview
        const categories = {};
        
        commands.forEach(command => {
            let category = determineCommandCategory(command.data.name);
            
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(command);
        });

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📋 All Commands Overview')
            .setDescription('Here are all available commands organized by category:')
            .setTimestamp();

        Object.entries(categories).forEach(([categoryName, commandList]) => {
            const categoryIcon = getCategoryIcon(categoryName);
            const commandNames = commandList.map(cmd => `\`/${cmd.data.name}\``).join(', ');
            
            embed.addFields({
                name: `${categoryIcon} ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} (${commandList.length})`,
                value: commandNames || 'No commands',
                inline: false
            });
        });

        // Add back button
        const backMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category_dynamic')
            .setPlaceholder('🔙 Go back to main help menu...')
            .addOptions({
                label: 'Back to Help Menu',
                description: 'Return to the main help menu',
                value: 'back_to_main',
                emoji: '🔙'
            });

        const actionRow = new ActionRowBuilder().addComponents(backMenu);
        
        await interaction.update({ embeds: [embed], components: [actionRow] });
        
    } else {
        // Show specific category
        const categoryCommands = [];
        
        commands.forEach(command => {
            const category = determineCommandCategory(command.data.name);
            
            if (category === selection) {
                categoryCommands.push(command);
            }
        });

        const categoryIcon = getCategoryIcon(selection);
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`${categoryIcon} ${selection.charAt(0).toUpperCase() + selection.slice(1)} Commands`)
            .setDescription(`Detailed information about ${selection} commands:`)
            .setTimestamp();

        if (categoryCommands.length === 0) {
            embed.setDescription(`No commands found in the ${selection} category.`);
        } else {
            categoryCommands.forEach((command, index) => {
                const options = command.data.options || [];
                let optionsText = '';
                
                if (options.length > 0) {
                    optionsText = '\n**Options:**\n' + options.map(opt => 
                        `• \`${opt.name}\` ${opt.required ? '(required)' : '(optional)'} - ${opt.description}`
                    ).join('\n');
                }

                // Discord embeds have a limit of 25 fields
                if (index < 25) {
                    embed.addFields({
                        name: `/${command.data.name}`,
                        value: `${command.data.description}${optionsText}`,
                        inline: false
                    });
                }
            });
            
            // If there are more than 25 commands, add a note
            if (categoryCommands.length > 25) {
                embed.setFooter({ 
                    text: `Showing first 25 of ${categoryCommands.length} commands in this category` 
                });
            }
        }

        // Add back button
        const backMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category_dynamic')
            .setPlaceholder('🔙 Go back to main help menu...')
            .addOptions({
                label: 'Back to Help Menu',
                description: 'Return to the main help menu',
                value: 'back_to_main',
                emoji: '🔙'
            });

        const actionRow = new ActionRowBuilder().addComponents(backMenu);
        
        await interaction.update({ embeds: [embed], components: [actionRow] });
    }
}

function determineCommandCategory(commandName) {
    try {
        // Define the path to commands directory
        const commandsPath = path.join(__dirname, '..', '..');
        const categoryFolders = ['moderation', 'admin', 'support', 'utility'];
        
        for (const folder of categoryFolders) {
            const folderPath = path.join(commandsPath, 'commands', folder);
            
            // Check if the folder exists and contains the command file
            if (fs.existsSync(folderPath)) {
                const files = fs.readdirSync(folderPath);
                if (files.some(file => file === `${commandName}.js`)) {
                    return folder;
                }
            }
        }
        
        // Default fallback
        return 'utility';
    } catch (error) {
        console.warn(`Could not determine category for command ${commandName}:`, error);
        return 'utility';
    }
}

function getCategoryIcon(category) {
    const icons = {
        'moderation': '🔨',
        'admin': '⚙️',
        'support': '🎫',
        'utility': '🔧',
        'fun': '🎮',
        'music': '🎵',
        'economy': '💰',
        'games': '🎯'
    };
    return icons[category.toLowerCase()] || '📁';
}

async function sendMainHelpForUpdate(interaction) {
    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
    
    const commands = interaction.client.commands;
    
    // Organize commands by category
    const categories = {};
    const categoryStats = {};
    
    commands.forEach(command => {
        const category = determineCommandCategory(command.data.name);
        
        if (!categories[category]) {
            categories[category] = [];
            categoryStats[category] = 0;
        }
        
        categories[category].push(command);
        categoryStats[category]++;
    });

    // Create main help embed
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 Bot Help Center')
        .setDescription(
            `Welcome to the help center! I have **${commands.size}** commands across **${Object.keys(categories).length}** categories.\n\n` +
            `**Quick Stats:**\n` +
            Object.entries(categoryStats).map(([cat, count]) => 
                `• **${cat.charAt(0).toUpperCase() + cat.slice(1)}**: ${count} commands`
            ).join('\n') +
            `\n\n**Select a category below to view detailed command information:**`
        )
        .setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ 
            text: `Use the dropdown below to explore commands • Requested by ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        })
        .setTimestamp();

    // Create dynamic dropdown menu
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category_dynamic')
        .setPlaceholder('📂 Select a category to view commands...')
        .setMinValues(1)
        .setMaxValues(1);

    // Add options for each category
    Object.entries(categories).forEach(([categoryName, commandList]) => {
        const categoryIcon = getCategoryIcon(categoryName);
        const categoryDescription = getCategoryDescription(categoryName, commandList.length);
        
        selectMenu.addOptions({
            label: `${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} Commands`,
            description: categoryDescription,
            value: categoryName,
            emoji: categoryIcon
        });
    });

    // Add overview option
    selectMenu.addOptions({
        label: 'Command Overview',
        description: 'View all commands in a compact format',
        value: 'overview',
        emoji: '📋'
    });

    const actionRow = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.update({ 
        embeds: [embed], 
        components: [actionRow]
    });
}

function getCategoryDescription(category, commandCount) {
    const descriptions = {
        'moderation': `${commandCount} commands for server moderation`,
        'admin': `${commandCount} commands for server administration`,
        'support': `${commandCount} commands for user support`,
        'utility': `${commandCount} commands for general utilities`,
        'fun': `${commandCount} commands for entertainment`,
        'music': `${commandCount} commands for music playback`,
        'economy': `${commandCount} commands for economy features`,
        'games': `${commandCount} commands for games`
    };
    return descriptions[category.toLowerCase()] || `${commandCount} commands in this category`;
                                                                  }
