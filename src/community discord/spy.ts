import * as Discord from 'discord.js';
import logMessage from '../dev-commands/logMessage';

const bannedCache: string[] = [];

async function fetchIsBanned(
    guild: Discord.Guild,
    user: Discord.User
): Promise<boolean> {
    try {
        if (!bannedCache.includes(user.id)) {
            const banUser = await guild.fetchBan(user);
            bannedCache.push(banUser.user.id);
        }
        return true;
    } catch (err) {
        if (err.message === 'Unknown Ban') return false;
        throw err;
    }
}

async function fetchMember(
    guild: Discord.Guild,
    user: Discord.User
): Promise<boolean> {
    try {
        await guild.members.fetch(user);
        return true;
    } catch (err) {
        if (err.message === 'Unknown Member') return false;
        throw err;
    }
}

export default async function spy(message: Discord.Message): Promise<void> {
    try {
        const { guild, member, content, client, author, channel } = message;
        if (
            !guild ||
            !member ||
            guild.id !== '818961659086766111' ||
            !channel.isText()
        )
            return;

        const communityDiscord = await client.guilds.fetch(
            '804222694488932362'
        );
        const spyLog = communityDiscord.channels.cache.get(
            '852355980779978752'
        );
        const isBanned = await fetchIsBanned(guild, author);
        const isCommunityDiscordMember = isBanned
            ? false
            : await fetchMember(guild, author);
        if (!spyLog?.isText()) return;
        const sensitiveWords = /\b(hack\w*)|(buy\w*)|(sell\w*)|(boost\w*)|(account\w*)|(price\w*)\b/gi;
        const triggered = Array.from(content.matchAll(sensitiveWords));
        const [sliced1, sliced2] = [
            content.slice(0, 1024),
            content.slice(1024),
        ];
        const embed = new Discord.MessageEmbed()
            .setAuthor(
                `${author.username}#${author.discriminator}`,
                author.displayAvatarURL({ dynamic: true })
            )
            .setTitle('Hack Discord Spied Message')
            .setColor(member.displayColor)
            .addField('User', author)
            .addField('User has been banned', isBanned ? '✔️' : '❌')
            .addField(
                'User is member in this discord',
                isCommunityDiscordMember ? '✔️' : '❌'
            )
            .addField('In Channel', (channel as Discord.GuildChannel).name)
            .addField('Content', sliced1 || '*nothing*')
            .setFooter(
                guild.name,
                guild.iconURL({ dynamic: true }) ?? undefined
            )
            .setTimestamp();
        await spyLog.send(
            triggered.length
                ? `${
                      isBanned ? '' : '<@&845586534660046868>'
                  } Sensitive keyword${
                      Array.from(triggered).length > 1 ? 's' : ''
                  } triggered: ${Array.from(triggered)
                      .map(match => `**${match[0]}**`)
                      .join(' ')}`
                : '',
            sliced2 ? embed.addField('‎', sliced2) : embed
        );
    } catch (err) {
        try {
            await logMessage(message.client, err.stack);
        } catch (e) {
            // no action
        }
    }
}
