// @ts-ignore
import { getContext } from "../../../extensions.js";
// @ts-ignore
import { readFromLorebookV2, writeToLorebookV2 } from './my_lorebook.js';
// @ts-ignore
import { extractJson } from './myutil.js';
const SUBSECTION_DEBUG = "debug";
const KEY_DEBUG_CHAT_CONTENT = "my_debug";
export const SUBSECTION_SUMMARY = "summary";
export const KEY_SUMMARY_METADATA = "summary_metadata";
export const KEY_SUMMARY_RESULT_PREFIX = "summary_result";
const pathToFiles = "/scripts/extensions/third-party/MySummarizer/prompts/";
export async function summarize_backup() {
    let toast = null;
    try {
        const context = getContext();
        if (context.characterId === undefined) {
            toastr.error("No character loaded.");
            return;
        }
        const backupContent = await readFromLorebookV2(SUBSECTION_DEBUG, KEY_DEBUG_CHAT_CONTENT);
        if (!backupContent || backupContent.length <= 10) {
            toastr.warning("No backup content found. Run /plenorio_backupchat first.");
            return;
        }
        const messageCount = backupContent.split("\n").filter((l) => l.trim().length > 0).length;
        toastr.info(`Summarizing ${messageCount} backed-up lines...`);
        const filePath = pathToFiles + "summarize_backup.txt";
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Could not load prompt file: ${response.statusText}`);
        }
        const systemPrompt = await response.text();
        toast = toastr.info("LLM is summarizing...", null, {
            timeOut: 0,
            extendedTimeOut: 0,
            tapToDismiss: false,
        });
        const generateRaw = context.generateRaw;
        let result = await generateRaw({
            systemPrompt,
            prompt: backupContent,
            prefill: '',
        });
        const rawJson = extractJson(result);
        const parsed = JSON.parse(rawJson);
        const lorebookId = `${KEY_SUMMARY_RESULT_PREFIX}_${Date.now()}`;
        await writeToLorebookV2(SUBSECTION_SUMMARY, lorebookId, rawJson, [], true);
        await appendSummaryMetadata(lorebookId, messageCount, parsed);
        toastr.success(`Summary saved (${parsed.approximate_time_period}).`);
    }
    catch (error) {
        console.error('summarize_backup error:', error);
        toastr.error(`Summarization failed: ${error.message}`);
    }
    finally {
        if (toast) {
            toastr.clear(toast);
        }
    }
}
async function appendSummaryMetadata(lorebookId, messageCount, summarized) {
    const existing = await readFromLorebookV2(SUBSECTION_SUMMARY, KEY_SUMMARY_METADATA);
    const entries = existing ? JSON.parse(existing) : [];
    entries.push({
        dt_included: new Date().toISOString(),
        original_message_count: messageCount,
        summarized_count: summarized?.summary?.length ?? 0,
        lore_book_id: lorebookId,
    });
    await writeToLorebookV2(SUBSECTION_SUMMARY, KEY_SUMMARY_METADATA, JSON.stringify(entries), [], true);
}
