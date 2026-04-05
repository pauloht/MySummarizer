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
const KEY_DEBUG_JSON_SCENE_BREAKDOWN = "json_scene_breakdown";
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

jQuery(async () => {
  console.log("Im online bitches.");
});

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'plenorio_processCharacterData',
    callback: () => {
        processCharacterData()
    },
    returns: `Full process`,
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'plenorio',  
  callback: () => {
        testCommand()
    },
    returns: `temporary command for testing`,
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'plenorio_process_scene_breakdown',  
  callback: () => {
        testSceneBreakdown()
    },
    returns: `temporary command for testing`,
}));

async function testCommand(){
    context = getContext();
    const prompt = await readFromLorebookV2(
      SUBSECTION_DEBUG,
      KEY_DEBUG_CHAT_CONTENT + "_3"
    );
    await readFromLorebookCurrentVisibleChat(prompt);
}

async function processCharacterData(){
    console.log("processCharacterData!")
    context = getContext();
    const prompt = await writeToLorebookCurrentVisibleChat();
    console.log("only writing for now, has to fix shit");
    if (true) return ":)";
    await readFromLorebookCurrentVisibleChat(prompt);
    return "";
}

async function testSceneBreakdown(){
  context = getContext();
  const sceneName = "json_scene_breakdown_1";
  const content = await readFromLorebookV2(
    SUBSECTION_CHARACTER,
    sceneName
  );
  processNarrativeJson(content);
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
          //subSection, logTitle, logContent, keywords = [], disabled = false
          await writeToLorebookV2(
              SUBSECTION_DEBUG,
              KEY_DEBUG_CHAT_CONTENT,
              strAcumulador,
              [],
              true
            );
          return strAcumulador;
    } catch (error) {
        console.error('writeToLorebookCurrentVisibleChat error:', error);
        return { success: false, error: ('writeToLorebookCurrentVisibleChat', 'writeToLorebookCurrentVisibleChat-message: {{message}}', { message: error.message }) };
    }
}

function extractJson(result) {
  // Regex explanation:
  // ```json\s*     Matches the opening tag and optional newline
  // ([\s\S]*?)     Captures everything inside (non-greedy)
  // \s*```         Matches the closing tag and optional whitespace
  const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/);

  if (jsonMatch && jsonMatch[1]) {
    try {
      // jsonMatch[1] is the content inside the backticks
      return jsonMatch[1].trim();
    } catch (e) {
      console.error("Failed to parse extracted JSON:", e);
      return null;
    }
  }

  // Fallback: If it's not wrapped in backticks, try parsing the whole string
  try {
    return result;
  } catch (e) {
    return null;
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
    /**
     * @type {String}
     */
    let result = await generateRaw({
        systemPrompt,
        prompt,
        prefill,
    });
    result = extractJson(result);
    console.log("prompt sent");
    await writeToLorebookV2(
      SUBSECTION_CHARACTER,
      KEY_DEBUG_JSON_SCENE_BREAKDOWN, 
      result);
    console.log("lorebook created");
    if (true){
      console.log("force interrupt");
      return;
    }
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

async function processNarrativeJson(jsonContent) {
    const json = JSON.parse(jsonContent);
    //data in json format [ name1, name2, name3...]
    const existingCharacters = readFromLorebookV2(SUBSECTION_CHARACTER, KEY_INTERNALINFO_ARRAY_CHARACTERS);
    if (!existingCharacters){
      existingCharacters = [];
    }
    console.log("json is ...");
    console.log(json);
    /*
    json format
    {
      "narrative_analysis": {
        "scenes": [
          {
            "scene_number": [Integer],
            "title": "[3-5 word title]",
            "short_description": "[1-2 sentence summary]",
            "participants": [
              {
                "name": "[Character Name]",
                "feelings": [
                  "[Primary Emotion]",
                  "[Secondary Emotion - Optional]",
                  "[Tertiary Emotion - Optional]"
                ],
                "perception": "[Allowed Value]",
                "reasoning": "[1 sentence justification]"
              }
            ]
          }
        ]
      }
    }
    */

    // Build unique character list from all scenes
    const scenes = json.narrative_analysis.scenes;
    const characterSet = new Set();
    for (const scene of scenes) {
        for (const participant of scene.participants) {
            characterSet.add(participant.name);
        }
    }
    const characterList = Array.from(characterSet);
    await writeToLorebookV2(SUBSECTION_CHARACTER, KEY_INTERNALINFO_ARRAY_NEW_CHARACTERS, JSON.stringify(Array.from(characterSet)));
    console.log("Characters in narrative:", characterList);
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