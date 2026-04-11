// @ts-ignore
import { getContext } from "../../../extensions.js";
// @ts-ignore
import { getCurrentChatId } from '../../../../script.js';
// @ts-ignore
import { loadWorldInfo, createWorldInfoEntry, saveWorldInfo, reloadEditor, createNewWorldInfo } from '../../../world-info.js';
const MODULE_NAME = 'LenorioGarden';
export async function readFromLorebookV2(subSection, logTitle) {
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
export async function writeToLorebookV3(opts) {
    const { subSection, logTitle, logContent, keywords = [], disabled = true, constant = false, order, } = opts;
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
    if (!lorebookData || Object.keys(lorebookData.entries ?? {}).length === 0) {
        console.log(`Book not found with name ${bookName}. Creating it now.`);
        const created = await createNewWorldInfo(bookName, { interactive: false });
        if (!created) {
            toastr.error(`Failed to create lorebook: ${bookName}`);
            return;
        }
        lorebookData = await loadWorldInfo(bookName);
        if (!lorebookData) {
            toastr.error(`Lorebook still not found after creation: ${bookName}`);
            return;
        }
    }
    let entry = getEntryByComment(lorebookData, logTitle);
    if (entry) {
        console.log(`Updating existing entry: ${logTitle}`);
    }
    else {
        console.log(`Creating new entry: ${logTitle}`);
        entry = createWorldInfoEntry(bookName, lorebookData);
    }
    entry.comment = logTitle;
    entry.content = logContent;
    entry.key = Array.isArray(keywords) ? keywords : [];
    entry.disable = constant ? false : disabled;
    entry.constant = constant;
    if (constant && order !== undefined)
        entry.order = order;
    await saveWorldInfo(bookName, lorebookData, true);
    await reloadEditor(bookName);
}
function getEntryByComment(lorebookData, title) {
    return Object.values(lorebookData.entries).find(entry => entry.comment === title);
}
function safeSlug(str) {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 100);
}
function getLoreBookName(subsection) {
    const context = getContext();
    if (context.characterId === undefined) {
        return null;
    }
    console.log("CurrentChat:" + getCurrentChatId());
    const newLorebookName = safeSlug(`${MODULE_NAME}-${getCurrentChatId()}-${subsection}`);
    return newLorebookName;
}
