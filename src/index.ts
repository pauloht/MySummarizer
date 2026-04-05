// The main script for the extension
// @ts-ignore
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
// @ts-ignore
import { readFromLorebookV2, writeToLorebookV2 } from './my_lorebook.js';
// @ts-ignore
import { extractJson } from './myutil.js';
// @ts-ignore
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";
// @ts-ignore
import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
// @ts-ignore
import { backup_visible_chat } from './cmd_backupchat.js';

const extensionName = "MySummarizer";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
let context: STContext | undefined = undefined;
const pathToFiles = "/scripts/extensions/third-party/MySummarizer/prompts/";

const KEY_DEBUG_CHAT_CONTENT = "my_debug";
const KEY_DEBUG_JSON_SCENE_BREAKDOWN = "json_scene_breakdown";
const KEY_INTERNALINFO_ARRAY_CHARACTERS = "characters_list";
const KEY_INTERNALINFO_ARRAY_NEW_CHARACTERS = "new_characters_list";
const KEY_INTERNALINFO_XML_NEW_CHARACTERS = "new_characters_list_xml";
const SUBSECTION_DEBUG = "debug";
const SUBSECTION_CHARACTER = "characters_data";

jQuery(async () => {
    console.log("Im online bitches.");
});

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'plenorio_backupchat',
    callback: () => {
        backup_visible_chat();
    },
    returns: `Full process`,
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'plenorio',
    callback: () => {
        testCommand();
    },
    returns: `temporary command for testing`,
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'plenorio_process_scene_breakdown',
    callback: () => {
        testSceneBreakdown();
    },
    returns: `temporary command for testing`,
}));

async function testCommand(): Promise<void> {
    context = getContext();
    const prompt = await readFromLorebookV2(
        SUBSECTION_DEBUG,
        KEY_DEBUG_CHAT_CONTENT + "_3"
    );
    await readFromLorebookCurrentVisibleChat(prompt);
}

async function testSceneBreakdown(): Promise<void> {
    context = getContext();
    const sceneName = "json_scene_breakdown_1";
    const content = await readFromLorebookV2(
        SUBSECTION_CHARACTER,
        sceneName
    );
    processNarrativeJson(content);
}

async function readFromLorebookCurrentVisibleChat(prompt: string | undefined): Promise<any> {
    try {
        if (context!.characterId === undefined) {
            toastr.info(context!.characterId === undefined);
            return;
        }
        await commandSendLLMTask_BreakScenes(prompt);
        toastr.info(`Send and updated`);
    } catch (error: any) {
        console.error('readFromLorebookCurrentVisibleChat error:', error);
        return { success: false, error: { message: error.message } };
    }
}


async function commandSendLLMTask_BreakScenes(prompt: string | undefined): Promise<any> {
    let toast: object | null = null;
    try {
        if (!prompt) {
            console.log("!prompt");
            return;
        }
        if (prompt.length <= 10) {
            console.log("small prompt?");
            return;
        }
        console.log(`prompt read wit size ${prompt.length}`);
        const generateRaw = context!.generateRaw;
        const filePath = pathToFiles + "scene_breakdown.txt";
        const response = await fetch(filePath);

        if (!response.ok) {
            throw new Error(`Could not load file: ${response.statusText}`);
        }

        const systemPrompt = await response.text();
        if (!systemPrompt) {
            console.error("failed to parse prompt");
            return;
        }
        toast = toastr.info("LLM is thinking...", null, {
            timeOut: 0,
            extendedTimeOut: 0,
            tapToDismiss: false
        });
        const prefill = '';
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
            result
        );
        console.log("lorebook created");
        if (true) {
            console.log("force interrupt");
            return;
        }
    } catch (error: any) {
        console.error('readFromLorebookCurrentVisibleChat error:', error);
        return { success: false, error: { message: error.message } };
    } finally {
        if (toast) {
            toastr.clear(toast);
        }
    }
}

async function processNarrativeJson(jsonContent: string | undefined): Promise<void> {
    if (!jsonContent) return;
    const json = JSON.parse(jsonContent);
    const existingCharactersRaw = await readFromLorebookV2(SUBSECTION_CHARACTER, KEY_INTERNALINFO_ARRAY_CHARACTERS);
    const existingCharacters: string[] = existingCharactersRaw ? JSON.parse(existingCharactersRaw) : [];
    console.log("json is ...");
    console.log(json);

    const scenes = json.narrative_analysis.scenes;
    const characterSet = new Set<string>();
    for (const scene of scenes) {
        for (const participant of scene.participants) {
            characterSet.add(participant.name);
        }
    }
    const characterList = Array.from(characterSet);
    await writeToLorebookV2(SUBSECTION_CHARACTER, KEY_INTERNALINFO_ARRAY_NEW_CHARACTERS, JSON.stringify(Array.from(characterSet)));
    console.log("Characters in narrative:", characterList);
}
