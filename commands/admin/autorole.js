const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const { getAutoRoles, addAutoRole, removeAutoRole } = require('../../database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Configure automatic role assignment for new members')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'Add Role', value: 'add' },
                    { name: 'Remove Role', value: 'remove' },
                    { name: 'List Roles', value: 'list' }
                ))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Role to add or remove (required for add/remove actions)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        try {
            const action = interaction.options.getString('action');
            const role = interaction.options.getRole('role');

            switch (action) {
                case 'add':
                    await handleAddRole(interaction, role);
                    break;
                case 'remove':
                    await handleRemoveRole(interaction, role);
                    break;
                case 'list':
                    await handleListRoles(interaction);
                    break;
                default:
                    await interaction.reply({
                        embeds: [createEmbed('error', 'Error', 'Invalid action specified.')],
                        ephemeral: true
                    });
            }
        } catch (error) {
            logger.error('Error in autorole command:', error);
            
            const errorEmbed = createEmbed('error', 'Error', 'An error occurred while processing the autorole command. Please try again.');
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};

async function handleAddRole(interaction, role) {
    if (!role) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Error', 'You must specify a role to add.')],
            ephemeral: true
        });
    }

    // Check if bot can assign this role
    const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
    if (role.position >= botMember.roles.highest.position) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Error', 'I cannot assign this role as it is higher than or equal to my highest role.')],
            ephemeral: true
        });
    }

    // Check if role is @everyone
    if (role.id === interaction.guild.id) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Error', 'Cannot set @everyone as an auto-role.')],
            ephemeral: true
        });
    }

    // Check if role is managed (bot roles, boost roles, etc.)
    if (role.managed) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Error', 'Cannot set managed roles (bot roles, boost roles, etc.) as auto-roles.')],
            ephemeral: true
        });
    }

    // Check if role is already an auto-role
    const existingAutoRoles = await getAutoRoles(interaction.guild.id);
    if (existingAutoRoles.some(autoRole => autoRole.role_id === role.id)) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Error', `${role} is already set as an auto-role.`)],
            ephemeral: true
        });
    }

    // Add role to auto-roles
    await addAutoRole(interaction.guild.id, role.id);

    const successEmbed = createEmbed('success', 'Auto-Role Added', 
        `${role} has been added to the auto-roles list. New members will automatically receive this role when they join the server.`);

    await interaction.reply({ embeds: [successEmbed] });

    logger.info(`${interaction.user.tag} added ${role.name} as auto-role in ${interaction.guild.name}`);
}

async function handleRemoveRole(interaction, role) {
    if (!role) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Error', 'You must specify a role to remove.')],
            ephemeral: true
        });
    }

    // Check if role is an auto-role
    const existingAutoRoles = await getAutoRoles(interaction.guild.id);
    if (!existingAutoRoles.some(autoRole => autoRole.role_id === role.id)) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Error', `${role} is not currently set as an auto-role.`)],
            ephemeral: true
        });
    }

    // Remove role from auto-roles
    await removeAutoRole(interaction.guild.id, role.id);

    const successEmbed = createEmbed('success', 'Auto-Role Removed', 
        `${role} has been removed from the auto-roles list. New members will no longer automatically receive this role.`);

    await interaction.reply({ embeds: [successEmbed] });

    logger.info(`${interaction.user.tag} removed ${role.name} from auto-roles in ${interaction.guild.name}`);
}

async function handleListRoles(interaction) {
    const autoRoles = await getAutoRoles(interaction.guild.id);

    if (autoRoles.length === 0) {
        return await interaction.reply({
            embeds: [createEmbed('info', 'Auto-Roles', 'No auto-roles are currently configured.\n\nUse `/autorole add <role>` to add roles that will be automatically assigned to new members.')],
            ephemeral: true
        });
    }

    let rolesList = '';
    let validRolesCount = 0;

    for (const autoRole of autoRoles) {
        const role = interaction.guild.roles.cache.get(autoRole.role_id);
        if (role) {
            rolesList += `• ${role} (${role.name})\n`;
            validRolesCount++;
        } else {
            // Role doesn't exist anymore, remove it from database
            await removeAutoRole(interaction.guild.id, autoRole.role_id);
        }
    }

    if (validRolesCount === 0) {
        rolesList = 'No valid auto-roles found. Some roles may have been deleted.';
    }

    const embed = createEmbed('info', 'Auto-Roles Configuration', 
        `**Current Auto-Roles:**\n${rolesList}\n**Total:** ${validRolesCount} role(s)\n\n**How it works:**\nWhen new members join the server, they will automatically receive all the roles listed above.\n\n**Manage Auto-Roles:**\n• Use \`/autorole add <role>\` to add a new auto-role\n• Use \`/autorole remove <role>\` to remove an auto-role`);

    await interaction.reply({ embeds: [embed], ephemeral: true });
}
