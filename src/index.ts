import { Client, IntentsBitField } from "discord.js";
import { mountEvents } from "./events.ts";

import GuildConfig from "./config.ts";

// Ensure a Discord app token is provided
if (!process.env.DISCORD_TOKEN) {
    console.error("Missing DISCORD_TOKEN environment variable");
    process.exit(1);
}

// The client instance
const client: Client<true> = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent
    ]
});

// Entry point
async function main(): Promise<void> {
    // Mount event listeners
    mountEvents(client);

    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);

    // Mount guild configurations
    await GuildConfig.mount(client);
}

main()
