// Type stubs for SillyTavern globals and modules
// These are injected by SillyTavern at runtime in the browser

declare var toastr: {
    info(message: any, title?: string | null, options?: object): object;
    error(message: any, title?: string | null, options?: object): object;
    warning(message: any, title?: string | null, options?: object): object;
    success(message: any, title?: string | null, options?: object): object;
    clear(toast?: object): void;
};

declare var jQuery: any;
declare function $(selector: any): any;

// SillyTavern extension context shape (partial)
interface STContext {
    characterId: number | undefined;
    chat: STMessage[];
    generateRaw: (opts: { systemPrompt: string; prompt: string; prefill: string }) => Promise<string>;
}

interface STMessage {
    name: string;
    mes: string;
    is_system: boolean;
    is_extra: boolean;
}

interface WorldInfoEntry {
    comment: string;
    content: string;
    key: string[];
    disable: boolean;
    constant: boolean;
    order: number;
    position: number;
}

interface WorldInfoData {
    entries: Record<string, WorldInfoEntry>;
}

// Ambient module declarations for SillyTavern's relative imports
declare module "*extensions.js" {
    export const extension_settings: Record<string, any>;
    export function getContext(): STContext;
    export function loadExtensionSettings(defaults: object): Promise<void>;
}

declare module "*script.js" {
    export function getCurrentChatId(): string;
    export function saveChatConditional(): Promise<void>;
}

declare module "*world-info.js" {
    export function loadWorldInfo(name: string): Promise<WorldInfoData>;
    export function createWorldInfoEntry(bookName: string, data: WorldInfoData): WorldInfoEntry;
    export function saveWorldInfo(name: string, data: WorldInfoData, silent?: boolean): Promise<void>;
    export function reloadEditor(name: string): Promise<void>;
    export function createNewWorldInfo(name: string, options?: { interactive?: boolean }): Promise<boolean>;
}

declare module "*SlashCommandParser.js" {
    export const SlashCommandParser: {
        addCommandObject(cmd: any): void;
    };
}

declare module "*SlashCommand.js" {
    export const SlashCommand: {
        fromProps(props: { name: string; callback: (...args: any[]) => any; returns?: string }): any;
    };
}
