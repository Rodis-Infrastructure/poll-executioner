# Poll Executioner
A simple app that will remove polls sent by users that do not have excluded roles (can be configured)

> [!IMPORTANT]
> The `MESSAGE_CONTENT` [privileged gateway intent](https://support-dev.discord.com/hc/en-us/articles/6207308062871-What-are-Privileged-Intents) must be enabled in the [developer portal](https://discord.com/developers).

## Required permissions
The app **must** have the following permissions to function without any issues:

- `Manage Messages` - Any channel the app needs to monitor for polls
- `View Channels` - Any channel the app needs to monitor for polls
- `Send Messages` - The logging channel
- `Embed Links` - The logging channel

## Configuration
Create a `.env` file in the root directory with the following contents:

https://github.com/Rodis-Infrastructure/poll-executioner/blob/8af6087e20074c178f18b87699aeaa7494f8b536/.env.example#L1-L2

You must create a configuration file under the `configs` directory for every guild the app is in. The file name must be in the following format: `GUILD_ID.yml` or `GUILD_ID.yaml`. The contents of the file should be as follows:

ID of the channel where the app will log the removed polls:
```yaml
logging_channel: "CHANNEL_ID"
```

IDs of the roles that will be able to bypass the app's restrictions:
```yaml
excluded_roles: ["ROLE_ID"]
```

See [example.yml](configs/example.yml) for more info.

## Startup
You could either use **docker** or **bun** to start up the app. For bun:

Install dependencies:
```bash
bun install
```

Start up the app:
```bash
bun start
```
