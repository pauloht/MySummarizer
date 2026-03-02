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
const defaultSettings = {};

import { getCurrentChatId } from '../../../../script.js';

const MODULE_NAME = 'LenorioGarden';
let context = undefined;


/**
 * Key to entry name for visible chat content.
 * @type {String|null}
 */
const KEY_DEBUG_CHAT_CONTENT = "my_debug";
/**
 * Key to entry xml process content
 * @type {String|null}
 */
const KEY_DEBUG_XML_SCENE_BREAKDOWN = "scene_breakdown";
/**
 * Hold all characters ever found in the adventure.
 * @type {String|null}
 */
const KEY_INTERNALINFO_ARRAY_CHARACTERS = "characters_list";


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

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'plenorio_processCharacterData',
    callback: () => {
        processCharacterData()
    },
    returns: `Create xml file from lorebook entry ${KEY_DEBUG_CHAT_CONTENT} and create xml file at entry ${KEY_DEBUG_XML_SCENE_BREAKDOWN}`,
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'plenorio',
    callback: () => {
        testCommand()
    },
    returns: `temporary command for testing`,
}));

async function testCommand(){
    console.log("testCommand!")
    context = getContext();
    const result = await readFromLorebook(KEY_DEBUG_XML_SCENE_BREAKDOWN);

    if (!result){
      console.error(`Failed to retrieve logbook entry ${KEY_DEBUG_XML_SCENE_BREAKDOWN}`);
      return "";
    }
    await processNarrativeXML(result);
}

async function processCharacterData(){
    console.log("processCharacterData!")
    context = getContext();
    const prompt = await writeToLorebookCurrentVisibleChat();
    await readFromLorebookCurrentVisibleChat(prompt);
    return "";
}

