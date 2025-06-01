const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const express = require('express');
const config = require('./config');
const { initializeDatabase, closeDatabase } = require('./database');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const logger = require('./utils/logger');

// Create Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Initialize collections for commands and cooldowns
client.commands = new Collection();
client.cooldowns = new Collection();

// Express server for health checks
const app = express();
const PORT = 5000;

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        uptime: process.uptime(),
        botStatus: client.isReady() ? 'connected' : 'disconnected'
    });
});

app.get('/', (req, res) => {
    res.json({
        name: 'Discord Support Bot',
        status: client.isReady() ? 'online' : 'offline',
        guilds: client.guilds.cache.size,
        users: client.users.cache.size,
        commands: client.commands.size,
        uptime: Math.floor(process.uptime()),
        version: '1.0.0'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Health check server running on port ${PORT}`);
});

// Initialize bot
async function initializeBot() {
    try {
        // Initialize database
        await initializeDatabase();
        logger.info('Database initialized successfully');

        // Load commands and events
        await loadCommands(client);
        await loadEvents(client);

        // Register slash commands
        await registerSlashCommands();

        // Login to Discord
        await client.login(config.token);
        
    } catch (error) {
        logger.error('Failed to initialize bot:', error);
        process.exit(1);
    }
}

// Register slash commands with Discord API
async function registerSlashCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(config.token);
        
        const commands = client.commands.map(command => command.data.toJSON());
        
        logger.info('Started refreshing application (/) commands.');
        
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands }
        );
        
        logger.info('Successfully reloaded application (/) commands.');
    } catch (error) {
        logger.error('Error registering slash commands:', error);
    }
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    client.destroy();
    await closeDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    client.destroy();
    await closeDatabase();
    process.exit(0);
});

// Start the bot
initializeBot();
 
module.exports = client;

