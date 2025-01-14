import firebase from 'firebase-admin';
import { GuildMember, Message, MessageEmbed } from 'discord.js';
import cooldown from '../../util/cooldown';
import fetchMention from '../../util/fetchMention';
import cache from '../../util/cache';

const prestigeRoleIds = [
    '806312627877838878',
    '806896328255733780',
    '806896441947324416',
    '809142950117245029',
    '809142956715671572',
    '809142968434950201',
    '809143362938339338',
    '809143374555774997',
    '809143390791925780',
    '809143588105486346',
];

export default async function balance(
    message: Message,
    output: 'silence' | 'emit' | 'emit new member',
    optionalTarget?: GuildMember
): Promise<number | false> {
    const app = firebase.app();
    const database = app.database();
    const numberFormat = new Intl.NumberFormat();
    const { member, channel, guild, content, client } = message;
    if (!guild || !member) return false;
    if (output === 'emit') {
        if (
            await cooldown(message, `!balance`, {
                default: 10 * 1000,
                donator: 2 * 1000,
            })
        ) {
            return false;
        }
    }

    const memberArg = content.split(' ')[1];
    let target = optionalTarget || member;
    if (memberArg && !optionalTarget && output === 'emit') {
        target =
            (await fetchMention(memberArg, guild, {
                content,
                mentionIndex: 1,
            })) || member;
    }

    if (!Object.keys(cache['discord_bot/community/currency']).length)
        return false;
    const profile = cache['discord_bot/community/currency'][target.id];

    let prestigeLevel = 0;
    prestigeRoleIds.forEach(id => {
        if (target.roles.cache.has(id)) prestigeLevel += 1;
    });
    const embed = new MessageEmbed()
        .setAuthor(
            `${target.user.username}#${target.user.discriminator}`,
            target.user.avatarURL({
                dynamic: true,
            }) ?? undefined
        )
        .setColor(target.displayHexColor)
        .setTitle(`${target?.id === member.id ? 'Your' : 'Their'} Balance`)
        .setFooter(
            prestigeLevel > 0
                ? member.guild.roles.cache.get(
                      prestigeRoleIds[prestigeLevel - 1]
                  )?.name ?? ''
                : ''
        );
    if (!profile || !profile.initiated) {
        if (target.id !== member.id && output !== 'silence') {
            await channel?.send(
                'They have not started using currency command yet.'
            );
            return false;
        }
        await database
            .ref(`discord_bot/community/currency/${target.id}/balance`)
            .set(Number(profile?.balance) || 10000);
        await database
            .ref(`discord_bot/community/currency/${target.id}/prestige`)
            .set(prestigeLevel);
        if (output === 'emit new member' || output === 'emit') {
            await channel.send({
                content:
                    'Looks like you are the first time using server currency command, you have been granted **<:dicecoin:839981846419079178> 10,000** as a starter reward.',
                embeds: [
                    embed.setDescription(
                        `<:dicecoin:839981846419079178> ${numberFormat.format(
                            Number(profile?.balance) || 10000
                        )}`
                    ),
                ],
            });
            await database
                .ref(`discord_bot/community/currency/${target.id}/initiated`)
                .set(true);
            client.emit('messageCreate', message);
        }
        return output === 'silence' ? Number(profile?.balance) || 10000 : false;
    }
    if (output !== 'emit') {
        return Number(profile.balance);
    }
    await channel.send({
        embeds: [
            embed.setDescription(
                `<:dicecoin:839981846419079178> ${numberFormat.format(
                    Number(profile?.balance)
                )}`
            ),
        ],
    });
    return false;
}
