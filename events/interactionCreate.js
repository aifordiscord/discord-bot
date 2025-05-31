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
            
            // Import the help command's category function
            const helpCommand = interaction.client.commands.get('help');
            if (helpCommand) {
                // Create a mock interaction for the category help
                const mockInteraction = {
                    ...interaction,
                    options: {
                        getString: () => category
                    }
                };
                
                await helpCommand.execute(mockInteraction);
            }
        } else if (interaction.customId === 'faq_select') {
            const topic = interaction.values[0];
            
            // Import the FAQ command's specific function
            const faqCommand = interaction.client.commands.get('faq');
            if (faqCommand) {
                const mockInteraction = {
                    ...interaction,
                    options: {
                        getString: () => topic
                    }
                };
                
                await faqCommand.execute(mockInteraction);
            }
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
