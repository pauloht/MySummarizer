// @ts-ignore
import { getContext } from "../../../extensions.js";
// @ts-ignore
import { readFromLorebookV2, writeToLorebookV2 } from './my_lorebook.js';
// @ts-ignore
import { extractJson } from './myutil.js';

const SUBSECTION_DEBUG = "debug";
const SUBSECTION_CHARACTER = "characters_data";
const KEY_DEBUG_CHAT_CONTENT = "my_debug";
const KEY_JSON_SCENE_BREAKDOWN = "json_scene_breakdown";
const KEY_INTERNALINFO_ARRAY_CHARACTERS = "characters_list";
const KEY_INTERNALINFO_ARRAY_NEW_CHARACTERS = "new_characters_list";
const pathToFiles = "/scripts/extensions/third-party/MySummarizer/prompts/";

export async function process_scene_breakdown(): Promise<void> {
    const context = getContext();
    const prompt = await readFromLorebookV2(SUBSECTION_DEBUG, KEY_DEBUG_CHAT_CONTENT + "_3");
    await runSceneBreakdownLLM(context, prompt);
    const content = await readFromLorebookV2(SUBSECTION_CHARACTER, KEY_JSON_SCENE_BREAKDOWN);
    await processNarrativeJson(content);
}

async function runSceneBreakdownLLM(context: STContext, prompt: string | undefined): Promise<void> {
    let toast: object | null = null;
    try {
        if (!prompt || prompt.length <= 10) {
            console.log("No prompt or prompt too short");
            return;
        }
        console.log(`Prompt read with size ${prompt.length}`);

        const filePath = pathToFiles + "scene_breakdown.txt";
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Could not load file: ${response.statusText}`);
        }
        const systemPrompt = await response.text();
        if (!systemPrompt) {
            console.error("Failed to parse system prompt");
            return;
        }

        toast = toastr.info("LLM is thinking...", null, {
            timeOut: 0,
            extendedTimeOut: 0,
            tapToDismiss: false
        });

        let result = await context.generateRaw({ systemPrompt, prompt, prefill: '' });
        result = extractJson(result);

        await writeToLorebookV2(SUBSECTION_CHARACTER, KEY_JSON_SCENE_BREAKDOWN, result);
        console.log("Scene breakdown saved to lorebook");
    } catch (error: any) {
        console.error('runSceneBreakdownLLM error:', error);
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
