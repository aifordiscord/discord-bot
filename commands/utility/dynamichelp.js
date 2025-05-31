const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const logger = require('../../utils/logger');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get help and information about bot commands'),

    async execute(interaction) {
        try {
            await sendMainHelp(interaction);
        } catch (error) {
            logger.error('Error in help command:', error);
            
            const errorEmbed = createEmbed('error', 'Command Failed', 'An unexpected error occurred while loading help information.');
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            }
        }
    }
};

async function sendMainHelp(interaction) {
    // Get all commands from the client
    const commands = interaction.client.commands;
    
    // Organize commands by category (folder name)
    const categories = {};
    const categoryStats = {};
    
    commands.forEach(command => {
        // Extract category from the command file path or use a default
        let category = 'utility'; // default category
        
        // Try to determine category from command structure
        if (command.category) {
            category = command.category;
        } else {
            // Try to extract from file path if available
            category = determineCommandCategory(command.data.name);
        }
        
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

    await interaction.reply({ 
        embeds: [embed], 
        components: [actionRow],
        ephemeral: false
    });

    logger.info(`${interaction.user.tag} used help command`);
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
        logger.warn(`Could not determine category for command ${commandName}:`, error);
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