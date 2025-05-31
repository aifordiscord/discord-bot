module.exports = {
    // Bot credentials
    token: process.env.DISCORD_TOKEN || 'your_bot_token_here ',
    clientId: process.env.CLIENT_ID || 'your_client_id_here',
    
    // Server settings
    guildId: process.env.GUILD_ID || null, // Optional: specific guild for testing
    
    // Database settings
    database: {
        path: process.env.DB_PATH || './bot.db'
    },
    
    // Bot settings
    prefix: process.env.PREFIX || '!',
    ownerIds: process.env.OWNER_IDS ? process.env.OWNER_IDS.split(',') : ['your_discord_userid'],
    
    // Feature settings
    tickets: {
        categoryName: 'Support Tickets',
        logChannelName: 'ticket-logs',
        supportRoleName: 'Support Team'
    },
    
    // Moderation settings
    moderation: {
        logChannelName: 'mod-logs',
        muteRoleName: 'Muted',
        maxWarnings: 3
    },
    
    // Welcome settings
    welcome: {
        defaultChannelName: 'welcome',
        defaultMessage: 'Welcome to the server, {user}! Please read the rules and enjoy your stay.'
    },
    
    // Auto-role settings
    autoRole: {
        enabled: true,
        defaultRoleName: 'Member'
    },
    
    // Embed colors
    colors: {
        primary: 0x5865F2,
        success: 0x57F287,
        warning: 0xFEE75C,
        error: 0xED4245,
        info: 0x5865F2
    },
    
    // Rate limiting
    rateLimits: {
        commands: 5, // commands per interval
        interval: 60000 // 1 minute in milliseconds
    },
    
    // FAQ entries
    faq: {
        'how-to-create-ticket': {
            question: 'How do I create a support ticket?',
            answer: 'Use the `/ticket` command to create a new support ticket. Our team will assist you shortly!'
        },
        'server-rules': {
            question: 'What are the server rules?',
            answer: 'Please check the #rules channel for our complete server rules and guidelines.'
        },
        'contact-staff': {
            question: 'How do I contact staff?',
            answer: 'You can create a ticket using `/ticket`, mention @Support Team, or DM any online moderator.'
        }
    }
};
