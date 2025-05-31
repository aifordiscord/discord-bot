const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const config = require('./config');
const logger = require('./utils/logger');

let db;

/**
 * Initialize SQLite database and create tables
 */
async function initializeDatabase() {
    try {
        db = await open({
            filename: config.database.path,
            driver: sqlite3.Database
        });

        // Create tables
        await createTables();
        logger.info('Database connection established and tables created');
        
        return db;
    } catch (error) {
        logger.error('Database initialization failed:', error);
        throw error;
    }
}

/**
 * Create necessary database tables
 */
async function createTables() {
    // Tickets table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            closed_at DATETIME,
            closed_by TEXT,
            reason TEXT
        )
    `);

    // Guild settings table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS guild_settings (
            guild_id TEXT PRIMARY KEY,
            welcome_channel TEXT,
            welcome_message TEXT,
            autorole_id TEXT,
            mod_log_channel TEXT,
            ticket_category TEXT,
            ticket_log_channel TEXT,
            mute_role TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Warnings table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS warnings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            moderator_id TEXT NOT NULL,
            reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            active INTEGER DEFAULT 1
        )
    `);

    // Moderation logs table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS mod_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            moderator_id TEXT NOT NULL,
            action TEXT NOT NULL,
            reason TEXT,
            duration INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Auto-role settings table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS autoroles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            role_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
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
    const settings = await db.get(
        'SELECT * FROM guild_settings WHERE guild_id = ?',
        [guildId]
    );
    return settings || null;
}

async function updateGuildSettings(guildId, settings) {
    const existing = await getGuildSettings(guildId);
    
    if (existing) {
        const updateQuery = `
            UPDATE guild_settings 
            SET ${Object.keys(settings).map(key => `${key} = ?`).join(', ')}, 
                updated_at = CURRENT_TIMESTAMP
            WHERE guild_id = ?
        `;
        await db.run(updateQuery, [...Object.values(settings), guildId]);
    } else {
        const insertQuery = `
            INSERT INTO guild_settings (guild_id, ${Object.keys(settings).join(', ')})
            VALUES (?, ${Object.keys(settings).map(() => '?').join(', ')})
        `;
        await db.run(insertQuery, [guildId, ...Object.values(settings)]);
    }
}

/**
 * Ticket functions
 */
async function createTicket(guildId, channelId, userId, reason = null) {
    const result = await db.run(
        'INSERT INTO tickets (guild_id, channel_id, user_id, reason) VALUES (?, ?, ?, ?)',
        [guildId, channelId, userId, reason]
    );
    return result.lastID;
}

async function getTicket(channelId) {
    return await db.get(
        'SELECT * FROM tickets WHERE channel_id = ? AND status = "open"',
        [channelId]
    );
}

async function closeTicket(channelId, closedBy, reason = null) {
    await db.run(
        'UPDATE tickets SET status = "closed", closed_at = CURRENT_TIMESTAMP, closed_by = ?, reason = ? WHERE channel_id = ?',
        [closedBy, reason, channelId]
    );
}

async function getUserTickets(guildId, userId) {
    return await db.all(
        'SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC',
        [guildId, userId]
    );
}

/**
 * Warning functions
 */
async function addWarning(guildId, userId, moderatorId, reason) {
    const result = await db.run(
        'INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)',
        [guildId, userId, moderatorId, reason]
    );
    return result.lastID;
}

async function getUserWarnings(guildId, userId) {
    return await db.all(
        'SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1 ORDER BY created_at DESC',
        [guildId, userId]
    );
}

async function getWarningCount(guildId, userId) {
    const result = await db.get(
        'SELECT COUNT(*) as count FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1',
        [guildId, userId]
    );
    return result.count;
}

/**
 * Moderation log functions
 */
async function addModLog(guildId, userId, moderatorId, action, reason, duration = null) {
    await db.run(
        'INSERT INTO mod_logs (guild_id, user_id, moderator_id, action, reason, duration) VALUES (?, ?, ?, ?, ?, ?)',
        [guildId, userId, moderatorId, action, reason, duration]
    );
}

/**
 * Auto-role functions
 */
async function getAutoRoles(guildId) {
    return await db.all(
        'SELECT role_id FROM autoroles WHERE guild_id = ?',
        [guildId]
    );
}

async function addAutoRole(guildId, roleId) {
    await db.run(
        'INSERT OR IGNORE INTO autoroles (guild_id, role_id) VALUES (?, ?)',
        [guildId, roleId]
    );
}

async function removeAutoRole(guildId, roleId) {
    await db.run(
        'DELETE FROM autoroles WHERE guild_id = ? AND role_id = ?',
        [guildId, roleId]
    );
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
    removeAutoRole
};
