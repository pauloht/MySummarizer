// The main script for the extension
// The following are examples of some basic extension functionality

//You'll likely need to import extension_settings, getContext, and loadExtensionSettings from extensions.js
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";

//You'll likely need to import some other functions from the main script
import { parseExistingMemoryXML, serializeMemoriesToXML } from './xmlutil_memory.js';
import { parseCharacterXML, serializeCharactersToXML } from './xmlutil_characters.js';
import { readFromLorebookV2, writeToLorebookV2} from './my_lorebook.js';
import { saveSettingsDebounced } from "../../../../script.js";
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";
import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
// Keep track of where your extension is located, name should match repo name
const extensionName = "MySummarizer";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const defaultSettings = {};
let context = undefined;
const pathToFiles = "/scripts/extensions/third-party/MySummarizer/prompts/";


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
/**
 * Hold all new characters found in last sweep.
 * @type {String|null}
 */
const KEY_INTERNALINFO_ARRAY_NEW_CHARACTERS = "new_characters_list";
/**
 * Key to entry xml process content
 * @type {String|null}
 */
const KEY_INTERNALINFO_XML_NEW_CHARACTERS = "new_characters_list_xml";
/**
 * Key to entry name for visible chat content.
 * @type {String|null}
 */
const SUBSECTION_DEBUG = "debug";
/**
 * Key to entry name for visible chat content.
 * @type {String|null}
 */
const SUBSECTION_CHARACTER = "characters_data";

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
    const filePath = pathToFiles + "scene_breakdown.txt";
    // Fetch the file via HTTP GET request
    const response = await fetch(filePath);
    
    if (!response.ok) {
        throw new Error(`Could not load file: ${response.statusText}`);
    }
    
    // Convert the response to text
    const systemPrompt = await response.text();
    console.log("prompt is " + systemPrompt);
}

async function processCharacterData(){
    console.log("processCharacterData!")
    context = getContext();
    const prompt = await writeToLorebookCurrentVisibleChat();
    await readFromLorebookCurrentVisibleChat(prompt);
    return "";
}

async function processLLMXML_newcharacters(){
  console.log("processLLMXML_newcharacters");
  context = getContext();
  const xmlNewCharacter = 
  await readFromLorebookV2(
    SUBSECTION_CHARACTER,
    KEY_INTERNALINFO_XML_NEW_CHARACTERS
  );
  const rawData = parseCharacterXML(xmlNewCharacter);
  const mapped = rawData.map(
    v => {
      return ({
        name: v.name,
        entry:
          "<description_" + v.name + ">\n" +
          "Appearance: " + v.appearance + "\n" +
          "Personality:" + v.personality + "\n" +
          "Job: " + v.job + "\n" +
          "</description_" + v.name + ">"
      });
    }
  )
  for (const m of mapped) {
    const lorebook_entry = `${m.name}_Description`;
    console.log(`creating or updating lorebook ${lorebook_entry}`)
    const lorebook_content = m.entry;
    const keywords = [m.name,`${m.name}'s`];
    const disabled = false;
    await writeToLorebookV2(
      SUBSECTION_CHARACTER,
      lorebook_entry, lorebook_content, keywords, disabled);
  };
  return "";
}

async function sendLLM_newcharacters(){
  let toast = null;
  try{
    const prompt = 
      "ONLY WRITE ABOUT CHARACTERS:" + 
      await readFromLorebookV2(
        SUBSECTION_CHARACTER,
        KEY_INTERNALINFO_ARRAY_NEW_CHARACTERS) + "\n" +
      "<CHAT_LOG>" +
      await readFromLorebookV2(
        SUBSECTION_DEBUG,
        KEY_DEBUG_CHAT_CONTENT) + "\n" +
      "</CHAT_LOG>"
    const generateRaw  = context.generateRaw;
    const systemPrompt =   
  `You are a character data extraction tool. I will provide a chat log and a list of character name. Extract the character's appearance, personality, and job into the following XML structure:

<characters>
<character> -- FOR EACH CHARACTER
  <name></name>
  <appearance></appearance>
  <personality></personality>
  <job></job>
</character>
<characters>

Rules:
1. Provide valid XML only.
2. No preamble or post-analysis.
3. If information is missing, fill the tag with "Unknown".
4. Use concise, descriptive language.`
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
    console.log(prompt)
    console.log("prompt sent");
    await writeToLorebookV2(
      SUBSECTION_CHARACTER,
      KEY_INTERNALINFO_XML_NEW_CHARACTERS, result);
  }catch(error){
    console.error('processNewCharacterData error:', error);
  }finally{
    if (toast){
      toastr.clear(toast);
    }
  }
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
          await writeToLorebookV2(
            SUBSECTION_DEBUG,
            KEY_DEBUG_CHAT_CONTENT,
            strAcumulador);
          return strAcumulador;
    } catch (error) {
        console.error('writeToLorebookCurrentVisibleChat error:', error);
        return { success: false, error: ('writeToLorebookCurrentVisibleChat', 'writeToLorebookCurrentVisibleChat-message: {{message}}', { message: error.message }) };
    }
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
    const filePath = pathToFiles + "scene_breakdown.txt";
    // Fetch the file via HTTP GET request
    const response = await fetch(filePath);
    
    if (!response.ok) {
        throw new Error(`Could not load file: ${response.statusText}`);
    }
    
    // Convert the response to text
    const systemPrompt = await response.text();
    if (!systemPrompt){
      console.error("failed to parse prompt");
      return;
    }
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
    await writeToLorebookV2(
      SUBSECTION_CHARACTER,
      KEY_DEBUG_XML_SCENE_BREAKDOWN, 
      result);
    console.log("lorebook created");
    await processNarrativeXML(result);
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
    let rawLorebookData = 
    await readFromLorebookV2(
      SUBSECTION_CHARACTER,
      KEY_INTERNALINFO_ARRAY_CHARACTERS);
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
        await writeToLorebookV2(
          SUBSECTION_CHARACTER,
          KEY_INTERNALINFO_ARRAY_CHARACTERS, 
          JSON.stringify(updatedCharacterList)
        );
        
        console.log("Lorebook updated successfully.");
    } else {
        console.log("No new characters found. Lorebook is already up to date.");
    }
    await updateCharacterMemories(scenes);
}

async function processNewCharacters(characters){
  console.log(`process character todo - ${characters}`);
  await writeToLorebookV2(
    SUBSECTION_CHARACTER,
    KEY_INTERNALINFO_ARRAY_NEW_CHARACTERS, 
    JSON.stringify(characters));
  sendLLM_newcharacters();
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
          let rawData = 
            await readFromLorebookV2(
              SUBSECTION_CHARACTER,
              loreKey
            );
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
          await writeToLorebookV2(
            SUBSECTION_CHARACTER,
            loreKey, 
            finalXML, 
            keywords);
          console.log(`Updated memory for ${name}. Total memories stored: ${prunedList.length}`);
          //break;
      }
  }

  await _updateCharacterMemories(scenes);
}