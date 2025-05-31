const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embed');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('faq')
        .setDescription('View frequently asked questions')
        .addStringOption(option => {
            const choices = Object.keys(config.faq).map(key => ({
                name: config.faq[key].question,
                value: key
            }));
            
            return option.setName('topic')
                .setDescription('Select a specific FAQ topic')
                .setRequired(false)
                .addChoices(...choices.slice(0, 25)); // Discord limit of 25 choices
        }),

    async execute(interaction) {
        const topic = interaction.options.getString('topic');

        if (topic) {
            await sendSpecificFAQ(interaction, topic);
        } else {
            await sendAllFAQs(interaction);
        }
    }
};

async function sendSpecificFAQ(interaction, topic) {
    const faqEntry = config.faq[topic];
    
    if (!faqEntry) {
        return await interaction.reply({
            embeds: [createEmbed('error', 'Error', 'FAQ topic not found.')],
            ephemeral: true
        });
    }

    const embed = createEmbed('info', '❓ ' + faqEntry.question, faqEntry.answer);
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function sendAllFAQs(interaction) {
    const faqEntries = Object.entries(config.faq);
    
    if (faqEntries.length === 0) {
        return await interaction.reply({
            embeds: [createEmbed('info', 'FAQ', 'No FAQ entries are currently available.')],
            ephemeral: true
        });
    }

    // Create embed with all FAQs
    let faqText = '';
    faqEntries.forEach(([key, faq], index) => {
        faqText += `**${index + 1}. ${faq.question}**\n${faq.answer}\n\n`;
    });

    // Truncate if too long (Discord embed limit is 4096 characters)
    if (faqText.length > 3800) {
        faqText = faqText.substring(0, 3800) + '...\n\n*Use `/faq <topic>` for specific questions.*';
    }

    const embed = createEmbed('info', '❓ Frequently Asked Questions', faqText);

    // Create select menu for easy navigation if there are multiple FAQs
    if (faqEntries.length > 1) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('faq_select')
            .setPlaceholder('Select a specific FAQ...')
            .addOptions(
                faqEntries.slice(0, 25).map(([key, faq]) => ({
                    label: faq.question.substring(0, 100), // Discord limit
                    description: faq.answer.substring(0, 100), // Discord limit
                    value: key
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}
