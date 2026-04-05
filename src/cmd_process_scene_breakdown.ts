// @ts-ignore
import { readFromLorebookV2, writeToLorebookV2 } from './my_lorebook.js';

const SUBSECTION_CHARACTER = "characters_data";
const KEY_INTERNALINFO_ARRAY_CHARACTERS = "characters_list";
const KEY_INTERNALINFO_ARRAY_NEW_CHARACTERS = "new_characters_list";

export async function process_scene_breakdown(): Promise<void> {
    const sceneName = "json_scene_breakdown_1";
    const content = await readFromLorebookV2(SUBSECTION_CHARACTER, sceneName);
    await processNarrativeJson(content);
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
