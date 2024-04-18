import { LOG_ENTRY_DATE_FORMAT } from "./constants.ts";
import { Events, PermissionsBitField } from "discord.js";
import type { Client, GuildTextBasedChannel } from "discord.js";

import GuildConfig from "./config.ts";

/**
 * Mounts the {@link Events.Ready|ready} and {@link Events.Raw|raw} events on the client
 *
 * @param client The client instance
 */
export function mountEvents(client: Client): void {
    // Log when the app is ready
    client.once(Events.ClientReady, (client: Client<true>) => {
        console.info(`Logged in as ${client.user.tag} (${client.user.id})`);
    });

    // Mount raw event since polls are not supported by discord.js
    client.on(Events.Raw, async packet => {
        const { d: data, t: event } = packet;

        // Ignore messages that aren't polls
        // Ignore events that aren't messages being created
        if (!data.poll || event !== "MESSAGE_CREATE") {
            return;
        }

        const timestamp = new Date().toLocaleString(undefined, LOG_ENTRY_DATE_FORMAT);
        const config = GuildConfig.get(data.guild_id);

        if (!config) {
            console.error(`[${timestamp}, GUILD: ${data.guild_id}] Config not found`);
            return;
        }

        const channel = await config.guild.channels.fetch(data.channel_id).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const userReference = `@${data.author.username} (${data.author.id})`;

        // Ignore if the app does not have permission to manage messages
        if (!canManageMessagesIn(channel)) {
            console.warn(`[${timestamp}] Ignoring poll from ${userReference}, sent in #${channel.name}. Missing the "Manage Messages" permission`);
            return;
        }

        // Fetch the message for removal
        const message = await channel.messages.fetch(data.id).catch(() => null);
        if (!message) return;

        // Do not remove polls created by users with excluded roles
        if (message.member && config.isImmune(message.member)) return;

        // Log the removal for debugging purposes
        const stringifiedPoll = JSON.stringify(data.poll, null, 2);

        console.info(`[${timestamp}] Removing poll from ${userReference}, sent in #${channel.name}`);
        console.debug(stringifiedPoll);

        // Remove and log the poll
        message.delete().catch(() => {
            console.warn(`[${timestamp}] Failed to remove poll from ${userReference}, sent in #${channel.name}`);
        });

        config.log(message, data.poll);
    });
}

/**
 * Whether the client has permission to manage messages in the specified channel
 *
 * @param channel - The channel to check
 */
function canManageMessagesIn(channel: GuildTextBasedChannel): boolean {
    return channel.guild.members.me?.permissionsIn(channel).has(PermissionsBitField.Flags.ManageMessages) ?? false;
}
