// @ts-ignore
import { getContext } from "../../../extensions.js";
// @ts-ignore
import { readFromLorebookV2, writeToLorebookV2, writeConstantLorebookEntry } from './my_lorebook.js';
// @ts-ignore
import { extractJson } from './myutil.js';
const SUBSECTION_DEBUG = "debug";
const KEY_DEBUG_CHAT_CONTENT = "my_debug";
export const SUBSECTION_SUMMARY = "summary";
export const KEY_SUMMARY_METADATA = "summary_metadata";
export const KEY_SUMMARY_RESULT_PREFIX = "summary_result";
export const SUBSECTION_MARKDOWN = "markdown";
export const KEY_MARKDOWN_ENTRY_PREFIX = "summary_md";
const pathToFiles = "/scripts/extensions/third-party/MySummarizer/prompts/";
const FINGERPRINT_LENGTH = 200;
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
        const fingerprint = backupContent.slice(0, FINGERPRINT_LENGTH);
        const existingMetaRaw = await readFromLorebookV2(SUBSECTION_SUMMARY, KEY_SUMMARY_METADATA);
        const existingEntries = existingMetaRaw ? JSON.parse(existingMetaRaw) : [];
        const alreadySummarized = existingEntries.some(e => e.content_fingerprint === fingerprint);
        if (alreadySummarized) {
            toastr.warning("This backup has already been summarized. Run /plenorio_backupchat to get new content first.");
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
        const nextIndex = existingEntries.length + 1;
        const lorebookId = `${KEY_SUMMARY_RESULT_PREFIX}_${nextIndex}`;
        await writeToLorebookV2(SUBSECTION_SUMMARY, lorebookId, rawJson, [], true);
        const markdownId = `${KEY_MARKDOWN_ENTRY_PREFIX}_${nextIndex}`;
        const markdownContent = `## ${parsed.approximate_time_period}\n\n${parsed.summary}`;
        await writeConstantLorebookEntry(SUBSECTION_MARKDOWN, markdownId, markdownContent, nextIndex);
        await appendSummaryMetadata(lorebookId, backupContent.length, fingerprint, parsed, existingEntries);
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
async function appendSummaryMetadata(lorebookId, messageCount, fingerprint, summarized, entries) {
    entries.push({
        dt_included: new Date().toISOString(),
        original_message_count: messageCount,
        summarized_count: summarized?.summary?.length ?? 0,
        lore_book_id: lorebookId,
        content_fingerprint: fingerprint,
    });
    await writeToLorebookV2(SUBSECTION_SUMMARY, KEY_SUMMARY_METADATA, JSON.stringify(entries), [], true);
}
