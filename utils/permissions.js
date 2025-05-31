const { PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const logger = require('./logger');

/**
 * Check if a user has permission to use a command
 * @param {Interaction} interaction - Discord interaction object
 * @param {Object} command - Command object
 * @returns {boolean} Whether the user has permission
 */
function checkPermissions(interaction, command) {
    // Allow in DMs if command doesn't require guild permissions
    if (!interaction.guild) {
        return !command.guildOnly;
    }

    // Owner always has permission
    if (isOwner(interaction.user.id)) {
        return true;
    }

    // Check if command has default member permissions set
    if (command.data.default_member_permissions) {
        const requiredPermissions = command.data.default_member_permissions;
        
        // Check if user has the required permissions
        if (!interaction.member.permissions.has(requiredPermissions)) {
            return false;
        }
    }

    // Check custom permission requirements
    if (command.permissions) {
        return checkCustomPermissions(interaction, command.permissions);
    }

    // If no specific permissions required, allow everyone
    return true;
}

/**
 * Check custom permission requirements
 * @param {Interaction} interaction - Discord interaction object
 * @param {Array|Object} permissions - Permission requirements
 * @returns {boolean} Whether the user meets the requirements
 */
function checkCustomPermissions(interaction, permissions) {
    // If permissions is an array of permission flags
    if (Array.isArray(permissions)) {
        return interaction.member.permissions.has(permissions);
    }

    // If permissions is an object with custom logic
    if (typeof permissions === 'object') {
        // Check role requirements
        if (permissions.roles) {
            const hasRequiredRole = permissions.roles.some(roleName => {
                const role = interaction.guild.roles.cache.find(r => 
                    r.name.toLowerCase() === roleName.toLowerCase()
                );
                return role && interaction.member.roles.cache.has(role.id);
            });

            if (!hasRequiredRole) {
                return false;
            }
        }

        // Check permission flags
        if (permissions.flags) {
            if (!interaction.member.permissions.has(permissions.flags)) {
                return false;
            }
        }

        // Check if user needs to be above target in hierarchy
        if (permissions.hierarchy && permissions.target) {
            const targetMember = permissions.target;
            if (!isAboveInHierarchy(interaction.member, targetMember)) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Check if a user is a bot owner
 * @param {string} userId - User ID to check
 * @returns {boolean} Whether the user is an owner
 */
function isOwner(userId) {
    return config.ownerIds.includes(userId);
}

/**
 * Check if member A is above member B in role hierarchy
 * @param {GuildMember} memberA - First member
 * @param {GuildMember} memberB - Second member
 * @returns {boolean} Whether member A is above member B
 */
function isAboveInHierarchy(memberA, memberB) {
    // Owners are always at the top
    if (isOwner(memberA.user.id)) {
        return true;
    }

    if (isOwner(memberB.user.id)) {
        return false;
    }

    // Compare highest role positions
    return memberA.roles.highest.position > memberB.roles.highest.position;
}

/**
 * Check if the bot can perform an action on a target member
 * @param {GuildMember} botMember - Bot's guild member object
 * @param {GuildMember} targetMember - Target member
 * @param {string} action - Action to perform (ban, kick, mute, etc.)
 * @returns {Object} Result object with success status and reason
 */
function canBotActOn(botMember, targetMember, action) {
    const result = {
        success: false,
        reason: 'Unknown error'
    };

    // Bot cannot act on itself
    if (botMember.id === targetMember.id) {
        result.reason = 'Bot cannot perform actions on itself';
        return result;
    }

    // Bot cannot act on owners
    if (isOwner(targetMember.user.id)) {
        result.reason = 'Bot cannot perform actions on bot owners';
        return result;
    }

    // Check if bot is above target in hierarchy
    if (!isAboveInHierarchy(botMember, targetMember)) {
        result.reason = 'Bot\'s role is not high enough to perform this action';
        return result;
    }

    // Check specific action permissions
    switch (action.toLowerCase()) {
        case 'ban':
            if (!targetMember.bannable) {
                result.reason = 'Target member cannot be banned';
                return result;
            }
            if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
                result.reason = 'Bot lacks Ban Members permission';
                return result;
            }
            break;

        case 'kick':
            if (!targetMember.kickable) {
                result.reason = 'Target member cannot be kicked';
                return result;
            }
            if (!botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
                result.reason = 'Bot lacks Kick Members permission';
                return result;
            }
            break;

        case 'mute':
        case 'timeout':
            if (!targetMember.moderatable) {
                result.reason = 'Target member cannot be muted';
                return result;
            }
            if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                result.reason = 'Bot lacks Moderate Members permission';
                return result;
            }
            break;

        case 'role':
            if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                result.reason = 'Bot lacks Manage Roles permission';
                return result;
            }
            break;

        default:
            break;
    }

    result.success = true;
    result.reason = 'Action permitted';
    return result;
}

/**
 * Check if a user can perform an action on a target member
 * @param {GuildMember} moderator - Moderator member
 * @param {GuildMember} targetMember - Target member
 * @param {string} action - Action to perform
 * @returns {Object} Result object with success status and reason
 */
function canModeratorActOn(moderator, targetMember, action) {
    const result = {
        success: false,
        reason: 'Unknown error'
    };

    // User cannot act on themselves for moderation actions
    if (moderator.id === targetMember.id) {
        result.reason = 'You cannot perform moderation actions on yourself';
        return result;
    }

    // User cannot act on owners
    if (isOwner(targetMember.user.id)) {
        result.reason = 'You cannot perform actions on bot owners';
        return result;
    }

    // Check hierarchy (moderator must be above target)
    if (!isAboveInHierarchy(moderator, targetMember)) {
        result.reason = 'You cannot perform actions on users with equal or higher roles';
        return result;
    }

    // Check specific action permissions
    switch (action.toLowerCase()) {
        case 'ban':
            if (!moderator.permissions.has(PermissionFlagsBits.BanMembers)) {
                result.reason = 'You lack Ban Members permission';
                return result;
            }
            break;

        case 'kick':
            if (!moderator.permissions.has(PermissionFlagsBits.KickMembers)) {
                result.reason = 'You lack Kick Members permission';
                return result;
            }
            break;

        case 'mute':
        case 'timeout':
        case 'warn':
            if (!moderator.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                result.reason = 'You lack Moderate Members permission';
                return result;
            }
            break;

        case 'role':
            if (!moderator.permissions.has(PermissionFlagsBits.ManageRoles)) {
                result.reason = 'You lack Manage Roles permission';
                return result;
            }
            break;

        default:
            break;
    }

    result.success = true;
    result.reason = 'Action permitted';
    return result;
}

/**
 * Get required permissions for a command in a human-readable format
 * @param {Object} command - Command object
 * @returns {Array} Array of permission names
 */
function getRequiredPermissions(command) {
    const permissions = [];

    if (command.data.default_member_permissions) {
        const flags = command.data.default_member_permissions;
        
        // Convert permission flags to readable names
        Object.keys(PermissionFlagsBits).forEach(key => {
            if (flags & PermissionFlagsBits[key]) {
                // Convert from SCREAMING_SNAKE_CASE to Title Case
                const readable = key
                    .toLowerCase()
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                permissions.push(readable);
            }
        });
    }

    if (command.permissions) {
        if (command.permissions.roles) {
            permissions.push(`Roles: ${command.permissions.roles.join(', ')}`);
        }
    }

    return permissions;
}

/**
 * Check if a channel type is allowed for a command
 * @param {Interaction} interaction - Discord interaction
 * @param {Array} allowedChannelTypes - Array of allowed channel types
 * @returns {boolean} Whether the channel type is allowed
 */
function checkChannelType(interaction, allowedChannelTypes) {
    if (!allowedChannelTypes || allowedChannelTypes.length === 0) {
        return true;
    }

    return allowedChannelTypes.includes(interaction.channel.type);
}

/**
 * Check if a command can be used in the current context
 * @param {Interaction} interaction - Discord interaction
 * @param {Object} command - Command object
 * @returns {Object} Result object with success status and detailed reason
 */
function checkCommandContext(interaction, command) {
    const result = {
        success: true,
        reason: null,
        details: []
    };

    // Check if command requires guild
    if (command.guildOnly && !interaction.guild) {
        result.success = false;
        result.reason = 'This command can only be used in servers';
        return result;
    }

    // Check channel type restrictions
    if (command.allowedChannelTypes) {
        if (!checkChannelType(interaction, command.allowedChannelTypes)) {
            result.success = false;
            result.reason = 'This command cannot be used in this type of channel';
            return result;
        }
    }

    // Check if command is disabled
    if (command.disabled) {
        result.success = false;
        result.reason = command.disabledReason || 'This command is currently disabled';
        return result;
    }

    // Check permissions
    if (!checkPermissions(interaction, command)) {
        result.success = false;
        result.reason = 'You do not have permission to use this command';
        
        const requiredPerms = getRequiredPermissions(command);
        if (requiredPerms.length > 0) {
            result.details.push(`Required permissions: ${requiredPerms.join(', ')}`);
        }
        return result;
    }

    return result;
}

/**
 * Log permission check for debugging
 * @param {Interaction} interaction - Discord interaction
 * @param {Object} command - Command object
 * @param {boolean} allowed - Whether permission was granted
 * @param {string} reason - Reason for the decision
 */
function logPermissionCheck(interaction, command, allowed, reason = null) {
    const guild = interaction.guild ? interaction.guild.name : 'DM';
    const user = interaction.user.tag;
    const commandName = command.data.name;
    
    if (allowed) {
        logger.debug(`Permission granted: ${user} can use ${commandName} in ${guild}`);
    } else {
        logger.info(`Permission denied: ${user} cannot use ${commandName} in ${guild} - ${reason}`);
    }
}

module.exports = {
    checkPermissions,
    checkCustomPermissions,
    isOwner,
    isAboveInHierarchy,
    canBotActOn,
    canModeratorActOn,
    getRequiredPermissions,
    checkChannelType,
    checkCommandContext,
    logPermissionCheck
};
