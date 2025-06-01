
const { MongoClient } = require('mongodb');
const config = require('./config');
const logger = require('./utils/logger');

let db;
let client;

/**
 * Initialize MongoDB database and create collections
 */
async function initializeDatabase() {
    try {
        client = new MongoClient(config.database.uri);
        await client.connect();
        
        db = client.db(config.database.name);
        
        // Create indexes for better performance
        await createIndexes();
        logger.info('MongoDB connection established and indexes created');
        
        return db;
    } catch (error) {
        logger.error('Database initialization failed:', error);
        throw error;
    }
}

/**
 * Create necessary database indexes
 */
async function createIndexes() {
    try {
        // Tickets collection indexes
        await db.collection('tickets').createIndex({ guild_id: 1, channel_id: 1 });
        await db.collection('tickets').createIndex({ guild_id: 1, user_id: 1 });
        await db.collection('tickets').createIndex({ status: 1 });

        // Guild settings collection indexes
        await db.collection('guild_settings').createIndex({ guild_id: 1 }, { unique: true });

        // Warnings collection indexes
        await db.collection('warnings').createIndex({ guild_id: 1, user_id: 1 });
        await db.collection('warnings').createIndex({ active: 1 });

        // Moderation logs collection indexes
        await db.collection('mod_logs').createIndex({ guild_id: 1, user_id: 1 });
        await db.collection('mod_logs').createIndex({ created_at: 1 });

        // Auto-roles collection indexes
        await db.collection('autoroles').createIndex({ guild_id: 1, role_id: 1 }, { unique: true });
    } catch (error) {
        logger.error('Error creating indexes:', error);
    }
}

/**
 * Get database instance
 */
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized');
    }
    return db;
}

/**
 * Guild settings functions
 */
async function getGuildSettings(guildId) {
    const settings = await db.collection('guild_settings').findOne({ guild_id: guildId });
    return settings || null;
}

async function updateGuildSettings(guildId, settings) {
    const updateDoc = {
        ...settings,
        updated_at: new Date()
    };

    await db.collection('guild_settings').updateOne(
        { guild_id: guildId },
        { 
            $set: updateDoc,
            $setOnInsert: { 
                guild_id: guildId,
                created_at: new Date()
            }
        },
        { upsert: true }
    );
}

/**
 * Ticket functions
 */
async function createTicket(guildId, channelId, userId, reason = null) {
    const ticket = {
        guild_id: guildId,
        channel_id: channelId,
        user_id: userId,
        status: 'open',
        created_at: new Date(),
        reason: reason
    };

    const result = await db.collection('tickets').insertOne(ticket);
    return result.insertedId;
}

async function getTicket(channelId) {
    return await db.collection('tickets').findOne({
        channel_id: channelId,
        status: 'open'
    });
}

async function closeTicket(channelId, closedBy, reason = null) {
    await db.collection('tickets').updateOne(
        { channel_id: channelId },
        {
            $set: {
                status: 'closed',
                closed_at: new Date(),
                closed_by: closedBy,
                reason: reason
            }
        }
    );
}

async function getUserTickets(guildId, userId) {
    return await db.collection('tickets')
        .find({ guild_id: guildId, user_id: userId })
        .sort({ created_at: -1 })
        .toArray();
}

/**
 * Warning functions
 */
async function addWarning(guildId, userId, moderatorId, reason) {
    const warning = {
        guild_id: guildId,
        user_id: userId,
        moderator_id: moderatorId,
        reason: reason,
        created_at: new Date(),
        active: true
    };

    const result = await db.collection('warnings').insertOne(warning);
    return result.insertedId;
}

async function getUserWarnings(guildId, userId) {
    return await db.collection('warnings')
        .find({ guild_id: guildId, user_id: userId, active: true })
        .sort({ created_at: -1 })
        .toArray();
}

async function getWarningCount(guildId, userId) {
    return await db.collection('warnings').countDocuments({
        guild_id: guildId,
        user_id: userId,
        active: true
    });
}

/**
 * Moderation log functions
 */
async function addModLog(guildId, userId, moderatorId, action, reason, duration = null) {
    const modLog = {
        guild_id: guildId,
        user_id: userId,
        moderator_id: moderatorId,
        action: action,
        reason: reason,
        duration: duration,
        created_at: new Date()
    };

    await db.collection('mod_logs').insertOne(modLog);
}

/**
 * Auto-role functions
 */
async function getAutoRoles(guildId) {
    const autoRoles = await db.collection('autoroles')
        .find({ guild_id: guildId })
        .toArray();
    
    return autoRoles.map(role => ({ role_id: role.role_id }));
}

async function addAutoRole(guildId, roleId) {
    await db.collection('autoroles').updateOne(
        { guild_id: guildId, role_id: roleId },
        { 
            $setOnInsert: { 
                guild_id: guildId,
                role_id: roleId,
                created_at: new Date()
            }
        },
        { upsert: true }
    );
}

async function removeAutoRole(guildId, roleId) {
    await db.collection('autoroles').deleteOne({
        guild_id: guildId,
        role_id: roleId
    });
}

/**
 * Close database connection
 */
async function closeDatabase() {
    if (client) {
        await client.close();
        logger.info('MongoDB connection closed');
    }
}

module.exports = {
    initializeDatabase,
    getDatabase,
    getGuildSettings,
    updateGuildSettings,
    createTicket,
    getTicket,
    closeTicket,
    getUserTickets,
    addWarning,
    getUserWarnings,
    getWarningCount,
    addModLog,
    getAutoRoles,
    addAutoRole,
    removeAutoRole,
    closeDatabase
};
