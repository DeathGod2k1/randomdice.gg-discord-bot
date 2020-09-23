import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';

export interface News {
    game: string;
    website: string;
}

export interface DeckGuide {
    id: number;
    name: string;
    type: 'PvP' | 'Co-op' | 'Crew';
    diceList: Dice['id'][][];
    guide: string;
}

interface Alternatives {
    desc: string;
    list: Array<Dice['name']>;
}

interface ArenaValue {
    type: 'Main Dps' | 'Assist Dps' | 'Slow' | 'Value';
    assist: number;
    dps: number;
    slow: number;
    value: number;
}

export interface Dice {
    id: number;
    name: string;
    type: 'Physical' | 'Magic' | 'Buff' | 'Merge' | 'Transform';
    desc: string;
    detail: string;
    img: string;
    target: 'Front' | 'Strongest' | 'Random' | 'Weakest' | '-';
    rarity: 'Common' | 'Rare' | 'Unique' | 'Legendary';
    atk: number;
    spd: number;
    eff1: number;
    eff2: number;
    nameEff1: string;
    nameEff2: string;
    unitEff1: string;
    unitEff2: string;
    cupAtk: number;
    cupSpd: number;
    cupEff1: number;
    cupEff2: number;
    pupAtk: number;
    pupSpd: number;
    pupEff1: number;
    pupEff2: number;
    alternatives?: Alternatives;
    arenaValue: ArenaValue;
}

export interface EmojiList {
    [key: number]: string;
}

export interface Registry {
    [key: string]: {
        guide: string;
        news: string;
    };
}

declare const globalThis: {
    news?: News;
    // eslint-disable-next-line camelcase
    decks_guide?: DeckGuide[];
    dice: Dice[];
    'discord_bot/emoji'?: EmojiList;
    'discord_bot/registry'?: Registry;
};

type Data = News | DeckGuide[] | Dice[] | EmojiList | Registry;

export default async function getData(
    database: admin.database.Database,
    target:
        | 'decks_guide'
        | 'dice'
        | 'news'
        | 'discord_bot/emoji'
        | 'discord_bot/registry'
): Promise<Data> {
    const cachePath = (location: string): string =>
        path.resolve(__dirname, '..', 'cache', `${location}.json`);
    const localVersion = JSON.parse(
        fs.readFileSync(cachePath('last_updated'), {
            encoding: 'utf8',
            flag: 'w+',
        }) || '{}'
    );
    const remoteVersion = (
        await database.ref(`/last_updated/${target}`).once('value')
    ).val();
    if (localVersion[target] === remoteVersion) {
        return JSON.parse(
            fs.readFileSync(cachePath(target), {
                encoding: 'utf8',
                flag: 'w+',
            }) || 'null'
        );
    }

    const newData = (await database.ref(`/${target}`).once('value')).val();
    localVersion[target] = remoteVersion;

    await Promise.all([
        await new Promise((resolve, reject) =>
            fs.writeFile(
                cachePath('last_updated'),
                JSON.stringify(localVersion),
                err => (err ? reject(err) : resolve())
            )
        ),
        await new Promise((resolve, reject) =>
            fs.writeFile(cachePath(target), JSON.stringify(newData), err =>
                err ? reject(err) : resolve()
            )
        ),
    ]);
    return newData;
}
