# Poll Executioner

A simple bot that will remove polls sent by non-staff members.

# Configuration

Create a `.env` file in the root directory with the following contents:

(permalink placeholder)

You must create a configuration file under the `configs` directory for every guild the bot is in. The file name must be in the following format: `GUILD_ID.yml` or `GUILD_ID.yaml`. The contents of the file should be as follows:

ID of the channel where the bot will log the removed polls:
```yaml
logging_channel: "CHANNEL_ID"
```

IDs of the roles that will be able to bypass the bot's restrictions:
```yaml
excluded_roles: ["ROLE_ID"]
```

# Startup

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run src/index.ts
```