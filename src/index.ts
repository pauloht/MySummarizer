// The main script for the extension
// @ts-ignore
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";
// @ts-ignore
import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
// @ts-ignore
import { backup_visible_chat } from './cmd_backupchat.js';
// @ts-ignore
import { process_scene_breakdown } from './cmd_process_scene_breakdown.js';
// @ts-ignore
import { summarize_backup } from './cmd_summarize_backup.js';

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
        // reserved for isolated testing
    },
    returns: `temporary command for testing`,
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'plenorio_process_scene_breakdown',
    callback: () => {
        process_scene_breakdown();
    },
    returns: `Runs scene breakdown LLM pipeline then extracts characters`,
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'plenorio_summarize_backup',
    callback: () => {
        summarize_backup();
    },
    returns: `Summarizes the backed-up conversation and stores result in lorebook`,
}));
