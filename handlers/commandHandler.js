const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Load all commands from the commands directory
 * @param {Client} client - Discord.js client instance
 */
async function loadCommands(client) {
    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFolders = fs.readdirSync(commandsPath);

    let commandCount = 0;

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        
        // Skip if not a directory
        if (!fs.statSync(folderPath).isDirectory()) continue;

        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            
            try {
                // Clear require cache for hot reloading during development
                delete require.cache[require.resolve(filePath)];
                
                const command = require(filePath);

                // Validate command structure
                if (!isValidCommand(command)) {
                    logger.warn(`Invalid command structure in ${file}`);
                    continue;
                }

                // Set command to collection
                client.commands.set(command.data.name, command);
                commandCount++;

                logger.debug(`Loaded command: ${command.data.name} from ${folder}/${file}`);

            } catch (error) {
                logger.error(`Error loading command ${file}:`, error);
            }
        }
    }

    logger.info(`Successfully loaded ${commandCount} commands`);
}

/**
 * Reload a specific command
 * @param {Client} client - Discord.js client instance
 * @param {string} commandName - Name of the command to reload
 */
async function reloadCommand(client, commandName) {
    const command = client.commands.get(commandName);
    
    if (!command) {
        throw new Error(`Command '${commandName}' not found`);
    }

    // Find the command file
    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        
        if (!fs.statSync(folderPath).isDirectory()) continue;

        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            
            try {
                delete require.cache[require.resolve(filePath)];
                const reloadedCommand = require(filePath);

                if (reloadedCommand.data.name === commandName) {
                    if (!isValidCommand(reloadedCommand)) {
                        throw new Error('Invalid command structure after reload');
                    }

                    client.commands.set(reloadedCommand.data.name, reloadedCommand);
                    logger.info(`Successfully reloaded command: ${commandName}`);
                    return;
                }
            } catch (error) {
                logger.error(`Error reloading command ${commandName}:`, error);
                throw error;
            }
        }
    }

    throw new Error(`Command file for '${commandName}' not found`);
}

/**
 * Get command categories and their commands
 * @param {Client} client - Discord.js client instance
 * @returns {Object} Object with categories as keys and command arrays as values
 */
function getCommandCategories(client) {
    const categories = {};

    client.commands.forEach(command => {
        // Determine category from command file path or description
        let category = 'Utility';
        
        if (command.category) {
            category = command.category;
        } else {
            // Try to determine from command description or name
            const name = command.data.name.toLowerCase();
            if (['ban', 'kick', 'mute', 'unmute', 'warn'].includes(name)) {
                category = 'Moderation';
            } else if (['ticket', 'close'].includes(name)) {
                category = 'Support';
            } else if (['autorole', 'welcome'].includes(name)) {
                category = 'Admin';
            }
        }

        if (!categories[category]) {
            categories[category] = [];
        }

        categories[category].push(command);
    });

    return categories;
}

/**
 * Validate command structure
 * @param {Object} command - Command object to validate
 * @returns {boolean} Whether the command is valid
 */
function isValidCommand(command) {
    // Check if command has required properties
    if (!command.data || !command.execute) {
        return false;
    }

    // Check if command data has required SlashCommandBuilder properties
    if (!command.data.name || !command.data.description) {
        return false;
    }

    // Check if execute is a function
    if (typeof command.execute !== 'function') {
        return false;
    }

    return true;
}

/**
 * Get command usage statistics
 * @param {Client} client - Discord.js client instance
 * @returns {Object} Object with command usage statistics
 */
function getCommandStats(client) {
    const stats = {
        totalCommands: client.commands.size,
        categories: {},
        commands: []
    };

    const categories = getCommandCategories(client);
    
    Object.keys(categories).forEach(category => {
        stats.categories[category] = categories[category].length;
    });

    client.commands.forEach(command => {
        stats.commands.push({
            name: command.data.name,
            description: command.data.description,
            category: command.category || 'Unknown'
        });
    });

    return stats;
}

module.exports = {
    loadCommands,
    reloadCommand,
    getCommandCategories,
    getCommandStats,
    isValidCommand
};
