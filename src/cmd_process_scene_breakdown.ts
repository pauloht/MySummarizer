// @ts-ignore
import { getContext } from "../../../extensions.js";
// @ts-ignore
import { readFromLorebookV2, writeToLorebookV2 } from './my_lorebook.js';
// @ts-ignore
import { extractJson } from './myutil.js';
// @ts-ignore
import { PROMPTS_PATH, SUBSECTION_DEBUG, SUBSECTION_CHARACTER, KEY_DEBUG_CHAT_CONTENT, KEY_INTERNALINFO_ARRAY_CHARACTERS, KEY_INTERNALINFO_ARRAY_NEW_CHARACTERS, SUBSECTION_SUMMARY, KEY_SUMMARY_METADATA, KEY_SCENE_BREAKDOWN_PREFIX } from './constants.js';
// @ts-ignore
import { SummaryMetadataEntry } from './cmd_summarize_backup.js';

export async function process_scene_breakdown(): Promise<void> {
    const context = getContext();

    const metaRaw = await readFromLorebookV2(SUBSECTION_SUMMARY, KEY_SUMMARY_METADATA);
    if (!metaRaw) {
        toastr.warning("No summary metadata found. Run /plenorio_summarize_backup first.");
        return;
    }
    const entries: SummaryMetadataEntry[] = JSON.parse(metaRaw);
    if (entries.length === 0) {
        toastr.warning("No summary entries found. Run /plenorio_summarize_backup first.");
        return;
    }

    const lastEntry = entries[entries.length - 1];
    const lastIndex = entries.length;

    if (lastEntry.scene_breakdown_json) {
        // Already processed for this summary — skip LLM, go straight to character extraction
        const content = await readFromLorebookV2(SUBSECTION_CHARACTER, lastEntry.scene_breakdown_json);
        await processNarrativeJson(content);
        return;
    }

    const prompt = await readFromLorebookV2(SUBSECTION_DEBUG, KEY_DEBUG_CHAT_CONTENT);
    const breakdownKey = await runSceneBreakdownLLM(context, prompt, lastIndex);
    if (breakdownKey) {
        lastEntry.scene_breakdown_json = breakdownKey;
        await writeToLorebookV2(SUBSECTION_SUMMARY, KEY_SUMMARY_METADATA, JSON.stringify(entries), [], true);
        const content = await readFromLorebookV2(SUBSECTION_CHARACTER, breakdownKey);
        await processNarrativeJson(content);
    }
}

async function runSceneBreakdownLLM(context: STContext, prompt: string | undefined, index: number): Promise<string | undefined> {
    let toast: object | null = null;
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
    } catch (error: any) {
        console.error('runSceneBreakdownLLM error:', error);
        return undefined;
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