async function readFromLorebookCurrentVisibleChat(prompt){
    try {
      if (context.characterId === undefined){
          toastr.info(
            context.characterId === undefined
          );
        return;
      }
      await commandSendLLMTask_BreakScenes(prompt);
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
          await writeToLorebook(KEY_DEBUG_CHAT_CONTENT, strAcumulador);
          return strAcumulador;
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

async function commandSendLLMTask_BreakScenes(prompt){
  let toast = null;
  try {
    if (!prompt){
      console.log("!prompt");
      return;
    }
    if (prompt.length <= 10){
      console.log("small prompt?");
      return;
    }
    console.log(`prompt read wit size ${prompt.length}`);
    const generateRaw  = context.generateRaw;
    const systemPrompt =   
`You are an expert narrative analyst and story chronicler. You will be provided with the text of a roleplay adventure. Your objective is to segment the narrative into distinct scenes and extract deep psychological and narrative data from each.

### DEFINITION OF A SCENE:
- A new scene begins when there is a significant change in location, a jump in time, or a major shift in the characters present. 
- ONLY analyze scenes that contain MORE THAN ONE active character.

### CONSTRAINTS & VALIDATION:
1. **Allowed Emotions:** You MUST choose emotions ONLY from this list: [Happy, Sad, Angry, Fearful, Disgusted, Surprised, Excited, Embarrassed, Flirty, Neutral].
2. **Emotion Count:** Provide at least ONE emotion. You may provide up to THREE if the context supports it, but do not force more than one if it is not present in the text.
3. **Perception:** Must be exactly one of: [Very Negative, Negative, Neutral, Positive, Very Positive].

### OUTPUT TEMPLATE:
Wrap your response in <narrative_analysis>. Use the following XML structure:

<scene number="[Number]">
  <title>[3-5 word title]</title>
  <short_description>[1-2 sentence summary]</short_description>
  <participants>
    <character>
      <name>[Character Name]</name>
      <feelings>
        <emotion>[Primary Emotion]</emotion>
        <emotion>[Secondary Emotion - Optional]</emotion>
        <emotion>[Tertiary Emotion - Optional]</emotion>
      </feelings>
      <perception>[Allowed Value]</perception>
      <reasoning>[1 sentence justification]</reasoning>
    </character>
  </participants>
</scene>

Begin your analysis with Scene 1 based on the provided text.
`
    toast = toastr.info("LLM is thinking...", null, { 
    timeOut: 0, 
    extendedTimeOut: 0,
    tapToDismiss: false // Optional: prevents user from clicking it away early
    });
    const prefill = '';
    const result = await generateRaw({
        systemPrompt,
        prompt,
        prefill,
    });
    console.log("prompt sent");
    await writeToLorebook(KEY_DEBUG_XML_SCENE_BREAKDOWN, result);
    console.log("lorebook created");
    //await processNarrativeXML(result);
  }catch (error) {
        console.error('readFromLorebookCurrentVisibleChat error:', error);
        return { success: false, error: ('readFromLorebookCurrentVisibleChat', 'writeToLorebookCurrentVisibleChat-message: {{message}}', { message: error.message }) };
  }finally{
    if (toast){
      toastr.clear(toast);
    }
  }
}

async function processNarrativeXML(rawLLMOutput) {
    // 1. Pre-cleaning: LLMs often add "Sure, here is the analysis:" before the XML.
    // This regex finds the actual <narrative_analysis> block.
    const xmlMatch = rawLLMOutput.match(/<narrative_analysis>[\s\S]*<\/narrative_analysis>/);
    
    if (!xmlMatch) {
        console.error("No valid XML block found in the response.");
        return null; // Early return if no tags are found at all
    }

    const xmlString = xmlMatch[0];

    // 2. Parse the string
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    // 3. CHECK FOR ERRORS (The "Early Return")
    const errorNode = xmlDoc.querySelector("parsererror");
    if (errorNode) {
        console.error("XML Parsing Error:", errorNode.textContent);
        return null; // Early return if the XML is broken/malformatted
    }

    // 4. Success! Proceed with data extraction
    return await extractData(xmlDoc);
}

function getUniqueCharacters(scenes) {
    // 1. Create a Set to store unique names
    const characterSet = new Set();

    // 2. Loop through every scene
    scenes.forEach(scene => {
        // 3. Loop through every participant in that scene
        scene.participants.forEach(char => {
            // Trim whitespace and ensure we have a name before adding
            if (char.name) {
                characterSet.add(char.name.trim());
            }
        });
    });

    // 4. Convert the Set back into a normal Array
    return Array.from(characterSet).sort(); // Optional: .sort() alphabetizes them
}

async function extractData(xmlDoc){
    // 2. Extract the Scenes
    const scenes = Array.from(xmlDoc.getElementsByTagName("scene")).map(scene => {
      return {
        number: scene.getAttribute("number"),
        title: scene.getElementsByTagName("title")[0]?.textContent,
        shortDescription: scene.getElementsByTagName("short_description")[0]?.textContent,
        
        // 3. Extract Characters within the scene
        participants: Array.from(scene.getElementsByTagName("character")).map(char => {
          return {
            name: char.getElementsByTagName("name")[0]?.textContent,
            perception: char.getElementsByTagName("perception")[0]?.textContent,
            reasoning: char.getElementsByTagName("reasoning")[0]?.textContent,
            // 4. Extract list of emotions
            emotions: Array.from(char.getElementsByTagName("emotion")).map(e => e.textContent)
          };
        })
      };
    });
    // 1. Safety check: make sure scenes exists before continuing
    if (!scenes || scenes.length === 0) {
        console.log("No scenes to process.");
        return;
    }

    // 2. Get the unique characters found in the NEW LLM response
    const currentDetectedCharacters = getUniqueCharacters(scenes);
    console.log("Characters found in this analysis:", currentDetectedCharacters);

    // 3. Read existing list from Lorebook
    let rawLorebookData = await readFromLorebook(KEY_INTERNALINFO_ARRAY_CHARACTERS);
    let knownCharacters = []; // Default to empty array

    // 4. Parse the lorebook data safely
    if (rawLorebookData) {
        try {
            // We parse the data we READ, not the empty object
            knownCharacters = JSON.parse(rawLorebookData);
        } catch (e) {
            console.error("Error parsing lorebook data, starting fresh.", e);
            knownCharacters = [];
        }
    }
    // 5. Find characters that are in currentDetectedCharacters but NOT in knownCharacters
    const newCharacters = currentDetectedCharacters.filter(name => !knownCharacters.includes(name));

    if (newCharacters.length > 0) {
        console.log("New characters discovered:", newCharacters);

        // 6. Process the new characters (e.g., your custom logic)
        await processNewCharacters(newCharacters);

        // 7. Update the known list: Combine old list + new list
        const updatedCharacterList = [...knownCharacters, ...newCharacters];

        // 8. Save the FULL updated list back to the lorebook
        // Use the combined list, otherwise you overwrite and lose your old characters!
        await writeToLorebook(KEY_INTERNALINFO_ARRAY_CHARACTERS, JSON.stringify(updatedCharacterList));
        
        console.log("Lorebook updated successfully.");
    } else {
        console.log("No new characters found. Lorebook is already up to date.");
    }
    await updateCharacterMemories(scenes);
}

async function processNewCharacters(characters){
  console.log(`process character todo - ${characters}`);
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
        console.log(`Entry with name ${logTitle}  not found.`);
        return;
    }    
    return entry.content;
}

async function writeToLorebook(logTitle, logContent, keywords = []) {
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
    entry.key = Array.isArray(keywords) ? keywords : [];
    
    // We ensure it has an array for keys even if empty
    if (!Array.isArray(entry.key)) entry.key = [];

    // 5. Save the data back to the server
    await saveWorldInfo(bookName, lorebookData, true);

    // 6. Refresh the UI
    reloadEditor(bookName);
    //toastr.info("Entry uploaded successfully");
}

async function updateCharacterMemories(scenes){
  const MEMORY_LIMIT = 5; // How many memories to keep per character

  async function _updateCharacterMemories(scenes) {
      if (!scenes) return;

      // 1. Group new data by character name
      // We do this because a character might appear in multiple scenes in one batch
      const newCharacterMemories = {};

      scenes.forEach(scene => {
          scene.participants.forEach(char => {
              const name = char.name.trim();
              if (!newCharacterMemories[name]) newCharacterMemories[name] = [];
              // Create a small data object for this specific memory
              newCharacterMemories[name].push({
                  shortDescription: scene.shortDescription,
                  title: scene.title,
                  feelings: char.emotions.join(", "),
                  perception: char.perception,
                  reasoning: char.reasoning
              });
          });
      });

      // 2. Iterate through every character we found data for
      for (const name in newCharacterMemories) {
          const loreKey = `${name}_memory`;
          
          // Read existing memory lorebook entry
          let rawData = await readFromLorebook(loreKey);
          let memoryList = [];

          // 3. If lorebook exists, parse the existing XML into a list
          if (rawData) {
              memoryList = parseExistingMemoryXML(rawData);
          }

          // 4. Add the new memories from this batch to the list
          const updatedList = [...memoryList, ...newCharacterMemories[name]];

          // 5. Keep only the LAST X entries (Pruning)
          const prunedList = updatedList.slice(-MEMORY_LIMIT);

          // 6. Convert the list back into an XML string
          const finalXML = serializeMemoriesToXML(name, prunedList);

          // 7. Save back to the Lorebook
          const keywords = [name, `${name}'s`];
          console.log("xml:" + finalXML);
          await writeToLorebook(loreKey, finalXML, keywords);
          console.log(`Updated memory for ${name}. Total memories stored: ${prunedList.length}`);
          //break;
      }
  }

  /** 
   * HELPER: Converts XML string from Lorebook back into a JS Array
   */
  function parseExistingMemoryXML(xmlString) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, "text/xml");
      
      // Check for errors
      if (xmlDoc.querySelector("parsererror")) return [];

      return Array.from(xmlDoc.getElementsByTagName("memory")).map(m => ({
          memoryOwner: m.querySelector("memoryOwner")?.textContent,
          shortDescription: m.querySelector("shortDescription")?.textContent,
          feelings: m.querySelector("feelings")?.textContent,
          perception: m.querySelector("perception")?.textContent,
          reasoning: m.querySelector("reasoning")?.textContent
      }));
  }

  /** 
   * HELPER: Converts JS Array back into an XML string for the Lorebook
   */
  function serializeMemoriesToXML(memoryOwner, list) {
      console.log("Serializando...");
      console.log(list);
      let xml = `<memories>\n`;
      list.forEach(m => {
          xml += `  <memory>
    <memoryOwner>${memoryOwner}</memoryOwner>
    <shortDescription>${m.shortDescription}</shortDescription>
    <feelings>${m.feelings}</feelings>
    <perception>${m.perception}</perception>
    <reasoning>${m.reasoning}</reasoning>
  </memory>\n`;
      });
      xml += `</memories>`;
      return xml;
  }

  await _updateCharacterMemories(scenes);
}