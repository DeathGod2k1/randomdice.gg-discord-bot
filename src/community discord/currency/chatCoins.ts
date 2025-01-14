import Discord from 'discord.js';
import firebase from 'firebase-admin';
import getBalance from './balance';
import cache from '../../util/cache';

export function duplicatedRoleMulti(member: Discord.GuildMember): number {
    const tier1roles = ['806312627877838878'];
    const tier2roles = [
        '806896328255733780',
        '804231753535193119',
        '805388604791586826',
    ];
    const tier3roles = ['804512584375599154', '809142956715671572'];
    const tier4roles = ['804513079319592980', '809143588105486346'];
    const tier5roles = ['804513117228367882', '805727466219372546'];

    const duplicatedTierMulti = (
        tierRoles: string[],
        multiplier: number
    ): number =>
        Math.max(
            (member.roles.cache.filter(role => tierRoles.includes(role.id))
                .size -
                1) *
                multiplier,
            0
        );

    return (
        duplicatedTierMulti(tier1roles, 2) +
        duplicatedTierMulti(tier2roles, 5) +
        duplicatedTierMulti(tier3roles, 10) +
        duplicatedTierMulti(tier4roles, 20) +
        duplicatedTierMulti(tier5roles, 50)
    );
}

const cooldown = new Map<string, boolean>();
const weeklyCooldown = new Map<string, boolean>();
export default async function chatCoins(
    message: Discord.Message,
    dd?: true
): Promise<void> {
    const database = firebase.app().database();
    const { content, member, channel, author, client } = message;

    if (
        client.user &&
        author.id === client.user.id &&
        channel.id === '804222694488932364' &&
        content === '<@&807578981003689984> come and revive this dead chat.'
    ) {
        let generalMulti =
            cache['discord_bot/community/currencyConfig'].multiplier.channels[
                '804222694488932364'
            ] || 0;
        await database
            .ref(
                `discord_bot/community/currencyConfig/multiplier/channels/804222694488932364`
            )
            .set(generalMulti + 10);
        setTimeout(async () => {
            generalMulti =
                cache['discord_bot/community/currencyConfig'].multiplier
                    .channels['804222694488932364'] || 0;
            await database
                .ref(
                    `discord_bot/community/currencyConfig/multiplier/channels/804222694488932364`
                )
                .set(generalMulti - 10);
        }, 60 * 60 * 1000);
        await channel.send(
            `For the next 60 minutes, ${channel} has extra \`x10\` multiplier!`
        );
        return;
    }

    if (
        channel.type === 'DM' ||
        author.bot ||
        !member ||
        content.startsWith('!') ||
        (/^dd/i.test(content) && !dd)
    ) {
        return;
    }

    const balance = await getBalance(message, 'silence');
    if (
        balance === false ||
        !Object.keys(cache['discord_bot/community/currency']).length
    )
        return;

    if (cooldown.get(member.id)) return;
    cooldown.set(member.id, true);
    setTimeout(() => cooldown.set(member.id, false), 10 * 1000);
    let reward = 1;

    const { multiplier } = cache['discord_bot/community/currencyConfig'];
    reward += multiplier.channels[channel.id] || 0;
    member.roles.cache.forEach(role => {
        reward += multiplier.roles[role.id] || 0;
    });
    reward += duplicatedRoleMulti(member);
    multiplier.blacklisted.forEach(blacklisted => {
        if (blacklisted === channel.id || member.roles.cache.has(blacklisted)) {
            reward = 0;
        }
    });
    if (reward === 0) return;

    await database
        .ref(`discord_bot/community/currency/${member.id}/balance`)
        .set(balance + reward);
    if (weeklyCooldown.get(member.id)) return;
    const weekly =
        Number(cache['discord_bot/community/currency'][member.id].weeklyChat) ||
        0;
    await database
        .ref(`discord_bot/community/currency/${member.id}/weeklyChat`)
        .set(weekly + 1);
    setTimeout(
        () => weeklyCooldown.set(member.id, false),
        (channel.parentId === '804227071765118976' ? 30 : 10) * 1000
    );
}
