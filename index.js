// The main script for the extension
// The following are examples of some basic extension functionality

//You'll likely need to import extension_settings, getContext, and loadExtensionSettings from extensions.js
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";

//You'll likely need to import some other functions from the main script
import { saveSettingsDebounced } from "../../../../script.js";
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";
import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../slash-commands/SlashCommandArgument.js';
import {
    METADATA_KEY,
    loadWorldInfo,
    createWorldInfoEntry,
    saveWorldInfo,
    reloadEditor
} from '../../../world-info.js';

// Keep track of where your extension is located, name should match repo name
const extensionName = "MySummarizer";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};

import { getCurrentChatId, name1, name2, chat_metadata, saveMetadata } from '../../../../script.js';
import { write } from "node:fs";

const MODULE_NAME = 'LenorioGarden';
let context = undefined;

if (!extension_settings[MODULE_NAME]) {
    extension_settings[MODULE_NAME] = {
        debug_logs: [],
        last_run: null
    };
}
 
// Loads the extension settings if they exist, otherwise initializes them to the defaults.
async function loadSettings() {
  //Create the settings if they don't exist
  extension_settings[extensionName] = extension_settings[extensionName] || {};
  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
  }

  // Updating settings in the UI
  $("#example_setting").prop("checked", extension_settings[extensionName].example_setting).trigger("input");
}

// This function is called when the extension settings are changed in the UI
function onExampleInput(event) {
  const value = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].example_setting = value;
  saveSettingsDebounced();
}

// This function is called when the button is clicked
function onButtonClick() {
  // You can do whatever you want here
  // Let's make a popup appear with the checked setting
  // toastr.info(
  //   `The checkbox is ${extension_settings[extensionName].example_setting ? "checked" : "not checked"}`,
  //   "A popup appeared because you clicked the button!"
  // );
  toastr.info(
    "?????"
  );
  addSlashCommands();
}

// This function is called when the extension is loaded
jQuery(async () => {
  // This is an example of loading HTML from a file
  const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);

  // Append settingsHtml to extensions_settings
  // extension_settings and extensions_settings2 are the left and right columns of the settings menu
  // Left should be extensions that deal with system functions and right should be visual/UI related 
  $("#extensions_settings").append(settingsHtml);

  // These are examples of listening for events
  $("#my_button").on("click", onButtonClick);
  $("#example_setting").on("input", onExampleInput);

  // Load settings when starting things up (if you have any)
  loadSettings();

  console.log("Im online bitches.");
});

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
        .substring(0, 50);
}

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'plenorio',
    callback: () => {
        testCommand()
    },
    returns: 'testing stuff, dont worry about it!',
}));

async function testCommand(){
    console.log("test!")
    context = getContext();
    await readFromLorebookCurrentVisibleChat();
}

/**
 * Key to entry name for visible chat content.
 * @type {String|null}
 */
const KEY_DEBUG_CHAT_CONTENT = "my_debug";
const KEY_DEBUG_SCENE_BREAKDOWN = "scene_breakdown";

async function readFromLorebookCurrentVisibleChat(){
    try {
      if (context.characterId === undefined){
          toastr.info(
            context.characterId === undefined
          );
        return;
      }
      await commandSendLLMTask_BreakScenes();
      toastr.info(`Send and updated`);
    } catch (error) {
        console.error('readFromLorebookCurrentVisibleChat error:', error);
        return { success: false, error: ('readFromLorebookCurrentVisibleChat', 'writeToLorebookCurrentVisibleChat-message: {{message}}', { message: error.message }) };
    }
}

async function writeToLorebookCurrentVisibleChat(){
    try {
      if (context.characterId === undefined){
          toastr.info(
            context.characterId === undefined
          );
        return;
      }
      console.log("CharacterId:", context.characterId)
      const chatHistory = context.chat;

      if (!(chatHistory && chatHistory.length > 0)){
        toastr.info("guard clause !(chatHistory && chatHistory.length > 0)")
        return;
      }
          // Filter out messages that are system notes or manually hidden
          const visibleMessages = chatHistory.filter(msg => {
              return !msg.is_system && !msg.force_hide && !msg.is_extra;
          });
          const strAcumulador = visibleMessages
              //.slice(-3)
              .map(msg => `${msg.name}: ${msg.mes}`)
              .join("\n");
          console.log(strAcumulador); 
          toastr.info(`size of msg: ${strAcumulador.length}`);
          await logToLorebook(KEY_DEBUG_CHAT_CONTENT, strAcumulador);
    } catch (error) {
        console.error('writeToLorebookCurrentVisibleChat error:', error);
        return { success: false, error: ('writeToLorebookCurrentVisibleChat', 'writeToLorebookCurrentVisibleChat-message: {{message}}', { message: error.message }) };
    }
}

