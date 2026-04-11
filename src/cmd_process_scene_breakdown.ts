// @ts-ignore
import { getContext } from "../../../extensions.js";
// @ts-ignore
import { readFromLorebookV2, writeToLorebookV3 } from './my_lorebook.js';
// @ts-ignore
import { extractJson } from './myutil.js';
// @ts-ignore
import { PROMPTS_PATH, SUBSECTION_DEBUG, SUBSECTION_CHARACTER, KEY_DEBUG_CHAT_CONTENT, KEY_INTERNALINFO_ARRAY_NEW_CHARACTERS, SUBSECTION_SUMMARY, KEY_SUMMARY_METADATA, KEY_SCENE_BREAKDOWN_PREFIX, KEY_CHARACTER_DATA_PREFIX, SUBSECTION_MARKDOWN, KEY_CHARACTER_MD_PREFIX } from './constants.js';
// @ts-ignore
import { SummaryMetadataEntry } from './cmd_summarize_backup.js';

const MAX_CHARACTER_MEMORIES = 5;

interface CharacterData {
    Name: string;
    Included_Index: number;
    Description_Updated: number | null;
    CharacterDescription: string;
    Memories: string[];
}

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
        await writeToLorebookV3({ subSection: SUBSECTION_SUMMARY, logTitle: KEY_SUMMARY_METADATA, logContent: JSON.stringify(entries) });
        const content = await readFromLorebookV2(SUBSECTION_CHARACTER, breakdownKey);
        await processNarrativeJson(content, lastIndex, chatContent, context);
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
        await writeToLorebookV3({ subSection: SUBSECTION_CHARACTER, logTitle: lorebookKey, logContent: result });
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

async function processNarrativeJson(jsonContent: string | undefined, summaryIndex: number, chatContent: string | undefined, context: STContext): Promise<void> {
    if (!jsonContent) return;
    const json = JSON.parse(jsonContent);

    const scenes = json.narrative_analysis.scenes;
    const characterSet = new Set<string>();
    for (const scene of scenes) {
        for (const participant of scene.participants) {
            if (participant.is_named_character !== false) {
                characterSet.add(participant.name);
            }
        }
    }

    const newCharacters: string[] = [];
    for (const name of characterSet) {
        const entryKey = `${KEY_CHARACTER_DATA_PREFIX}_${name.toLowerCase().replace(/\s+/g, '_')}`;
        const existing = await readFromLorebookV2(SUBSECTION_CHARACTER, entryKey);
        if (!existing) {
            const data: CharacterData = {
                Name: name,
                Included_Index: summaryIndex,
                Description_Updated: null,
                CharacterDescription: "",
                Memories: [],
            };
            await writeToLorebookV3({ subSection: SUBSECTION_CHARACTER, logTitle: entryKey, logContent: JSON.stringify(data) });
            newCharacters.push(name);
            console.log(`Created character entry for: ${name}`);
        }
    }

    await writeToLorebookV3({ subSection: SUBSECTION_CHARACTER, logTitle: KEY_INTERNALINFO_ARRAY_NEW_CHARACTERS, logContent: JSON.stringify(newCharacters) });
    console.log("All named characters in narrative:", Array.from(characterSet));

    if (newCharacters.length > 0) {
        await runCharacterDescriptionLLM(context, chatContent, newCharacters, summaryIndex);
    }

    await updateCharacterMemories(scenes, summaryIndex);
    await updateCharacterMarkdown(characterSet);
}

async function updateCharacterMarkdown(characterSet: Set<string>): Promise<void> {
    for (const name of characterSet) {
        const entryKey = `${KEY_CHARACTER_DATA_PREFIX}_${name.toLowerCase().replace(/\s+/g, '_')}`;
        const raw = await readFromLorebookV2(SUBSECTION_CHARACTER, entryKey);
        if (!raw) continue;
        const data: CharacterData = JSON.parse(raw);

        const memoriesBlock = data.Memories.length > 0
            ? data.Memories.map(m => `- ${m}`).join('\n')
            : '_No memories recorded yet._';

        const markdown = `# ${name}\n\n## Description\n${data.CharacterDescription || '_No description yet._'}\n\n## Memories\n${memoriesBlock}`;

        const mdKey = `${KEY_CHARACTER_MD_PREFIX}_${name.toLowerCase().replace(/\s+/g, '_')}`;
        const keywords = [name, `${name}'s`];
        await writeToLorebookV3({ subSection: SUBSECTION_MARKDOWN, logTitle: mdKey, logContent: markdown, keywords, disabled: false });
        console.log(`Updated markdown entry for: ${name}`);
    }
}

async function updateCharacterMemories(scenes: any[], summaryIndex: number): Promise<void> {
    // Build a map of name -> new memory strings from this sweep's scenes
    const memoriesByCharacter = new Map<string, string[]>();
    for (const scene of scenes) {
        for (const participant of scene.participants) {
            if (participant.is_named_character === false) continue;
            const name: string = participant.name;
            const feelings: string = (participant.feelings as string[]).join(", ");
            const memory = `[S${summaryIndex} Scene ${scene.scene_number} - ${scene.title}] ${scene.short_description} Felt: ${feelings}. ${participant.reasoning}`;
            if (!memoriesByCharacter.has(name)) memoriesByCharacter.set(name, []);
            memoriesByCharacter.get(name)!.push(memory);
        }
    }

    for (const [name, newMemories] of memoriesByCharacter) {
        const entryKey = `${KEY_CHARACTER_DATA_PREFIX}_${name.toLowerCase().replace(/\s+/g, '_')}`;
        const raw = await readFromLorebookV2(SUBSECTION_CHARACTER, entryKey);
        if (!raw) continue;
        const data: CharacterData = JSON.parse(raw);
        const combined = [...data.Memories, ...newMemories];
        data.Memories = combined.slice(-MAX_CHARACTER_MEMORIES);
        await writeToLorebookV3({ subSection: SUBSECTION_CHARACTER, logTitle: entryKey, logContent: JSON.stringify(data) });
        console.log(`Updated memories for ${name}: ${data.Memories.length} entries`);
    }
}

async function runCharacterDescriptionLLM(context: STContext, chatContent: string | undefined, characterNames: string[], summaryIndex: number): Promise<void> {
    let toast: object | null = null;
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

        const descriptions: Record<string, string> = JSON.parse(result);

        for (const name of characterNames) {
            const description = descriptions[name];
            if (!description) continue;
            const entryKey = `${KEY_CHARACTER_DATA_PREFIX}_${name.toLowerCase().replace(/\s+/g, '_')}`;
            const raw = await readFromLorebookV2(SUBSECTION_CHARACTER, entryKey);
            if (!raw) continue;
            const data: CharacterData = JSON.parse(raw);
            data.CharacterDescription = description;
            data.Description_Updated = summaryIndex;
            await writeToLorebookV3({ subSection: SUBSECTION_CHARACTER, logTitle: entryKey, logContent: JSON.stringify(data) });
            console.log(`Updated description for: ${name}`);
        }
    } catch (error: any) {
        console.error('runCharacterDescriptionLLM error:', error);
    } finally {
        if (toast) {
            toastr.clear(toast);
        }
    }
}
