import { LOG_ENTRY_DATE_FORMAT } from "./constants.ts";
import { type Client, Events, PermissionsBitField } from "discord.js";

import GuildConfig from "./config.ts";

/**
 * Mounts the {@link Events.Ready|ready} and {@link Events.Raw|raw} events on the client
 *
 * @param client The client instance
 */
export function mountEvents(client: Client): void {
    // Log when the bot is ready
    client.once(Events.ClientReady, (client: Client<true>) => {
        console.info(`Logged in as ${client.user.tag}`);
    });

    // Mount raw event since polls are not supported by discord.js
    client.on(Events.Raw, async packet => {
        const { d: data, t: event } = packet;

        // Ignore messages that aren't polls
        // Ignore events that aren't messages being created
        if (!data.poll || event !== "MESSAGE_CREATE") {
            return;
        }

        const config = GuildConfig.get(data.guild_id);

        if (!config) {
            console.error(`Guild ${data.guild_id} does not have a configuration file`);
            return;
        }

        const channel = await config.guild.channels.fetch(data.channel_id).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        // Return if the bot does not have permission to manage messages
        if (!channel.guild.members.me?.permissionsIn(channel).has(PermissionsBitField.Flags.ManageMessages)) {
            console.error(`Ignoring poll in #${channel.name} from @${data.author.username} (${data.author.id}), missing the "Manage Messages" permission`);
            return;
        }

        const message = await channel.messages.fetch(data.id).catch(() => null);
        if (!message) return;

        const isImmune = message.member?.roles.cache.some(role => {
            return config.data.excluded_roles.includes(role.id);
        });

        // Do not remove polls created from users with excluded roles
        if (isImmune) return;

        // Log the removal for debugging purposes
        const timestamp = new Date().toLocaleString(undefined, LOG_ENTRY_DATE_FORMAT);

        console.info(`[${timestamp}] Removing poll from @${message.author.username} (${message.author.id}) sent in #${channel.name}`);
        console.debug(JSON.stringify(data.poll, null, 2));

        // Remove and log the poll
        message.delete();
        config.log(message, data.poll);
    });
}