function getLoreBookName(){
  if (context.characterId === undefined){
    return null;
  }
  const newLorebookName = safeSlug(`${MODULE_NAME}-${getCurrentChatId()}`)
  return newLorebookName;
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

async function commandSendLLMTask_BreakScenes(){
  try {
    let content = await readFromLorebook(KEY_DEBUG_CHAT_CONTENT);

    if (!content){
      console.log("!content");
      return;
    }
    console.log("Content read");
    const { generateRaw } = getContext();

    const systemPrompt = 
    `
    You are an expert narrative analyst and story chronicler. You will be provided with the text of a roleplay adventure. Your objective is to segment the narrative into distinct scenes and extract deep psychological and narrative data from each.

    ### DEFINITION OF A SCENE:
      - A new scene begins when there is a significant change in location, a jump in time, or a major shift in the characters present. 
      - ONLY analyze scenes that contain MORE THAN ONE active character. Skip solo scenes or internal monologues entirely.

    ### INSTRUCTIONS:
      For every valid scene, extract the information and format your response EXACTLY using the template below. 

    ### OUTPUT TEMPLATE:
      **Scene [Number]: [Provide a catchy, 3-5 word title]**
      * **Short Description:** [A 1-2 sentence summary of the scene's core event.]
      * **Long Description:** [A detailed paragraph explaining what happened, the context, and how the scene progressed from beginning to end.]
      * **Key Plot Revelation:** [Optional: 1 sentence noting any important lore, secrets, or plot progression revealed here.]
      * **Participants Analysis:**
      *(Repeat the following block for EVERY active character in the scene)*
      * **Character Name:** [Name]
        * **Feelings:** [Emotion 1, Emotion 2, Emotion 3][Emotion examples: Happy, Sad, Angry, Fearful, Disgusted, Surprised, Excited, Embarrased, Flirty, Neutral]
        * **Perception of Interaction:** [Must be exactly one of: Very Negative, Negative, Neutral, Positive, Very Positive]
        * **Reasoning:** [1 sentence justifying their perception based on the text]
    ***
    Begin your analysis with Scene 1 based on the provided text.
    `;
    // const prefill = '';

    // const result = await generateRaw({
    //     systemPrompt,
    //     content,
    //     prefill,
    // });
    // console.log("prompt sent");
    await logToLorebook(KEY_DEBUG_SCENE_BREAKDOWN, systemPrompt);
    console.log("lorebook created");
  }catch (error) {
        console.error('readFromLorebookCurrentVisibleChat error:', error);
        return { success: false, error: ('readFromLorebookCurrentVisibleChat', 'writeToLorebookCurrentVisibleChat-message: {{message}}', { message: error.message }) };
  }
}

async function readFromLorebook(logTitle){
    // 1. Load the Lorebook data
    // If the book doesn't exist, this returns an empty object or fails
    const bookName = getLoreBookName();

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
        console.log(`Entry with name ${logTitle}. not found.`);
        return;
    }
    const result = await generateRaw({
        systemPrompt,
        prompt,
        prefill,
    });
    
    return entry.content;
}

async function logToLorebook(logTitle, logContent) {
    // 1. Load the Lorebook data
    // If the book doesn't exist, this returns an empty object or fails
    const bookName = getLoreBookName();

    if (!bookName){
      toastr.info("!bookName");
      return;
    }
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
    
    // We ensure it has an array for keys even if empty
    if (!Array.isArray(entry.key)) entry.key = [];

    // 5. Save the data back to the server
    await saveWorldInfo(bookName, lorebookData, true);

    // 6. Refresh the UI
    reloadEditor(bookName);
    toastr.info("Entry uploaded successfully");
}