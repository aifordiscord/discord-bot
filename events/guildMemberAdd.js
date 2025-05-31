const { getGuildSettings, getAutoRoles } = require('../database');
const { createEmbed } = require('../utils/embed');
const logger = require('../utils/logger');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        try {
            // Get guild settings
            const guildSettings = await getGuildSettings(member.guild.id);

            // Handle welcome message
            if (guildSettings?.welcome_channel && guildSettings?.welcome_message) {
                await handleWelcomeMessage(member, guildSettings);
            }

            // Handle auto-roles
            await handleAutoRoles(member);

            logger.info(`New member joined ${member.guild.name}: ${member.user.tag} (${member.id})`);

        } catch (error) {
            logger.error(`Error handling new member ${member.user.tag} in ${member.guild.name}:`, error);
        }
    }
};

async function handleWelcomeMessage(member, guildSettings) {
    try {
        const welcomeChannel = member.guild.channels.cache.get(guildSettings.welcome_channel);
        
        if (!welcomeChannel) {
            logger.warn(`Welcome channel not found in ${member.guild.name}`);
            return;
        }

        // Check if bot has permissions to send messages
        const permissions = welcomeChannel.permissionsFor(member.guild.members.me);
        if (!permissions.has(['ViewChannel', 'SendMessages'])) {
            logger.warn(`No permission to send welcome message in ${member.guild.name}`);
            return;
        }

        // Replace {user} placeholder with actual user mention
        const welcomeMessage = guildSettings.welcome_message.replace('{user}', member.user);

        const welcomeEmbed = createEmbed('success', '👋 Welcome!', welcomeMessage);
        welcomeEmbed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
        welcomeEmbed.setFooter({ 
            text: `Member #${member.guild.memberCount}`, 
            iconURL: member.guild.iconURL({ dynamic: true }) 
        });

        await welcomeChannel.send({ embeds: [welcomeEmbed] });

        logger.info(`Sent welcome message for ${member.user.tag} in ${member.guild.name}`);

    } catch (error) {
        logger.error(`Error sending welcome message for ${member.user.tag} in ${member.guild.name}:`, error);
    }
}

async function handleAutoRoles(member) {
    try {
        const autoRoles = await getAutoRoles(member.guild.id);
        
        if (autoRoles.length === 0) {
            return;
        }

        const rolesToAdd = [];

        for (const autoRole of autoRoles) {
            const role = member.guild.roles.cache.get(autoRole.role_id);
            
            if (role) {
                // Check if bot can assign this role
                const botMember = member.guild.members.me;
                if (role.position < botMember.roles.highest.position && !role.managed) {
                    rolesToAdd.push(role);
                } else {
                    logger.warn(`Cannot assign auto-role ${role.name} in ${member.guild.name} - insufficient permissions or managed role`);
                }
            } else {
                logger.warn(`Auto-role ${autoRole.role_id} not found in ${member.guild.name}`);
                // Optionally remove the invalid role from database
                const { removeAutoRole } = require('../database');
                await removeAutoRole(member.guild.id, autoRole.role_id);
            }
        }

        if (rolesToAdd.length > 0) {
            await member.roles.add(rolesToAdd, 'Auto-role assignment');
            
            const roleNames = rolesToAdd.map(role => role.name).join(', ');
            logger.info(`Assigned auto-roles to ${member.user.tag} in ${member.guild.name}: ${roleNames}`);
        }

    } catch (error) {
        logger.error(`Error assigning auto-roles to ${member.user.tag} in ${member.guild.name}:`, error);
    }
}
