const { createEmbed } = require('../utils/embed');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        // Ignore messages from bots
        if (message.author.bot) return;

        // Ignore messages outside of guilds (DMs)
        if (!message.guild) return;

        try {
            // Handle prefix commands (fallback/legacy support)
            if (message.content.startsWith(config.prefix)) {
                await handlePrefixCommand(message);
            }

            // Log message for potential moderation (optional)
            // This is where you could add auto-moderation features
            
        } catch (error) {
            logger.error('Error in messageCreate event:', error);
        }
    }
};

async function handlePrefixCommand(message) {
    // Extract command and arguments
    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Basic help command for prefix
    if (commandName === 'help') {
        const embed = createEmbed('info', 'Bot Commands', 
            'This bot primarily uses slash commands for better functionality and security.\n\n**How to use slash commands:**\n• Type `/` in the message box\n• Select a command from the list\n• Fill in the required parameters\n\n**Available Commands:**\n• `/help` - Show detailed help\n• `/ticket` - Create a support ticket\n• `/faq` - View frequently asked questions\n\n**Staff Commands:**\n• `/ban`, `/kick`, `/mute`, `/warn` - Moderation\n• `/autorole`, `/welcome` - Server configuration\n\n**Need Help?**\nUse `/ticket` to create a support ticket and our team will assist you!');

        try {
            await message.reply({ embeds: [embed] });
        } catch (error) {
            logger.error('Error sending prefix help message:', error);
        }
        return;
    }

    // Inform users about slash commands
    if (['ticket', 'help', 'faq', 'ban', 'kick', 'mute', 'warn', 'autorole', 'welcome'].includes(commandName)) {
        const embed = createEmbed('info', 'Use Slash Commands', 
            `Please use the slash command version: \`/${commandName}\`\n\nSlash commands provide better functionality, validation, and security.`);

        try {
            await message.reply({ embeds: [embed] });
        } catch (error) {
            logger.error('Error sending slash command reminder:', error);
        }
    }
}
