const { createCanvas, loadImage, registerFont } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

class WelcomeImageGenerator {
    constructor() {
        this.width = 1024;
        this.height = 512;
        this.defaultBackground = '#2C2F33';
        this.textColor = '#FFFFFF';
        this.accentColor = '#7289DA';
    }

    /**
     * Generate welcome image for new member
     * @param {GuildMember} member - Discord guild member
     * @param {Object} settings - Welcome settings from database
     * @returns {Buffer} Generated image buffer
     */
    async generateWelcomeImage(member, settings = {}) {
        try {
            const canvas = createCanvas(this.width, this.height);
            const ctx = canvas.getContext('2d');

            // Draw background
            await this.drawBackground(ctx, settings.background_url);

            // Draw overlay for text readability
            this.drawOverlay(ctx);

            // Draw user avatar
            await this.drawAvatar(ctx, member.user.displayAvatarURL({ format: 'png', size: 256 }));

            // Draw welcome text
            this.drawWelcomeText(ctx, member, settings);

            // Draw server info
            this.drawServerInfo(ctx, member.guild);

            return canvas.toBuffer('image/png');
        } catch (error) {
            logger.error('Error generating welcome image:', error);
            throw error;
        }
    }

    /**
     * Draw background image or gradient
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {string} backgroundUrl - Custom background URL
     */
    async drawBackground(ctx, backgroundUrl = null) {
        if (backgroundUrl) {
            try {
                const background = await loadImage(backgroundUrl);
                ctx.drawImage(background, 0, 0, this.width, this.height);
                return;
            } catch (error) {
                logger.warn('Failed to load custom background, using default');
            }
        }

        // Default gradient background
        const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Draw semi-transparent overlay for text readability
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    drawOverlay(ctx) {
        const gradient = ctx.createLinearGradient(0, 0, this.width, 0);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Draw user avatar with circle mask
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {string} avatarUrl - User avatar URL
     */
    async drawAvatar(ctx, avatarUrl) {
        try {
            const avatar = await loadImage(avatarUrl);
            const size = 180;
            const x = 80;
            const y = (this.height - size) / 2;

            // Create circular clipping path
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            // Draw avatar
            ctx.drawImage(avatar, x, y, size, size);
            ctx.restore();

            // Draw border around avatar
            ctx.strokeStyle = this.accentColor;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            ctx.stroke();
        } catch (error) {
            logger.warn('Failed to load user avatar');
            // Draw default avatar placeholder
            this.drawDefaultAvatar(ctx);
        }
    }

    /**
     * Draw default avatar placeholder
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    drawDefaultAvatar(ctx) {
        const size = 180;
        const x = 80;
        const y = (this.height - size) / 2;

        ctx.fillStyle = this.accentColor;
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.textColor;
        ctx.font = 'bold 72px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('?', x + size / 2, y + size / 2 + 20);
    }

    /**
     * Draw welcome text
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {GuildMember} member - Discord guild member
     * @param {Object} settings - Welcome settings
     */
    drawWelcomeText(ctx, member, settings) {
        const startX = 320;
        let currentY = 160;

        // Welcome title
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = this.textColor;
        ctx.textAlign = 'left';
        ctx.fillText('Welcome!', startX, currentY);

        currentY += 70;

        // Username
        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = this.accentColor;
        const displayName = member.displayName.length > 20 ? 
            member.displayName.substring(0, 17) + '...' : member.displayName;
        ctx.fillText(displayName, startX, currentY);

        currentY += 50;

        // Custom message or default
        const welcomeMessage = settings.welcome_message || 
            `Welcome to ${member.guild.name}! We're glad to have you here.`;
        
        ctx.font = '24px Arial';
        ctx.fillStyle = this.textColor;
        
        // Wrap text if too long
        const maxWidth = this.width - startX - 50;
        const words = welcomeMessage.split(' ');
        let line = '';
        
        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && i > 0) {
                ctx.fillText(line, startX, currentY);
                line = words[i] + ' ';
                currentY += 30;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, startX, currentY);
    }

    /**
     * Draw server information
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Guild} guild - Discord guild
     */
    drawServerInfo(ctx, guild) {
        const bottomY = this.height - 60;
        
        ctx.font = '20px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.textAlign = 'left';
        
        const memberCount = guild.memberCount;
        const serverInfo = `${guild.name} • ${memberCount} members`;
        
        ctx.fillText(serverInfo, 80, bottomY);

        // Draw join date
        ctx.textAlign = 'right';
        const joinDate = new Date().toLocaleDateString();
        ctx.fillText(`Joined: ${joinDate}`, this.width - 80, bottomY);
    }

    /**
     * Generate server banner image
     * @param {Guild} guild - Discord guild
     * @param {Object} settings - Server settings
     * @returns {Buffer} Generated banner buffer
     */
    async generateServerBanner(guild, settings = {}) {
        try {
            const canvas = createCanvas(1200, 400);
            const ctx = canvas.getContext('2d');

            // Draw background
            await this.drawBackground(ctx, settings.banner_url);
            this.drawOverlay(ctx);

            // Draw server icon
            if (guild.iconURL()) {
                await this.drawServerIcon(ctx, guild.iconURL({ format: 'png', size: 256 }));
            }

            // Draw server info
            this.drawServerBannerText(ctx, guild);

            return canvas.toBuffer('image/png');
        } catch (error) {
            logger.error('Error generating server banner:', error);
            throw error;
        }
    }

    /**
     * Draw server icon for banner
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {string} iconUrl - Server icon URL
     */
    async drawServerIcon(ctx, iconUrl) {
        try {
            const icon = await loadImage(iconUrl);
            const size = 120;
            const x = 60;
            const y = (400 - size) / 2;

            ctx.save();
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(icon, x, y, size, size);
            ctx.restore();

            ctx.strokeStyle = this.accentColor;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            ctx.stroke();
        } catch (error) {
            logger.warn('Failed to load server icon');
        }
    }

    /**
     * Draw server banner text
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Guild} guild - Discord guild
     */
    drawServerBannerText(ctx, guild) {
        const startX = 220;
        let currentY = 150;

        ctx.font = 'bold 42px Arial';
        ctx.fillStyle = this.textColor;
        ctx.textAlign = 'left';
        ctx.fillText(guild.name, startX, currentY);

        currentY += 60;

        ctx.font = '24px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(`${guild.memberCount} members`, startX, currentY);

        currentY += 40;

        ctx.font = '20px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        const createdDate = guild.createdAt.toLocaleDateString();
        ctx.fillText(`Created: ${createdDate}`, startX, currentY);
    }
}

module.exports = new WelcomeImageGenerator();