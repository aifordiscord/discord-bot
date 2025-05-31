const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Create and send custom embed messages')
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Embed title')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Embed description')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Embed color (hex code like #FF0000)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('image')
                .setDescription('Image URL for the embed')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('thumbnail')
                .setDescription('Thumbnail URL for the embed')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('footer')
                .setDescription('Footer text')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        try {
            // Check if command is used in a guild
            if (!interaction.guild) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Server Only', 'This command can only be used in a server.')],
                    ephemeral: true
                });
            }

            // Check if user has required permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Missing Permissions', 'You need the "Manage Messages" permission to use this command.')],
                    ephemeral: true
                });
            }

            const title = interaction.options.getString('title');
            const description = interaction.options.getString('description');
            const color = interaction.options.getString('color');
            const imageUrl = interaction.options.getString('image');
            const thumbnailUrl = interaction.options.getString('thumbnail');
            const footerText = interaction.options.getString('footer');

            // Validate that at least title or description is provided
            if (!title && !description) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Missing Content', 'Please provide at least a title or description for the embed.')],
                    ephemeral: true
                });
            }

            // Create embed
            const embed = new EmbedBuilder();

            if (title) embed.setTitle(title);
            if (description) embed.setDescription(description);

            // Set color
            if (color) {
                // Validate hex color
                const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
                if (hexRegex.test(color)) {
                    embed.setColor(color);
                } else {
                    return await interaction.reply({
                        embeds: [createEmbed('error', 'Invalid Color', 'Please provide a valid hex color code (e.g., #FF0000).')],
                        ephemeral: true
                    });
                }
            } else {
                embed.setColor('#5865F2');
            }

            // Set image
            if (imageUrl) {
                try {
                    new URL(imageUrl);
                    embed.setImage(imageUrl);
                } catch {
                    return await interaction.reply({
                        embeds: [createEmbed('error', 'Invalid Image URL', 'Please provide a valid image URL.')],
                        ephemeral: true
                    });
                }
            }

            // Set thumbnail
            if (thumbnailUrl) {
                try {
                    new URL(thumbnailUrl);
                    embed.setThumbnail(thumbnailUrl);
                } catch {
                    return await interaction.reply({
                        embeds: [createEmbed('error', 'Invalid Thumbnail URL', 'Please provide a valid thumbnail URL.')],
                        ephemeral: true
                    });
                }
            }

            // Set footer
            if (footerText) {
                embed.setFooter({ text: footerText });
            }

            embed.setTimestamp();

            // Send the embed
            await interaction.reply({ embeds: [embed] });

            logger.info(`${interaction.user.tag} created custom embed in ${interaction.channel.name} (${interaction.guild.name})`);

        } catch (error) {
            logger.error('Error in embed command:', error);
            
            let errorMessage = 'An unexpected error occurred while creating the embed.';
            
            if (error.message.includes('Invalid URL')) {
                errorMessage = 'One of the provided URLs is invalid.';
            } else if (error.code === 50013) {
                errorMessage = 'I do not have permission to send messages in this channel.';
            }
            
            const errorEmbed = createEmbed('error', 'Embed Failed', errorMessage);
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            }
        }
    }
};