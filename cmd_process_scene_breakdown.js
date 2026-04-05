// @ts-ignore
import { getContext } from "../../../extensions.js";
// @ts-ignore
import { readFromLorebookV2, writeToLorebookV2 } from './my_lorebook.js';
// @ts-ignore
import { extractJson } from './myutil.js';
// @ts-ignore
import { PROMPTS_PATH, SUBSECTION_DEBUG, SUBSECTION_CHARACTER, KEY_DEBUG_CHAT_CONTENT, KEY_INTERNALINFO_ARRAY_NEW_CHARACTERS, SUBSECTION_SUMMARY, KEY_SUMMARY_METADATA, KEY_SCENE_BREAKDOWN_PREFIX, KEY_CHARACTER_DATA_PREFIX, SUBSECTION_MARKDOWN, KEY_CHARACTER_MD_PREFIX } from './constants.js';
const MAX_CHARACTER_MEMORIES = 5;
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
    const chatContent = await readFromLorebookV2(SUBSECTION_DEBUG, KEY_DEBUG_CHAT_CONTENT);
    if (lastEntry.scene_breakdown_json) {
        // Already processed for this summary — skip LLM, go straight to character extraction
        const content = await readFromLorebookV2(SUBSECTION_CHARACTER, lastEntry.scene_breakdown_json);
        await processNarrativeJson(content, lastIndex, chatContent, context);
        return;
    }
    const breakdownKey = await runSceneBreakdownLLM(context, chatContent, lastIndex);
    if (breakdownKey) {
        lastEntry.scene_breakdown_json = breakdownKey;
        await writeToLorebookV2(SUBSECTION_SUMMARY, KEY_SUMMARY_METADATA, JSON.stringify(entries), [], true);
        const content = await readFromLorebookV2(SUBSECTION_CHARACTER, breakdownKey);
        await processNarrativeJson(content, lastIndex, chatContent, context);
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
async function processNarrativeJson(jsonContent, summaryIndex, chatContent, context) {
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
    if (newCharacters.length > 0) {
        await runCharacterDescriptionLLM(context, chatContent, newCharacters, summaryIndex);
    }
    await updateCharacterMemories(scenes, summaryIndex);
    await updateCharacterMarkdown(characterSet);
}
async function updateCharacterMarkdown(characterSet) {
    for (const name of characterSet) {
        const entryKey = `${KEY_CHARACTER_DATA_PREFIX}_${name.toLowerCase().replace(/\s+/g, '_')}`;
        const raw = await readFromLorebookV2(SUBSECTION_CHARACTER, entryKey);
        if (!raw)
            continue;
        const data = JSON.parse(raw);
        const memoriesBlock = data.Memories.length > 0
            ? data.Memories.map(m => `- ${m}`).join('\n')
            : '_No memories recorded yet._';
        const markdown = `# ${name}\n\n## Description\n${data.CharacterDescription || '_No description yet._'}\n\n## Memories\n${memoriesBlock}`;
        const mdKey = `${KEY_CHARACTER_MD_PREFIX}_${name.toLowerCase().replace(/\s+/g, '_')}`;
        const keywords = [name, `${name}'s`];
        await writeToLorebookV2(SUBSECTION_MARKDOWN, mdKey, markdown, keywords, false);
        console.log(`Updated markdown entry for: ${name}`);
    }
}
async function updateCharacterMemories(scenes, summaryIndex) {
    // Build a map of name -> new memory strings from this sweep's scenes
    const memoriesByCharacter = new Map();
    for (const scene of scenes) {
        for (const participant of scene.participants) {
            if (participant.is_named_character === false)
                continue;
            const name = participant.name;
            const feelings = participant.feelings.join(", ");
            const memory = `[S${summaryIndex} Scene ${scene.scene_number} - ${scene.title}] ${scene.short_description} Felt: ${feelings}. ${participant.reasoning}`;
            if (!memoriesByCharacter.has(name))
                memoriesByCharacter.set(name, []);
            memoriesByCharacter.get(name).push(memory);
        }
    }
    for (const [name, newMemories] of memoriesByCharacter) {
        const entryKey = `${KEY_CHARACTER_DATA_PREFIX}_${name.toLowerCase().replace(/\s+/g, '_')}`;
        const raw = await readFromLorebookV2(SUBSECTION_CHARACTER, entryKey);
        if (!raw)
            continue;
        const data = JSON.parse(raw);
        const combined = [...data.Memories, ...newMemories];
        data.Memories = combined.slice(-MAX_CHARACTER_MEMORIES);
        await writeToLorebookV2(SUBSECTION_CHARACTER, entryKey, JSON.stringify(data), [], true);
        console.log(`Updated memories for ${name}: ${data.Memories.length} entries`);
    }
}
async function runCharacterDescriptionLLM(context, chatContent, characterNames, summaryIndex) {
    let toast = null;
    try {
        if (!chatContent || chatContent.length <= 10) {
            console.log("No chat content available for character description");
            return;
        }
        const filePath = PROMPTS_PATH + "character_description.txt";
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Could not load file: ${response.statusText}`);
        }
        const systemPrompt = await response.text();
        if (!systemPrompt) {
            console.error("Failed to parse character description system prompt");
            return;
        }
        const nameList = characterNames.join(", ");
        const prompt = `${chatContent}\n\nDescribe the following characters: ${nameList}`;
        toast = toastr.info("Generating character descriptions...", null, {
            timeOut: 0,
            extendedTimeOut: 0,
            tapToDismiss: false
        });
        let result = await context.generateRaw({ systemPrompt, prompt, prefill: '' });
        result = extractJson(result);
        const descriptions = JSON.parse(result);
        for (const name of characterNames) {
            const description = descriptions[name];
            if (!description)
                continue;
            const entryKey = `${KEY_CHARACTER_DATA_PREFIX}_${name.toLowerCase().replace(/\s+/g, '_')}`;
            const raw = await readFromLorebookV2(SUBSECTION_CHARACTER, entryKey);
            if (!raw)
                continue;
            const data = JSON.parse(raw);
            data.CharacterDescription = description;
            data.Description_Updated = summaryIndex;
            await writeToLorebookV2(SUBSECTION_CHARACTER, entryKey, JSON.stringify(data), [], true);
            console.log(`Updated description for: ${name}`);
        }
    }
    catch (error) {
        console.error('runCharacterDescriptionLLM error:', error);
    }
    finally {
        if (toast) {
            toastr.clear(toast);
        }
    }
}
