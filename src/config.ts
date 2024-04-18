import {
    Colors,
    EmbedBuilder,
    Guild,
    time,
    TimestampStyles,
    PermissionsBitField,
    hyperlink,
    GuildMember,
    AttachmentBuilder,
} from "discord.js";

import type { Client, GuildTextBasedChannel, Message, Snowflake, APIEmoji } from "discord.js";

import fs from "node:fs";
import YAML from "yaml";

export default class GuildConfig {
    /**
     * Guild configurations mapped by the guild ID
     * @private
     */
    private static readonly _cache = new Map<Snowflake, GuildConfig>();

    /**
     * Create a new guild configuration
     *
     * @param guild - The guild instance associated with the configuration
     * @param data - The guild configuration data
     * @private
     */
    private constructor(public readonly guild: Guild, public readonly data: IGuildConfig) {
    }

    // Cache all configuration files from the `configs` directory
    static async mount(client: Client<true>): Promise<void> {
        // Find all YAML files in the `configs` directory
        // Ignore the example file
        const files = fs.readdirSync("configs")
            .filter(file => {
                return (file.endsWith(".yml") || file.endsWith(".yaml")) // Ignore non-YAML files
                    && !file.startsWith("example") // Ignore the example file
            });

        // Exit if no config files are found
        if (!files.length) {
            console.error("No config files found in the `configs` directory");
            process.exit(1);
        }

        // Parse and cache each config file
        for (const filename of files) {
            // File name format: GUILD_ID.yml or GUILD_ID.yaml
            const [guildId] = filename.split(".");

            const guild = await client.guilds.fetch(guildId).catch(() => {
                console.error(`[GUILD: ${guildId}] Failed to mount config file, guild not found`);
                process.exit(1);
            });

            // Parse the YAML file
            const fileContent = fs.readFileSync(`configs/${filename}`, "utf-8");
            const raw: RawGuildConfig | null = YAML.parse(fileContent);

            // Perform validation and sanitization
            const data = await GuildConfig.sanitize(guild, raw);

            // Cache the guild configuration
            this._cache.set(guildId, new GuildConfig(guild, data));
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
        // Handle invalid config files by logging the error and exiting the process
        const handleInvalid: (message: string) => never = (message: string): never => {
            console.error(`[GUILD: ${guild.id}] Failed to mount config file, ${message}`);
            return process.exit(1);
        }

        // Ensure the YAML content was parsed successfully
        if (!data) {
            handleInvalid("invalid YAML content");
        }

        // Require logging_channel field
        if (!data.logging_channel) {
            handleInvalid("missing logging_channel field");
        }

        // Require excluded_roles to have values if specified
        if (data.excluded_roles && !data.excluded_roles.length) {
            handleInvalid("excluded_roles is specified but is empty");
        }

        const loggingChannel = await guild.channels
            .fetch(data.logging_channel)
            .catch(() => null);

        // Ensure the logging channel exists/can be accessed by the app
        if (!loggingChannel) {
            handleInvalid("logging channel with ID ${data.logging_channel} not found");
        }

        // Ensure the logging channel is a text channel
        if (!loggingChannel.isTextBased()) {
            handleInvalid("logging channel with ID ${data.logging_channel} is not a text channel");
        }

        // Permissions required in the logging channel
        const REQUIRED_PERMISSIONS = [
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.EmbedLinks
        ];

        // Get the missing permissions as a comma-separated string
        const missingPermissions = guild.members?.me?.permissionsIn(loggingChannel)
            .missing(REQUIRED_PERMISSIONS)
            .join(", ");

        if (missingPermissions) {
            handleInvalid(`missing permissions in logging channel: ${missingPermissions}`);
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
        // Format the poll answers
        const formatAnswer = (answer: PollAnswer): string => {
            if (answer.poll_media.emoji) {
                const parsedEmoji = parseEmoji(answer.poll_media.emoji);
                return `${answer.answer_id}. ${parsedEmoji} ${answer.poll_media.text}`;
            }

            return `${answer.answer_id}. ${answer.poll_media.text}`;
        }

        const answers = poll.answers
            .map(formatAnswer)
            .join("\n");

        const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setAuthor({ name: "Poll Deleted", iconURL: "attachment://poll_delete.png" })
            // The text will not exceed 4096 bytes
            .setDescription(`**Answers**:\n\n${answers}`)
            .setFields([
                {
                    name: "Question",
                    // The text will not exceed 1024 bytes
                    value: poll.question.text
                },
                {
                    name: "Author",
                    value: `${message.author} (\`${message.author.id}\`)`
                },
                {
                    name: "Channel",
                    value: `${message.channel} (\`#${message.channel.name}\`)`
                },
                {
                    name: "Posted",
                    value: time(message.createdAt, TimestampStyles.ShortDateTime)
                }
            ])
            .setTimestamp();

        const pollDeleteIcon = new AttachmentBuilder("assets/poll_delete.png");

        // Send the log
        this.data.logging_channel.send({
            embeds: [embed],
            files: [pollDeleteIcon]
        });
    }

    /**
     * Check if the member is immune to poll removal
     *
     * @param member - The member to check
     */
    isImmune(member: GuildMember): boolean {
        return member.roles.cache.some(role => {
            return this.data.excluded_roles.includes(role.id);
        });
    }
}

/**
 * Parse the emoji to be appropriate for logging
 *
 * @param emoji - The emoji to parse
 * @returns The raw emoji wrapped in an inline code block (and hyperlink if custom emoji)
 */
function parseEmoji(emoji: APIEmoji): string {
    const formattedEmojiName = `\`${emoji.name}\``;

    // Emoji is not a custom emoji
    if (!emoji.id) return formattedEmojiName;

    const extension = emoji.animated ? "gif" : "webp";
    const emojiUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${extension}`;

    return hyperlink(formattedEmojiName, emojiUrl);
}

// The guild configuration
interface IGuildConfig {
    // The channel where the bot will log the removed polls
    logging_channel: GuildTextBasedChannel;
    // Roles that are immune to the poll removal
    excluded_roles: Snowflake[];
}

// The raw guild configuration
interface RawGuildConfig {
    // The channel where the app will log the removed polls
    logging_channel: Snowflake;
    // Roles that are immune to the poll removal
    excluded_roles: Snowflake[];
}

interface Poll {
    question: Record<"text", string>;
    answers: PollAnswer[];
}

interface PollMedia {
    text: string;
    emoji?: APIEmoji;
}

interface PollAnswer {
    answer_id: number;
    poll_media: PollMedia;
}
