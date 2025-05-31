const logger = require('../utils/logger');

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        logger.info(`Bot is ready! Logged in as ${client.user.tag}`);
        logger.info(`Connected to ${client.guilds.cache.size} guild(s)`);
        logger.info(`Serving ${client.users.cache.size} users`);

        // Set bot activity
        client.user.setActivity('for support tickets', { type: 3 }); // 3 = WATCHING

        // Log guild information
        client.guilds.cache.forEach(guild => {
            logger.info(`Connected to guild: ${guild.name} (${guild.id}) - ${guild.memberCount} members`);
        });
    }
};
