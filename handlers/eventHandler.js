const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Load all events from the events directory
 * @param {Client} client - Discord.js client instance
 */
async function loadEvents(client) {
    const eventsPath = path.join(__dirname, '..', 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    let eventCount = 0;

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        
        try {
            // Clear require cache for hot reloading during development
            delete require.cache[require.resolve(filePath)];
            
            const event = require(filePath);

            // Validate event structure
            if (!isValidEvent(event)) {
                logger.warn(`Invalid event structure in ${file}`);
                continue;
            }

            // Register event listener
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }

            eventCount++;
            logger.debug(`Loaded event: ${event.name} from ${file} (once: ${!!event.once})`);

        } catch (error) {
            logger.error(`Error loading event ${file}:`, error);
        }
    }

    logger.info(`Successfully loaded ${eventCount} events`);
}

/**
 * Reload a specific event
 * @param {Client} client - Discord.js client instance
 * @param {string} eventName - Name of the event to reload
 */
async function reloadEvent(client, eventName) {
    const eventsPath = path.join(__dirname, '..', 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        
        try {
            delete require.cache[require.resolve(filePath)];
            const event = require(filePath);

            if (event.name === eventName) {
                if (!isValidEvent(event)) {
                    throw new Error('Invalid event structure after reload');
                }

                // Remove all existing listeners for this event
                client.removeAllListeners(eventName);

                // Re-register the event
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args));
                } else {
                    client.on(event.name, (...args) => event.execute(...args));
                }

                logger.info(`Successfully reloaded event: ${eventName}`);
                return;
            }
        } catch (error) {
            logger.error(`Error reloading event ${eventName}:`, error);
            throw error;
        }
    }

    throw new Error(`Event file for '${eventName}' not found`);
}

/**
 * Get list of loaded events
 * @param {Client} client - Discord.js client instance
 * @returns {Array} Array of event information
 */
function getLoadedEvents(client) {
    const events = [];
    const eventsPath = path.join(__dirname, '..', 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        
        try {
            const event = require(filePath);
            
            if (isValidEvent(event)) {
                events.push({
                    name: event.name,
                    file: file,
                    once: !!event.once,
                    listenerCount: client.listenerCount(event.name)
                });
            }
        } catch (error) {
            logger.error(`Error reading event ${file}:`, error);
        }
    }

    return events;
}

/**
 * Validate event structure
 * @param {Object} event - Event object to validate
 * @returns {boolean} Whether the event is valid
 */
function isValidEvent(event) {
    // Check if event has required properties
    if (!event.name || !event.execute) {
        return false;
    }

    // Check if execute is a function
    if (typeof event.execute !== 'function') {
        return false;
    }

    // Check if name is a string
    if (typeof event.name !== 'string') {
        return false;
    }

    return true;
}

/**
 * Get event statistics
 * @param {Client} client - Discord.js client instance
 * @returns {Object} Object with event statistics
 */
function getEventStats(client) {
    const loadedEvents = getLoadedEvents(client);
    
    const stats = {
        totalEvents: loadedEvents.length,
        onceEvents: loadedEvents.filter(event => event.once).length,
        continuousEvents: loadedEvents.filter(event => !event.once).length,
        totalListeners: loadedEvents.reduce((total, event) => total + event.listenerCount, 0),
        events: loadedEvents
    };

    return stats;
}

/**
 * Unload all events (useful for clean shutdown)
 * @param {Client} client - Discord.js client instance
 */
function unloadAllEvents(client) {
    const loadedEvents = getLoadedEvents(client);
    
    loadedEvents.forEach(event => {
        client.removeAllListeners(event.name);
        logger.debug(`Unloaded all listeners for event: ${event.name}`);
    });

    logger.info(`Unloaded ${loadedEvents.length} events`);
}

module.exports = {
    loadEvents,
    reloadEvent,
    getLoadedEvents,
    getEventStats,
    unloadAllEvents,
    isValidEvent
};
