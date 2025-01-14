import Discord from 'discord.js';

let timeout: NodeJS.Timeout;
export default async function chatRevivePing(
    message: Discord.Message
): Promise<void> {
    const { channel } = message;
    if (channel.id !== '804222694488932364') {
        return;
    }

    if (timeout) {
        clearTimeout(timeout);
    }
    timeout = setTimeout(
        async () =>
            channel.send(
                '<@&807578981003689984> come and revive this dead chat.'
            ),
        1000 * 60 * 60
    );
}

export async function fetchGeneralOnBoot(
    client: Discord.Client
): Promise<void> {
    const guild = await client.guilds.fetch('804222694488932362');
    const general = guild.channels.cache.get('804222694488932364');
    if (!general?.isText()) return;
    try {
        const lastMessages = await general.messages.fetch();
        const lastMessage = lastMessages
            .filter(message => !message.author.bot)
            .first();
        if (!lastMessage) return;
        const deadChatTimer = Date.now() - lastMessage.createdTimestamp;
        const tenMinutes = 1000 * 60 * 60;
        if (!timeout) {
            timeout = setTimeout(
                async () =>
                    general.send(
                        '<@&807578981003689984> come and revive this dead chat.'
                    ),
                tenMinutes - deadChatTimer
            );
        }
    } catch {
        // suppress error
    }
}
