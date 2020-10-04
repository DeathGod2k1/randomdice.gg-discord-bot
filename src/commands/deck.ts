import * as Discord from 'discord.js';
import * as admin from 'firebase-admin';
import cache, { Deck, EmojiList } from '../helper/cache';

export default async function decklist(
    message: Discord.Message,
    database: admin.database.Database
): Promise<void> {
    const { content, channel } = message;
    const [, , type, page] = content.split(' ');
    if (!type?.match(/^(pvp|co-op|coop|crew)$/)) {
        await channel.send(
            `${
                type ? `\`${type}\` is not a valid deck type, p` : 'P'
            }lease specify deck type in: \`PvP\` \`Co-op\` \`Crew\``
        );
        return;
    }

    const [emoji, decks] = await Promise.all([
        cache(database, 'discord_bot/emoji') as Promise<EmojiList>,
        cache(database, 'decks') as Promise<Deck[]>,
    ]);
    const deckType = ({
        pvp: 'PvP',
        coop: 'Co-op',
        'co-op': 'Co-op',
        crew: 'Crew',
    } as { [key: string]: string })[type.toLowerCase()];
    const fields = decks
        .filter(deck => deckType === deck.type)
        .map(deckInfo => ({
            rating: deckInfo.rating.default,
            diceList: deckInfo.decks
                .map(deck => deck.map(die => emoji[die]).join(''))
                .join('\n'),
        }))
        .map(deck => ({
            name: deck.rating,
            value: deck.diceList,
        }));
    const pageNumbers = Math.ceil(fields.length / 10);
    let currentPage = 0;
    if (Number(page) >= 0) {
        currentPage = Number(page) - 1;
        if (currentPage > pageNumbers) {
            currentPage = pageNumbers - 1;
        }
    }
    const embeds = Array(pageNumbers)
        .fill('')
        .map((_, i) =>
            new Discord.MessageEmbed()
                .setColor('#6ba4a5')
                .setTitle(`Random Dice ${deckType} Deck List`)
                .setAuthor(
                    'Random Dice Community Website',
                    'https://randomdice.gg/title_dice.png',
                    'https://randomdice.gg/'
                )
                .setURL(`https://randomdice.gg/decks/${deckType}`)
                .setDescription(
                    `Showing page ${
                        i + 1
                    } of ${pageNumbers}. Each deck is listed below with a rating. Use the message reaction to flip page.`
                )
                .addFields(fields.slice(i * 10, i * 10 + 10))
                .setFooter(
                    `randomdice.gg Deck List #page ${i + 1}/${pageNumbers}`,
                    'https://randomdice.gg/title_dice.png'
                )
        );
    const sentMessage = await channel.send(embeds[currentPage]);
    if (pageNumbers <= 1) {
        return;
    }
    await sentMessage.react('⏪');
    await sentMessage.react('◀️');
    await sentMessage.react('▶️');
    await sentMessage.react('⏩');
    const collector = sentMessage.createReactionCollector(
        reaction => ['⏪', '◀️', '▶️', '⏩'].includes(reaction.emoji.name),
        {
            time: 180000,
        }
    );

    collector.on('collect', async (reaction, user) => {
        if (reaction.emoji.name === '⏪') {
            currentPage = 0;
        }
        if (reaction.emoji.name === '◀️' && currentPage > 0) {
            currentPage -= 1;
        }
        if (reaction.emoji.name === '▶️' && currentPage < pageNumbers - 1) {
            currentPage += 1;
        }
        if (reaction.emoji.name === '⏩') {
            currentPage = pageNumbers - 1;
        }
        await sentMessage.edit(embeds[currentPage]);
        await reaction.users.remove(user.id);
    });

    collector.on('end', async () => {
        await Promise.all([
            await sentMessage.edit(
                `The reaction commands has expired, please do \`.gg deck ${deckType}\` again to interact with the message.`,
                embeds[currentPage]
            ),
            await sentMessage.reactions.removeAll(),
        ]);
    });
}
