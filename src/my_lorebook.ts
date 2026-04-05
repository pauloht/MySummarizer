// @ts-ignore
import { getContext } from "../../../extensions.js";
// @ts-ignore
import { getCurrentChatId } from '../../../../script.js';
// @ts-ignore
import {
    loadWorldInfo,
    createWorldInfoEntry,
    saveWorldInfo,
    reloadEditor
} from '../../../world-info.js';

const MODULE_NAME = 'LenorioGarden';

export async function readFromLorebookV2(subSection: string, logTitle: string): Promise<string | undefined> {
    const bookName = getLoreBookName(subSection);

    if (!bookName) {
        toastr.info("!bookName");
        return;
    }
    let lorebookData = await loadWorldInfo(bookName);

    if (!lorebookData || Object.keys(lorebookData).length === 0) {
        console.log(`Book not found with name ${bookName}. You might need to create the book first or check your name.`);
        return;
    }

    let entry = getEntryByComment(lorebookData, logTitle);

    if (!entry) {
        console.log(`Entry with name ${logTitle}  not found.`);
        return;
    }
    return entry.content;
}

export async function writeToLorebookV2(
    subSection: string, logTitle: string, logContent: string, keywords: string[] = [], disabled: boolean = true
): Promise<void> {
    const bookName = getLoreBookName(subSection);

    if (!bookName) {
        toastr.info("!bookName");
        return;
    }
    if (!subSection) {
        toastr.info("!subSection");
        return;
    }
    if (!logTitle) {
        toastr.info("!logTitle");
        return;
    }
    console.log("writing to lorebook " + bookName);
    let lorebookData = await loadWorldInfo(bookName);

    if (!lorebookData || Object.keys(lorebookData).length === 0) {
        console.log(`Book not found with name ${bookName}. You might need to create the book first or check your name.`);
        return;
    }

    let entry = getEntryByComment(lorebookData, logTitle);

    if (entry) {
        console.log(`Updating existing entry: ${logTitle}`);
    } else {
        console.log(`Creating new entry: ${logTitle}`);
        entry = createWorldInfoEntry(bookName, lorebookData);
    }

    entry.comment = logTitle;
    entry.content = logContent;
    entry.key = Array.isArray(keywords) ? keywords : [];
    entry.disable = true;

    if (!Array.isArray(entry.key)) entry.key = [];

    await saveWorldInfo(bookName, lorebookData, true);
    await reloadEditor(bookName);
}

function getEntryByComment(lorebookData: WorldInfoData, title: string): WorldInfoEntry | undefined {
    return Object.values(lorebookData.entries).find(entry => entry.comment === title);
}

function safeSlug(str: string): string {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 100);
}

function getLoreBookName(subsection: string): string | null {
    const context = getContext();
    if (context.characterId === undefined) {
        return null;
    }
    console.log("CurrentChat:" + getCurrentChatId());
    const newLorebookName = safeSlug(`${MODULE_NAME}-${getCurrentChatId()}-${subsection}`);
    return newLorebookName;
}
