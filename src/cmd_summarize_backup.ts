// @ts-ignore
import { getContext } from "../../../extensions.js";
// @ts-ignore
import { LorebookPosition, readFromLorebookV2, writeToLorebookV3 } from './my_lorebook.js';
// @ts-ignore
import { extractJson } from './myutil.js';
// @ts-ignore
import { PROMPTS_PATH, SUBSECTION_DEBUG, KEY_DEBUG_CHAT_CONTENT, SUBSECTION_SUMMARY, KEY_SUMMARY_METADATA, KEY_SUMMARY_RESULT_PREFIX, SUBSECTION_MARKDOWN, KEY_MARKDOWN_ENTRY_PREFIX } from './constants.js';

interface SummaryResult {
    summary: string;
    approximate_time_period: string;
}

const FINGERPRINT_LENGTH = 200;

export interface SummaryMetadataEntry {
    dt_included: string;
    original_message_count: number;
    summarized_count: number;
    lore_book_id: string;
    content_fingerprint: string;
    scene_breakdown_json?: string;
}

export async function summarize_backup(): Promise<void> {
    let toast: object | null = null;
    try {
        const context: STContext = getContext();
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
        const existingEntries: SummaryMetadataEntry[] = existingMetaRaw ? JSON.parse(existingMetaRaw) : [];
        const alreadySummarized = existingEntries.some(e => e.content_fingerprint === fingerprint);
        if (alreadySummarized) {
            toastr.warning("This backup has already been summarized. Run /plenorio_backupchat to get new content first.");
            return;
        }

        const messageCount = backupContent.split("\n").filter((l: string) => l.trim().length > 0).length;
        toastr.info(`Summarizing ${messageCount} backed-up lines...`);

        const filePath = PROMPTS_PATH + "summarize_backup.txt";
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
        const parsed: SummaryResult = JSON.parse(rawJson);

        const nextIndex = existingEntries.length + 1;
        const lorebookId = `${KEY_SUMMARY_RESULT_PREFIX}_${nextIndex}`;
        await writeToLorebookV3({ subSection: SUBSECTION_SUMMARY, logTitle: lorebookId, logContent: rawJson });

        const markdownId = `${KEY_MARKDOWN_ENTRY_PREFIX}_${nextIndex}`;
        const markdownContent = `## ${parsed.approximate_time_period}\n\n${parsed.summary}`;
        await writeToLorebookV3({ 
            subSection: SUBSECTION_MARKDOWN, 
            logTitle: markdownId, 
            logContent: markdownContent, 
            constant: true, 
            order: nextIndex,
            position: LorebookPosition.AfterCharDef 
        });

        await appendSummaryMetadata(lorebookId, backupContent.length, fingerprint, parsed, existingEntries);

        toastr.success(`Summary saved (${parsed.approximate_time_period}).`);
    } catch (error: any) {
        console.error('summarize_backup error:', error);
        toastr.error(`Summarization failed: ${error.message}`);
    } finally {
        if (toast) {
            toastr.clear(toast);
        }
    }
}

async function appendSummaryMetadata(lorebookId: string, messageCount: number, fingerprint: string, summarized: SummaryResult, entries: SummaryMetadataEntry[]): Promise<void> {
    entries.push({
        dt_included: new Date().toISOString(),
        original_message_count: messageCount,
        summarized_count: summarized?.summary?.length ?? 0,
        lore_book_id: lorebookId,
        content_fingerprint: fingerprint,
    });

    await writeToLorebookV3({ subSection: SUBSECTION_SUMMARY, logTitle: KEY_SUMMARY_METADATA, logContent: JSON.stringify(entries) });
}
