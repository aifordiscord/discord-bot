const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency and API response time'),

    async execute(interaction) {
        try {
            const sent = await interaction.reply({ 
                embeds: [createEmbed('info', '🏓 Pinging...', 'Calculating latency...')], 
                fetchReply: true 
            });

            const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
            const apiLatency = Math.round(interaction.client.ws.ping);

            // Determine latency quality
            let botStatus = '';
            let apiStatus = '';

            if (botLatency < 100) botStatus = '🟢 Excellent';
            else if (botLatency < 200) botStatus = '🟡 Good';
            else if (botLatency < 300) botStatus = '🟠 Fair';
            else botStatus = '🔴 Poor';

            if (apiLatency < 100) apiStatus = '🟢 Excellent';
            else if (apiLatency < 200) apiStatus = '🟡 Good';
            else if (apiLatency < 300) apiStatus = '🟠 Fair';
            else apiStatus = '🔴 Poor';

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🏓 Pong!')
                .addFields(
                    { name: 'Bot Latency', value: `${botLatency}ms\n${botStatus}`, inline: true },
                    { name: 'API Latency', value: `${apiLatency}ms\n${apiStatus}`, inline: true },
                    { name: 'Uptime', value: `<t:${Math.floor((Date.now() - interaction.client.uptime) / 1000)}:R>`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            logger.info(`${interaction.user.tag} used ping command - Bot: ${botLatency}ms, API: ${apiLatency}ms`);

        } catch (error) {
            logger.error('Error in ping command:', error);
            
            const errorEmbed = createEmbed('error', 'Command Failed', 'An unexpected error occurred while checking latency.');
            
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            }
        }
    }
};