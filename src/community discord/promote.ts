import Discord, { DiscordAPIError } from 'discord.js';

const activePromotionCreation = new Map<string, boolean>();

async function createPromotion(
    member: Discord.GuildMember
): Promise<Discord.MessageEmbed | false> {
    const { user } = member;
    const { channel } = await user.send(
        'What type of content do you wish to promote? (e.g. YouTube, Discord Server, Random Dice Crew)'
    );
    let awaitedMessage = await channel.awaitMessages({
        filter: m => !!m.content,
        time: 1000 * 60,
        max: 1,
    });
    const promotionType = awaitedMessage.first();
    if (!promotionType) {
        await user.send('You did not answer the question in time');
        return false;
    }
    await user.send('Please provide a description of your promotion');
    awaitedMessage = await channel.awaitMessages({
        filter: m => !!m.content,
        time: 1000 * 60 * 5,
        max: 1,
    });
    const description = awaitedMessage.first();
    if (!description) {
        await user.send('You did not answer the question in time');
        return false;
    }
    await user.send(
        'Please provide the url for your promotion, or you can say **skip**, make sure the url starts with https:// or http:// or I will ignore it'
    );
    awaitedMessage = await channel.awaitMessages({
        filter: m =>
            /^https?:\/\//i.test(m.content) ||
            m.content.toLowerCase() === 'skip',
        time: 1000 * 60,
        max: 1,
    });
    const url = awaitedMessage.first();
    if (!url) {
        await user.send('You did not answer the question in time');
        return false;
    }
    await user.send('You can provide an image, or say **skip**');
    awaitedMessage = await channel.awaitMessages({
        filter: m => !!m.attachments.size || m.content === 'skip',
        time: 1000 * 60 * 5,
        max: 1,
    });
    const image = awaitedMessage.first();
    if (!image) {
        await user.send('You did not answer the question in time');
        return false;
    }

    let embed = new Discord.MessageEmbed()
        .setAuthor(
            `${user.username}#${user.discriminator}`,
            user.displayAvatarURL()
        )
        .setTitle(`Promotion of ${promotionType}`)
        .setFooter(user.id)
        .setTimestamp();

    if (member.displayColor) {
        embed = embed.setColor(member.displayColor);
    }
    if (url.content && /^https?:\/\//i.test(url.content)) {
        embed = embed.setURL(url.content).addField('Link', url.content);
    }
    if (description.content.toLowerCase() !== 'skip') {
        embed = embed.setDescription(description.content);
    }
    if (image.attachments.first()) {
        embed = embed.setImage(
            (image.attachments.first() as Discord.MessageAttachment).url
        );
    }
    await user.send({
        content:
            'This is how the embed will look, reply `yes` if you confirm to post it, or `no` to redo making the embed.',
        embeds: [embed],
    });
    awaitedMessage = await channel.awaitMessages({
        filter: m => /^(y(:es)?|(no?)$)/i.test(m.content),
        time: 1000 * 60,
        max: 1,
    });
    const confirmation = awaitedMessage.first();
    if (confirmation?.content.match(/^y(es)?$/i)) {
        return embed;
    }
    if (confirmation?.content.match(/^no?$/i)) {
        await user.send("Okay let's try again.");
        return createPromotion(member);
    }
    await user.send('You did not answer the question in time');
    return false;
}

export default async function promote(message: Discord.Message): Promise<void> {
    const { author, member, channel, guild } = message;

    if (!member || !guild) return;
    if (
        !member.roles.cache.has('804513079319592980') &&
        !member.roles.cache.has('809143588105486346')
    ) {
        await channel.send({
            embeds: [
                new Discord.MessageEmbed()
                    .setTitle('Unable to cast command')
                    .setColor('#ff0000')
                    .setDescription(
                        'You need one of the following roles to use this command.\n' +
                            '<@&804513079319592980> <@&809143588105486346>'
                    ),
            ],
        });
        return;
    }

    const promotionChannel = guild.channels.cache.get('860114325007237120');
    if (!promotionChannel?.isText()) {
        throw new Error('Promotion Channel not found');
    }
    const promotions = await promotionChannel.messages.fetch();
    const existingUserPromotion = promotions.find(
        promotion =>
            promotion.embeds?.[0]?.footer?.text === author.id &&
            promotion.createdTimestamp + 1000 * 60 * 60 * 24 > Date.now()
    );
    if (activePromotionCreation.get(author.id)) {
        await channel.send(
            'Please first finish previous the promotion creation or exit it.'
        );
        return;
    }

    try {
        try {
            activePromotionCreation.set(author.id, true);
            await author.send(
                `Hi, please answer a few questions for me to post a promotion advertisement. You can type \`exit\` at anytime to quit this campaign maker.\n${
                    existingUserPromotion
                        ? 'I found a promotion in the last 24 hours from you, your last promotion will be edited instead of sending a new one.'
                        : ''
                }`
            );
            await channel.send('Please proceed in DM channel.');
        } catch (err) {
            if (
                (err as DiscordAPIError).message ===
                'Cannot send messages to this user'
            ) {
                throw new Error('I cannot initial a DM with you.');
            }
            throw err;
        }

        const item = await Promise.race([
            createPromotion(member),
            author.dmChannel?.awaitMessages({
                filter: m => m.content.toLowerCase() === 'exit',
                max: 1,
            }),
        ]);
        const isEmbed = (arg: typeof item): arg is Discord.MessageEmbed =>
            arg instanceof Discord.MessageEmbed;
        if (!isEmbed(item)) {
            activePromotionCreation.set(author.id, false);
            return;
        }
        if (existingUserPromotion) {
            await existingUserPromotion.edit({ embeds: [item] });
            await author.send(
                `Your promotion has been edited\n${existingUserPromotion.url}`
            );
        } else {
            const sent = await promotionChannel.send({ embeds: [item] });
            await author.send(`Your promotion has been sent\n${sent.url}`);
        }
        activePromotionCreation.set(author.id, false);
    } catch (err) {
        activePromotionCreation.set(author.id, false);
        throw err;
    }
}
