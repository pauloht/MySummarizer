// @ts-ignore
import { getContext } from "../../../extensions.js";
// @ts-ignore
import { saveChatConditional } from "../../../../script.js";
// @ts-ignore
import { writeToLorebookV2 } from './my_lorebook.js';
const SUBSECTION_DEBUG = "debug";
const KEY_DEBUG_CHAT_CONTENT = "my_debug";
const MIN_MESSAGES = 10;
const MESSAGES_TO_KEEP = 2;
export async function backup_visible_chat() {
    console.log("backup_visible_chat!");
    const context = getContext();
    await writeToLorebookCurrentVisibleChat(context);
    return "";
}
async function writeToLorebookCurrentVisibleChat(context) {
    try {
        if (context.characterId === undefined) {
            toastr.error("No character loaded.");
            return;
        }
        const chatHistory = context.chat;
        if (!(chatHistory && chatHistory.length > 0)) {
            toastr.error("Chat history is empty.");
            return;
        }
        const visibleWithIndices = chatHistory
            .map((msg, idx) => ({ msg, idx }))
            .filter(({ msg }) => !msg.is_system && !msg.is_extra);
        if (visibleWithIndices.length < MIN_MESSAGES) {
            toastr.warning(`Need at least ${MIN_MESSAGES} messages to backup. Currently ${visibleWithIndices.length}.`);
            return;
        }
        const toBackup = visibleWithIndices.slice(0, visibleWithIndices.length - MESSAGES_TO_KEEP);
        const strAcumulador = toBackup
            .map(({ msg }) => `${msg.name}: ${msg.mes}`)
            .join("\n");
        console.log(strAcumulador);
        toastr.info(`Backing up ${toBackup.length} messages (${strAcumulador.length} chars)`);
        await writeToLorebookV2(SUBSECTION_DEBUG, KEY_DEBUG_CHAT_CONTENT, strAcumulador, [], true);
        // Hide messages using ST's actual mechanism: is_system + DOM attribute update
        for (const { msg, idx } of toBackup) {
            msg.is_system = true;
            const messageBlock = $(`.mes[mesid="${idx}"]`);
            if (messageBlock.length) {
                messageBlock.attr('is_system', 'true');
            }
        }
        await saveChatConditional();
        toastr.success(`Backed up and hid ${toBackup.length} messages.`);
        return strAcumulador;
    }
    catch (error) {
        console.error('writeToLorebookCurrentVisibleChat error:', error);
        toastr.error(`Backup failed: ${error.message}`);
        return undefined;
    }
}
