const { EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * Create a standardized embed with consistent styling
 * @param {string} type - Embed type (success, error, warning, info, primary)
 * @param {string} title - Embed title
 * @param {string} description - Embed description
 * @param {Object} options - Additional embed options
 * @returns {EmbedBuilder} Configured embed builder
 */
function createEmbed(type, title, description, options = {}) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();

    // Set color based on type
    switch (type.toLowerCase()) {
        case 'success':
            embed.setColor(config.colors.success);
            break;
        case 'error':
            embed.setColor(config.colors.error);
            break;
        case 'warning':
            embed.setColor(config.colors.warning);
            break;
        case 'info':
            embed.setColor(config.colors.info);
            break;
        case 'primary':
        default:
            embed.setColor(config.colors.primary);
            break;
    }

    // Apply additional options
    if (options.author) {
        embed.setAuthor({
            name: options.author.name,
            iconURL: options.author.iconURL,
            url: options.author.url
        });
    }

    if (options.footer) {
        embed.setFooter({
            text: options.footer.text,
            iconURL: options.footer.iconURL
        });
    }

    if (options.thumbnail) {
        embed.setThumbnail(options.thumbnail);
    }

    if (options.image) {
        embed.setImage(options.image);
    }

    if (options.fields && Array.isArray(options.fields)) {
        options.fields.forEach(field => {
            embed.addFields({
                name: field.name,
                value: field.value,
                inline: field.inline || false
            });
        });
    }

    if (options.url) {
        embed.setURL(options.url);
    }

    return embed;
}

/**
 * Create a success embed
 * @param {string} title - Embed title
 * @param {string} description - Embed description
 * @param {Object} options - Additional embed options
 * @returns {EmbedBuilder} Success embed
 */
function createSuccessEmbed(title, description, options = {}) {
    return createEmbed('success', title, description, options);
}

/**
 * Create an error embed
 * @param {string} title - Embed title
 * @param {string} description - Embed description
 * @param {Object} options - Additional embed options
 * @returns {EmbedBuilder} Error embed
 */
function createErrorEmbed(title, description, options = {}) {
    return createEmbed('error', title, description, options);
}

/**
 * Create a warning embed
 * @param {string} title - Embed title
 * @param {string} description - Embed description
 * @param {Object} options - Additional embed options
 * @returns {EmbedBuilder} Warning embed
 */
function createWarningEmbed(title, description, options = {}) {
    return createEmbed('warning', title, description, options);
}

/**
 * Create an info embed
 * @param {string} title - Embed title
 * @param {string} description - Embed description
 * @param {Object} options - Additional embed options
 * @returns {EmbedBuilder} Info embed
 */
function createInfoEmbed(title, description, options = {}) {
    return createEmbed('info', title, description, options);
}

/**
 * Create a moderation log embed
 * @param {string} action - Moderation action performed
 * @param {Object} target - Target user object
 * @param {Object} moderator - Moderator user object
 * @param {string} reason - Reason for the action
 * @param {Object} options - Additional options
 * @returns {EmbedBuilder} Moderation log embed
 */
function createModerationEmbed(action, target, moderator, reason, options = {}) {
    let color;
    let emoji;

    // Set color and emoji based on action
    switch (action.toLowerCase()) {
        case 'ban':
            color = config.colors.error;
            emoji = '🔨';
            break;
        case 'kick':
            color = config.colors.warning;
            emoji = '👢';
            break;
        case 'mute':
        case 'timeout':
            color = config.colors.warning;
            emoji = '🔇';
            break;
        case 'unmute':
        case 'untimeout':
            color = config.colors.success;
            emoji = '🔊';
            break;
        case 'warn':
            color = config.colors.warning;
            emoji = '⚠️';
            break;
        default:
            color = config.colors.primary;
            emoji = '🔧';
    }

    const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${action.charAt(0).toUpperCase() + action.slice(1)} Action`)
        .setColor(color)
        .setTimestamp()
        .addFields(
            { name: 'Target User', value: `${target.tag} (${target.id})`, inline: true },
            { name: 'Moderator', value: `${moderator.tag} (${moderator.id})`, inline: true },
            { name: 'Reason', value: reason || 'No reason provided', inline: false }
        );

    if (options.duration) {
        embed.addFields({ name: 'Duration', value: options.duration, inline: true });
    }

    if (options.guild) {
        embed.setFooter({
            text: options.guild.name,
            iconURL: options.guild.iconURL({ dynamic: true })
        });
    }

    return embed;
}

/**
 * Create a ticket embed
 * @param {string} type - Ticket embed type (created, closed, etc.)
 * @param {Object} user - User object
 * @param {string} reason - Ticket reason
 * @param {Object} options - Additional options
 * @returns {EmbedBuilder} Ticket embed
 */
function createTicketEmbed(type, user, reason, options = {}) {
    let color;
    let emoji;
    let title;

    switch (type.toLowerCase()) {
        case 'created':
            color = config.colors.success;
            emoji = '🎫';
            title = 'Support Ticket Created';
            break;
        case 'closed':
            color = config.colors.warning;
            emoji = '🔒';
            title = 'Support Ticket Closed';
            break;
        case 'assigned':
            color = config.colors.info;
            emoji = '👤';
            title = 'Ticket Assigned';
            break;
        default:
            color = config.colors.primary;
            emoji = '📝';
            title = 'Ticket Update';
    }

    const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${title}`)
        .setColor(color)
        .setTimestamp()
        .addFields(
            { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Reason', value: reason || 'No reason provided', inline: false }
        );

    if (options.channel) {
        embed.addFields({ name: 'Channel', value: options.channel.toString(), inline: true });
    }

    if (options.closedBy) {
        embed.addFields({ name: 'Closed By', value: `${options.closedBy.tag} (${options.closedBy.id})`, inline: true });
    }

    if (options.assignedTo) {
        embed.addFields({ name: 'Assigned To', value: `${options.assignedTo.tag} (${options.assignedTo.id})`, inline: true });
    }

    if (user.displayAvatarURL) {
        embed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
    }

    return embed;
}

