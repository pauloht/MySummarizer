import { getContext } from "../../../extensions.js";
import { getCurrentChatId } from '../../../../script.js';
import {
    loadWorldInfo,
    createWorldInfoEntry,
    saveWorldInfo,
    reloadEditor
} from '../../../world-info.js';
const MODULE_NAME = 'LenorioGarden';

export async function Map(key, value){
    if (MAPPING[key]){
        console.log("Already mapped for " + key);
        return;
    }
    MAPPING[key] = value;
}

export async function readFromLorebookV2(subSection, logTitle){
    // 1. Load the Lorebook data
    // If the book doesn't exist, this returns an empty object or fails
    const bookName = getLoreBookName(subSection);

    if (!bookName){
      toastr.info("!bookName");
      return;
    }
    let lorebookData = await loadWorldInfo(bookName);

    if (!lorebookData || Object.keys(lorebookData).length === 0) {
        console.log(`Book not found with name ${bookName}. You might need to create the book first or check your name.`);
        return;
    }
    // 2. Check if an entry with this title already exists
    let entry = getEntryByComment(lorebookData, logTitle);

    if (!entry){
        console.log(`Entry with name ${logTitle}  not found.`);
        return;
    }    
    return entry.content;
}

export async function writeToLorebookV2(
    subSection, logTitle, logContent, keywords = [], disabled = false) {
    // 1. Load the Lorebook data
    // If the book doesn't exist, this returns an empty object or fails
    const bookName = getLoreBookName(subSection);

    if (!bookName){
      toastr.info("!bookName");
      return;
    }
    if (!subSection){
      toastr.info("!subSection");
      return; 
    }
    if (!logTitle){
      toastr.info("!logTitle");
      return; 
    }
    console.log("writing to lorebook " + bookName);
    let lorebookData = await loadWorldInfo(bookName);

    // 2. Check if the book was actually loaded
    // (If world_info_data doesn't have it, it might be a new book)
    if (!lorebookData || Object.keys(lorebookData).length === 0) {
        console.log(`Book not found with name ${bookName}. You might need to create the book first or check your name.`);
        // Note: Creating a brand new book file usually requires a separate call 
        // to createWorldInfoBook(bookName), but let's assume it exists for now.
        return;
    }

    // 2. Check if an entry with this title already exists
    let entry = getEntryByComment(lorebookData, logTitle);
    
    if (entry) {
        console.log(`Updating existing entry: ${logTitle}`);
    } else {
        console.log(`Creating new entry: ${logTitle}`);
        // 3. Only create if it doesn't exist
        entry = createWorldInfoEntry(bookName, lorebookData);
    }

    // 4. Update the fields (whether new or existing)
    entry.comment = logTitle; 
    entry.content = logContent;
    entry.key = Array.isArray(keywords) ? keywords : [];
    entry.disabled = true;
    
    // We ensure it has an array for keys even if empty
    if (!Array.isArray(entry.key)) entry.key = [];

    // 5. Save the data back to the server
    await saveWorldInfo(bookName, lorebookData, true);

    // 6. Refresh the UI
    await reloadEditor(bookName);
    //toastr.info("Entry uploaded successfully");
}

/**
 * Finds an entry by its comment/title
 * @param {Object} lorebookData 
 * @param {string} title 
 */
function getEntryByComment(lorebookData, title) {
    // lorebookData.entries is an object where keys are UIDs. 
    // We turn it into an array of values to search through it.
    return Object.values(lorebookData.entries).find(entry => entry.comment === title);
}

/**
 * Generates a safe slug from a string
 * @param {string} str - String to slugify
 * @returns {string} Safe slug
 */
function safeSlug(str) {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 100);
}

function getLoreBookName(subsection){
    const context = getContext();
    if (context.characterId === undefined){
    return null;
    }
    console.log("CurrentChat:" + getCurrentChatId());
    const newLorebookName = safeSlug(`${MODULE_NAME}-${getCurrentChatId()}-${subsection}`);
    return newLorebookName;
}