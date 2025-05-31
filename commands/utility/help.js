const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get help and information about bot commands')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Select a command category')
                .setRequired(false)
                .addChoices(
                    { name: 'Moderation', value: 'moderation' },
                    { name: 'Support', value: 'support' },
                    { name: 'Utility', value: 'utility' },
                    { name: 'Admin', value: 'admin' }
                )),

    async execute(interaction) {
        const category = interaction.options.getString('category');

        if (category) {
            await sendCategoryHelp(interaction, category);
        } else {
            await sendMainHelp(interaction);
        }
    }
};

async function sendMainHelp(interaction) {
    const embed = createEmbed('info', '📚 Bot Help Center', 
        `Welcome to the support bot help center! Select a category below to see available commands.\n\n**Available Categories:**\n🔨 **Moderation** - Moderation tools and commands\n🎫 **Support** - Ticket system and support features\n🔧 **Utility** - General utility commands\n⚙️ **Admin** - Administrative configuration commands\n\n**Quick Start:**\n• Use \`/ticket\` to create a support ticket\n• Use \`/faq\` to view frequently asked questions\n• Staff can use moderation commands like \`/warn\`, \`/mute\`, \`/kick\`, \`/ban\`\n\n**Need Help?**\nIf you need assistance, create a ticket and our support team will help you!`);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder('Choose a category to explore...')
        .addOptions([
            {
                label: 'Moderation',
                description: 'Commands for server moderation',
                value: 'moderation',
                emoji: '🔨'
            },
            {
                label: 'Support',
                description: 'Ticket system and support features',
                value: 'support',
                emoji: '🎫'
            },
            {
                label: 'Utility',
                description: 'General utility commands',
                value: 'utility',
                emoji: '🔧'
            },
            {
                label: 'Admin',
                description: 'Administrative configuration',
                value: 'admin',
                emoji: '⚙️'
            }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: 64 // MessageFlags.Ephemeral
    });
}

async function sendCategoryHelp(interaction, category) {
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

    await interaction.reply({ embeds: [embed], flags: 64 });
}