/**
 * Create a welcome embed
 * @param {Object} member - Guild member object
 * @param {string} welcomeMessage - Custom welcome message
 * @param {Object} options - Additional options
 * @returns {EmbedBuilder} Welcome embed
 */
function createWelcomeEmbed(member, welcomeMessage, options = {}) {
    const embed = new EmbedBuilder()
        .setTitle('👋 Welcome!')
        .setDescription(welcomeMessage)
        .setColor(config.colors.success)
        .setTimestamp()
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({
            text: `Member #${member.guild.memberCount}`,
            iconURL: member.guild.iconURL({ dynamic: true })
        });

    if (options.author) {
        embed.setAuthor({
            name: `Welcome to ${member.guild.name}!`,
            iconURL: member.guild.iconURL({ dynamic: true })
        });
    }

    return embed;
}

/**
 * Create a user info embed
 * @param {Object} user - User object
 * @param {Object} member - Guild member object (optional)
 * @param {Object} options - Additional options
 * @returns {EmbedBuilder} User info embed
 */
function createUserInfoEmbed(user, member = null, options = {}) {
    const embed = new EmbedBuilder()
        .setTitle(`👤 User Information`)
        .setColor(config.colors.info)
        .setTimestamp()
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'Username', value: user.tag, inline: true },
            { name: 'ID', value: user.id, inline: true },
            { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false }
        );

    if (member) {
        embed.addFields(
            { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true },
            { name: 'Roles', value: member.roles.cache.size > 1 ? member.roles.cache.filter(role => role.id !== member.guild.id).map(role => role.toString()).join(', ') : 'None', inline: false }
        );

        if (member.nickname) {
            embed.addFields({ name: 'Nickname', value: member.nickname, inline: true });
        }
    }

    return embed;
}

/**
 * Create a paginated embed for lists
 * @param {Array} items - Array of items to display
 * @param {string} title - Embed title
 * @param {number} itemsPerPage - Number of items per page
 * @param {number} currentPage - Current page number (0-indexed)
 * @param {Object} options - Additional options
 * @returns {EmbedBuilder} Paginated embed
 */
function createPaginatedEmbed(items, title, itemsPerPage = 10, currentPage = 0, options = {}) {
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const start = currentPage * itemsPerPage;
    const end = start + itemsPerPage;
    const currentItems = items.slice(start, end);

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(options.color || config.colors.primary)
        .setTimestamp();

    if (currentItems.length === 0) {
        embed.setDescription('No items to display.');
    } else {
        let description = '';
        currentItems.forEach((item, index) => {
            const itemNumber = start + index + 1;
            if (typeof item === 'string') {
                description += `${itemNumber}. ${item}\n`;
            } else if (item.name && item.value) {
                description += `${itemNumber}. **${item.name}**: ${item.value}\n`;
            } else {
                description += `${itemNumber}. ${item.toString()}\n`;
            }
        });
        embed.setDescription(description);
    }

    if (totalPages > 1) {
        embed.setFooter({
            text: `Page ${currentPage + 1} of ${totalPages} | Total items: ${items.length}`
        });
    } else {
        embed.setFooter({
            text: `Total items: ${items.length}`
        });
    }

    return embed;
}

module.exports = {
    createEmbed,
    createSuccessEmbed,
    createErrorEmbed,
    createWarningEmbed,
    createInfoEmbed,
    createModerationEmbed,
    createTicketEmbed,
    createWelcomeEmbed,
    createUserInfoEmbed,
    createPaginatedEmbed
};
