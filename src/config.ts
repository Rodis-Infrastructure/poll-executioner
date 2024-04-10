import {
    Colors,
    EmbedBuilder,
    Guild,
    time,
    TimestampStyles,
    type Client,
    type GuildTextBasedChannel,
    type Message,
    type Snowflake, PermissionsBitField,
} from "discord.js";

import fs from "node:fs";
import YAML from "yaml";

export default class GuildConfig {
    /**
     * Guild configurations mapped by the guild ID
     * @private
     */
    private static readonly _cache = new Map<Snowflake, GuildConfig>();

    private constructor(public readonly guild: Guild, public readonly data: IGuildConfig) {
    }

    /** Cache all configuration files from the `configs` directory */
    static async mount(client: Client<true>): Promise<void> {
        // Find all YAML files in the `configs` directory
        const files = fs.readdirSync("configs")
            .filter(file => {
                return (file.endsWith(".yml") || file.endsWith(".yaml")) // Ignore non-YAML files
                    && !file.startsWith("example") // Ignore the example file
            });

        if (!files.length) {
            console.error("No config files found in the `configs` directory");
            process.exit(1);
        }

        for (const filename of files) {
            const [guildId] = filename.split(".");
            const guild = await client.guilds.fetch(guildId).catch(() => null);

            if (!guild) {
                console.error(`[GUILD: ${guildId}] Failed to mount config file, guild not found`);
                process.exit(1);
            }

            // Parse the YAML file
            const fileContent = fs.readFileSync(`configs/${filename}`, "utf-8");
            const data: RawGuildConfig | null = YAML.parse(fileContent);
            const config = await GuildConfig.sanitize(guild, data);

            // Cache the guild configuration
            this._cache.set(guildId, new GuildConfig(guild, config));
        }
    }

    /**
     * Validate and parse the config data
     *
     * @param guild - The guild instance
     * @param data - The raw guild configuration
     * @returns The parsed guild configuration
     * @private
     */
    private static async sanitize(guild: Guild, data: RawGuildConfig | null): Promise<IGuildConfig> {
        if (!data) {
            console.error(`[GUILD: ${guild.id}] Failed to mount config file, invalid YAML content`);
            process.exit(1);
        }

        if (!data.logging_channel) {
            console.error(`[GUILD: ${guild.id}] Failed to mount config file, missing logging_channel field`);
            process.exit(1);
        }

        if (data.excluded_roles && !data.excluded_roles.length) {
            console.error(`[GUILD: ${guild.id}] Failed to mount config file, excluded_roles is specified but is empty`);
            process.exit(1);
        }

        const loggingChannel = await guild.channels.fetch(data.logging_channel)
            .catch(() => null);

        if (!loggingChannel) {
            console.error(`[GUILD: ${guild.id}] Failed to mount config file, logging channel with ID ${data.logging_channel} not found`);
            process.exit(1);
        }

        if (!loggingChannel.isTextBased()) {
            console.error(`[GUILD: ${guild.id}] Failed to mount config file, logging channel with ID ${data.logging_channel} is not a text channel`);
            process.exit(1);
        }

        const REQUIRED_PERMISSIONS = [
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.EmbedLinks
        ];

        const missingPermissions = guild.members?.me?.permissionsIn(loggingChannel)
            .missing(REQUIRED_PERMISSIONS);

        if (missingPermissions?.length) {
            console.error(`[GUILD: ${guild.id}] Failed to mount config file, missing permissions in logging channel:`);
            console.error(missingPermissions.join(", "));
            process.exit(1);
        }

        return {
            logging_channel: loggingChannel,
            excluded_roles: data.excluded_roles ?? []
        };
    }

    /**
     * Get the guild configuration
     *
     * @param guildId The guild ID
     * @returns The guild configuration or `null` if not found
     */
    static get(guildId: Snowflake): GuildConfig | null {
        return this._cache.get(guildId) ?? null;
    }

    /**
     * Log the poll in the specified logging channel
     *
     * @param message - The message containing the poll
     * @param poll - The poll to log
     */
    log(message: Message<true>, poll: Poll): void {
        const pollOptions = poll.answers.map(answer => {
            return `${answer.answer_id}. ${answer.poll_media.text}`;
        });

        const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setAuthor({ name: "Poll Deleted" })
            .setFields([
                {
                    name: "Author",
                    value: `${message.author} (\`${message.author.id}\`)`
                },
                {
                    name: "Channel",
                    value: `${message.channel}`
                },
                {
                    name: "Posted",
                    value: time(message.createdAt, TimestampStyles.ShortDateTime)
                },
                {
                    name: "Question",
                    // Cannot exceed 1024 characters (max is 300)
                    value: poll.question.text
                },
                {
                    name: "Options",
                    // Cannot exceed 1024 characters (max is 589)
                    value: pollOptions.join("\n")
                }
            ])
            .setTimestamp();

        this.data.logging_channel.send({ embeds: [embed] });
    }
}

/** The guild configuration */
interface IGuildConfig {
    /** The channel where the bot will log the removed polls */
    logging_channel: GuildTextBasedChannel;
    /** Roles that are immune to the poll removal */
    excluded_roles: Snowflake[];
}

/** The raw guild configuration */
interface RawGuildConfig {
    /** The channel where the bot will log the removed polls */
    logging_channel: Snowflake;
    /** Roles that are immune to the poll removal */
    excluded_roles: Snowflake[];
}

interface Poll {
    question: PollText;
    answers: PollAnswer[];
}

interface PollText {
    text: string;
}

interface PollAnswer {
    answer_id: number;
    poll_media: PollText
}
