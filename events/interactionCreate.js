const { createEmbed } = require('../utils/embed');
const { checkPermissions } = require('../utils/permissions');
const config = require('../config');
const logger = require('../utils/logger');

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
        if (interaction.customId === 'help_category_select') {
            const category = interaction.values[0];
            
            // Handle category help directly
            await sendCategoryHelpForSelectMenu(interaction, category);
        } else if (interaction.customId === 'faq_select') {
            const topic = interaction.values[0];
            
            // Handle FAQ selection directly
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
                `**Available Utility Commands:**\n\n\`/help [category]\`\n• Show this help message\n• Optionally specify a category for detailed info\n\n\`/faq [topic]\`\n• View frequently asked questions\n• Shows all FAQs or specific topic\n• Topics: ${Object.keys(config.faq).map(key => `\`${key}\``).join(', ')}\n\n**General Features:**\n• User-friendly error messages\n• Comprehensive help system\n• FAQ system for common questions\n• Slash command interface\n\n**Bot Information:**\n• Built with Discord.js v14\n• Modular command system\n• Comprehensive logging\n• Multi-server support`);
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
        // Handle any button interactions here
        // For now, we don't have any button interactions, but this is where they would go
        logger.info(`Button interaction: ${interaction.customId} by ${interaction.user.tag}`);
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
