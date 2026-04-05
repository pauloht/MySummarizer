// @ts-ignore
import { getContext } from "../../../extensions.js";
// @ts-ignore
import { readFromLorebookV2, writeToLorebookV2 } from './my_lorebook.js';
// @ts-ignore
import { extractJson } from './myutil.js';
// @ts-ignore
import { PROMPTS_PATH, SUBSECTION_DEBUG, SUBSECTION_CHARACTER, KEY_DEBUG_CHAT_CONTENT, KEY_INTERNALINFO_ARRAY_NEW_CHARACTERS, SUBSECTION_SUMMARY, KEY_SUMMARY_METADATA, KEY_SCENE_BREAKDOWN_PREFIX, KEY_CHARACTER_DATA_PREFIX } from './constants.js';
export async function process_scene_breakdown() {
    const context = getContext();
    const metaRaw = await readFromLorebookV2(SUBSECTION_SUMMARY, KEY_SUMMARY_METADATA);
    if (!metaRaw) {
        toastr.warning("No summary metadata found. Run /plenorio_summarize_backup first.");
        return;
    }
    const entries = JSON.parse(metaRaw);
    if (entries.length === 0) {
        toastr.warning("No summary entries found. Run /plenorio_summarize_backup first.");
        return;
    }
    const lastEntry = entries[entries.length - 1];
    const lastIndex = entries.length;
    if (lastEntry.scene_breakdown_json) {
        // Already processed for this summary — skip LLM, go straight to character extraction
        const content = await readFromLorebookV2(SUBSECTION_CHARACTER, lastEntry.scene_breakdown_json);
        await processNarrativeJson(content, lastIndex);
        return;
    }
    const prompt = await readFromLorebookV2(SUBSECTION_DEBUG, KEY_DEBUG_CHAT_CONTENT);
    const breakdownKey = await runSceneBreakdownLLM(context, prompt, lastIndex);
    if (breakdownKey) {
        lastEntry.scene_breakdown_json = breakdownKey;
        await writeToLorebookV2(SUBSECTION_SUMMARY, KEY_SUMMARY_METADATA, JSON.stringify(entries), [], true);
        const content = await readFromLorebookV2(SUBSECTION_CHARACTER, breakdownKey);
        await processNarrativeJson(content, lastIndex);
    }
}
async function runSceneBreakdownLLM(context, prompt, index) {
    let toast = null;
    try {
        if (!prompt || prompt.length <= 10) {
            console.log("No prompt or prompt too short");
            return undefined;
        }
        console.log(`Prompt read with size ${prompt.length}`);
        const filePath = PROMPTS_PATH + "scene_breakdown.txt";
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Could not load file: ${response.statusText}`);
        }
        const systemPrompt = await response.text();
        if (!systemPrompt) {
            console.error("Failed to parse system prompt");
            return undefined;
        }
        toast = toastr.info("LLM is thinking...", null, {
            timeOut: 0,
            extendedTimeOut: 0,
            tapToDismiss: false
        });
        let result = await context.generateRaw({ systemPrompt, prompt, prefill: '' });
        result = extractJson(result);
        const lorebookKey = `${KEY_SCENE_BREAKDOWN_PREFIX}_${index}`;
        await writeToLorebookV2(SUBSECTION_CHARACTER, lorebookKey, result, [], true);
        console.log(`Scene breakdown saved to lorebook as ${lorebookKey}`);
        return lorebookKey;
    }
    catch (error) {
        console.error('runSceneBreakdownLLM error:', error);
        return undefined;
    }
    finally {
        if (toast) {
            toastr.clear(toast);
        }
    }
}
async function processNarrativeJson(jsonContent, summaryIndex) {
    if (!jsonContent)
        return;
    const json = JSON.parse(jsonContent);
    const scenes = json.narrative_analysis.scenes;
    const characterSet = new Set();
    for (const scene of scenes) {
        for (const participant of scene.participants) {
            if (participant.is_named_character !== false) {
                characterSet.add(participant.name);
            }
        }
    }
    const newCharacters = [];
    for (const name of characterSet) {
        const entryKey = `${KEY_CHARACTER_DATA_PREFIX}_${name.toLowerCase().replace(/\s+/g, '_')}`;
        const existing = await readFromLorebookV2(SUBSECTION_CHARACTER, entryKey);
        if (!existing) {
            const data = {
                Name: name,
                Included_Index: summaryIndex,
                Description_Updated: null,
                CharacterDescription: "",
                Memories: [],
            };
            await writeToLorebookV2(SUBSECTION_CHARACTER, entryKey, JSON.stringify(data), [], true);
            newCharacters.push(name);
            console.log(`Created character entry for: ${name}`);
        }
    }
    await writeToLorebookV2(SUBSECTION_CHARACTER, KEY_INTERNALINFO_ARRAY_NEW_CHARACTERS, JSON.stringify(newCharacters));
    console.log("All named characters in narrative:", Array.from(characterSet));
}
