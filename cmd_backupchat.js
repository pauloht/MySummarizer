// @ts-ignore
import { getContext } from "../../../extensions.js";
// @ts-ignore
import { saveChatConditional } from "../../../script.js";
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
        const visibleMessages = chatHistory.filter(msg => {
            return !msg.is_system && !msg.force_hide && !msg.is_extra;
        });
        if (visibleMessages.length < MIN_MESSAGES) {
            toastr.warning(`Need at least ${MIN_MESSAGES} messages to backup. Currently ${visibleMessages.length}.`);
            return;
        }
        const messagesToBackup = visibleMessages.slice(0, visibleMessages.length - MESSAGES_TO_KEEP);
        const strAcumulador = messagesToBackup
            .map(msg => `${msg.name}: ${msg.mes}`)
            .join("\n");
        console.log(strAcumulador);
        toastr.info(`Backing up ${messagesToBackup.length} messages (${strAcumulador.length} chars)`);
        await writeToLorebookV2(SUBSECTION_DEBUG, KEY_DEBUG_CHAT_CONTENT, strAcumulador, [], true);
        for (const msg of messagesToBackup) {
            msg.force_hide = true;
        }
        await saveChatConditional();
        toastr.success(`Backed up and hid ${messagesToBackup.length} messages.`);
        return strAcumulador;
    }
    catch (error) {
        console.error('writeToLorebookCurrentVisibleChat error:', error);
        toastr.error(`Backup failed: ${error.message}`);
        return undefined;
    }
}
