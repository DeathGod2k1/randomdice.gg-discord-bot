import axios from 'axios';
import Discord from 'discord.js';
import cooldown from '../util/cooldown';

const snipeStore = {
    snipe: new Map<
        string,
        {
            message: Discord.Message;
            attachments: {
                attachment: Discord.BufferResolvable;
                name?: string;
            }[];
        }[]
    >(),
    editsnipe: new Map<
        string,
        {
            message: Discord.Message;
            attachments: {
                attachment: Discord.BufferResolvable;
                name?: string;
            }[];
        }[]
    >(),
};

export async function snipeListener(
    type: 'edit' | 'delete',
    message: Discord.Message | Discord.PartialMessage
): Promise<void> {
    if (message.partial) {
        if (type === 'delete') {
            return;
        }
        // eslint-disable-next-line no-param-reassign
        message = await message.fetch();
    }

    const { guild, channel, author } = message;

    if (guild?.id !== process.env.COMMUNITY_SERVER_ID || author.bot) {
        return;
    }

    const attachments: {
        attachment: Discord.BufferResolvable;
        name?: string;
    }[] = [];
    if (type === 'delete') {
        await Promise.all(
            message.attachments.map(async attachment => {
                const response = await axios.get(attachment.url, {
                    responseType: 'arraybuffer',
                });
                attachments.push({
                    attachment: response.data,
                    name: attachment.name || undefined,
                });
            })
        );
        snipeStore.snipe.set(channel.id, [
            { message, attachments },
            ...(snipeStore.snipe.get(channel.id) || []),
        ]);
    } else {
        snipeStore.editsnipe.set(channel.id, [
            { message, attachments: [] },
            ...(snipeStore.editsnipe.get(channel.id) || []),
        ]);
    }
}

export default async function snipe(message: Discord.Message): Promise<void> {
    const { member, channel, content, author } = message;
    const [command, arg] = content.split(' ');

    if (
        !member ||
        (await cooldown(message, command, {
            default: 10 * 1000,
            donator: 2 * 1000,
        }))
    ) {
        return;
    }

    if (
        !(
            member.roles.cache.has('804512584375599154') ||
            member.roles.cache.has('804231753535193119') ||
            member.roles.cache.has('806896328255733780') ||
            member.roles.cache.has('805388604791586826')
        )
    ) {
        await channel.send({
            embeds: [
                new Discord.MessageEmbed()
                    .setTitle(`You cannot use ${command?.toLowerCase()}`)
                    .setColor('#ff0000')
                    .setDescription(
                        'You need one of the following roles to use this command.\n' +
                            '<@&804512584375599154> <@&804231753535193119> <@&806896328255733780> <@&805388604791586826>'
                    ),
            ],
        });
        return;
    }

    let snipeIndex = 0;
    if (
        !Number.isNaN(arg) &&
        Number.isInteger(Number(arg)) &&
        Number(arg) > 0
    ) {
        snipeIndex = Number(arg) - 1;
    }

    if (
        snipeIndex &&
        !(
            member.roles.cache.has('804512584375599154') ||
            member.roles.cache.has('809142956715671572')
        )
    ) {
        await channel.send({
            embeds: [
                new Discord.MessageEmbed()
                    .setTitle(
                        `You cannot use enhanced ${command?.toLowerCase()} with snipe index.`
                    )
                    .setColor('#ff0000')
                    .setDescription(
                        'To use enhanced snipe to snipe with index\n' +
                            'You need one of the following roles to use this command.\n' +
                            '<@&804512584375599154> <@&809142956715671572>\n'
                    ),
            ],
        });
        return;
    }

    const snipedList = snipeStore[
        command?.toLowerCase().replace('!', '') as 'snipe' | 'editsnipe'
    ].get(channel.id);

    if (!snipedList?.length) {
        await channel.send("There's nothing to snipe here");
        return;
    }
    const snipeIndexTooBig = typeof snipedList[snipeIndex] === 'undefined';
    const sniped = snipeIndexTooBig ? snipedList[0] : snipedList[snipeIndex];
    const [snipedMessage, snipedAttachments] = [
        sniped.message,
        sniped.attachments,
    ];

    let embed = new Discord.MessageEmbed()
        .setAuthor(
            `${snipedMessage.author.username}#${snipedMessage.author.discriminator}`,
            snipedMessage.author.displayAvatarURL({
                dynamic: true,
            })
        )
        .setDescription(snipedMessage.content)
        .setFooter(
            `snipedMessage by: ${author.username}#${author.discriminator}`
        )
        .setTimestamp();

    if (
        snipedMessage.member &&
        snipedMessage.member.displayHexColor !== '#000000'
    ) {
        embed = embed.setColor(snipedMessage.member?.displayHexColor);
    }

    if (snipedAttachments.length) {
        embed.addField(
            `With Attachment${snipedAttachments.length > 1 ? 's' : ''}`,
            snipedAttachments.map(attachment => attachment.name).join('\n')
        );
    }

    await channel.send({
        content: snipeIndexTooBig
            ? `The snipe index ${snipeIndex + 1} is too big, there are only ${
                  snipedList.length
              } of messages to be sniped, sniping the most recent message instead.`
            : undefined,
        embeds: [embed],
        files: snipedAttachments,
    });
}
