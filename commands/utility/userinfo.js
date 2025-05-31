const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Get detailed information about a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to get information about')
                .setRequired(false)),

    async execute(interaction) {
        try {
            // Check if command is used in a guild
            if (!interaction.guild) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'Server Only', 'This command can only be used in a server.')],
                    ephemeral: true
                });
            }

            const targetUser = interaction.options.getUser('user') || interaction.user;
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (!targetMember) {
                return await interaction.reply({
                    embeds: [createEmbed('error', 'User Not Found', 'This user is not a member of this server.')],
                    ephemeral: true
                });
            }

            // Create detailed embed
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`${targetUser.tag}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTimestamp();

            // Basic user info
            embed.addFields(
                { name: '👤 User ID', value: targetUser.id, inline: true },
                { name: '🏷️ Username', value: targetUser.username, inline: true },
                { name: '📛 Display Name', value: targetMember.displayName, inline: true }
            );

            // Account creation date
            const accountCreated = Math.floor(targetUser.createdTimestamp / 1000);
            embed.addFields(
                { name: '📅 Account Created', value: `<t:${accountCreated}:F>\n<t:${accountCreated}:R>`, inline: true }
            );

            // Server join date
            if (targetMember.joinedTimestamp) {
                const joinedServer = Math.floor(targetMember.joinedTimestamp / 1000);
                embed.addFields(
                    { name: '📥 Joined Server', value: `<t:${joinedServer}:F>\n<t:${joinedServer}:R>`, inline: true }
                );
            }

            // Bot status
            embed.addFields(
                { name: '🤖 Bot', value: targetUser.bot ? 'Yes' : 'No', inline: true }
            );

            // Roles (excluding @everyone)
            const roles = targetMember.roles.cache
                .filter(role => role.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(role => role.toString());

            if (roles.length > 0) {
                const roleText = roles.length > 10 
                    ? `${roles.slice(0, 10).join(', ')} and ${roles.length - 10} more...`
                    : roles.join(', ');
                embed.addFields(
                    { name: `🎭 Roles [${roles.length}]`, value: roleText, inline: false }
                );
            } else {
                embed.addFields(
                    { name: '🎭 Roles', value: 'No roles', inline: false }
                );
            }

            // Key permissions
            const keyPermissions = [];
            if (targetMember.permissions.has('Administrator')) keyPermissions.push('Administrator');
            if (targetMember.permissions.has('ManageGuild')) keyPermissions.push('Manage Server');
            if (targetMember.permissions.has('ManageChannels')) keyPermissions.push('Manage Channels');
            if (targetMember.permissions.has('ManageRoles')) keyPermissions.push('Manage Roles');
            if (targetMember.permissions.has('BanMembers')) keyPermissions.push('Ban Members');
            if (targetMember.permissions.has('KickMembers')) keyPermissions.push('Kick Members');
            if (targetMember.permissions.has('ModerateMembers')) keyPermissions.push('Moderate Members');

            if (keyPermissions.length > 0) {
                embed.addFields(
                    { name: '🔑 Key Permissions', value: keyPermissions.join(', '), inline: false }
                );
            }

            // Status and activity
            const presence = targetMember.presence;
            if (presence) {
                embed.addFields(
                    { name: '📊 Status', value: presence.status || 'Unknown', inline: true }
                );

                if (presence.activities && presence.activities.length > 0) {
                    const activity = presence.activities[0];
                    let activityText = activity.name;
                    if (activity.details) activityText += `\n${activity.details}`;
                    if (activity.state) activityText += `\n${activity.state}`;
                    
                    embed.addFields(
                        { name: '🎮 Activity', value: activityText, inline: true }
                    );
                }
            }

            // Avatar URL
            embed.addFields(
                { name: '🖼️ Avatar', value: `[Click here](${targetUser.displayAvatarURL({ dynamic: true, size: 512 })})`, inline: true }
            );

            await interaction.reply({ embeds: [embed] });

            logger.info(`${interaction.user.tag} requested user info for ${targetUser.tag} in ${interaction.guild.name}`);

        } catch (error) {
            logger.error('Error in userinfo command:', error);
            
            const errorEmbed = createEmbed('error', 'Command Failed', 'An unexpected error occurred while fetching user information.');
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            }
        }
    }
};