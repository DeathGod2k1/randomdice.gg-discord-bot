import Discord from 'discord.js';
import firebase from 'firebase-admin';
import getBalance from './balance';
import cache from '../../util/cache';

export default async function voteReward(
    message: Discord.Message
): Promise<void> {
    const { author, channel, embeds, guild } = message;
    const database = firebase.app().database();

    if (
        author.id !== '479688142908162059' ||
        channel.id !== '804711958116565003' ||
        !guild
    )
        return;

    const [embed] = embeds;
    if (!embed) return;

    const uid = embed.description?.match(/\(id:(\d{18})\)/)?.[1];
    if (!uid) return;

    const member = await guild.members.fetch(uid);
    if (!member || !Object.keys(cache['discord_bot/community/currency']).length)
        return;
    const balance = (await getBalance(message, 'silence', member)) || 10000;

    await database
        .ref(`discord_bot/community/currency/${uid}/balance`)
        .set(balance + 1000);
    await channel.send({
        content: `Added <:dicecoin:839981846419079178> 1000 to ${member}'s balance. Thanks for voting us!`,
        allowedMentions: {
            parse: [],
            users: [],
            roles: [],
        },
    });
}
