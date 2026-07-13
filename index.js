/**
 * Prompt Macros Extension for SillyTavern
 *
 * Allows users to define custom {{macroName}} snippets that can be
 * reused across prompt fields (Main Prompt, Post-History Instructions,
 * Author's Note, etc.). Edit once, use everywhere.
 */

import { extension_settings, renderExtensionTemplateAsync } from '../../../extensions.js';
import { saveSettingsDebounced, substituteParams } from '../../../../script.js';
import { macros } from '../../../macros/macro-system.js';
import { Popup, POPUP_TYPE } from '../../../popup.js';
import { enableMacroAutoCompleteById } from '../../../autocomplete/MacroAutoComplete.js';

const MODULE_NAME = 'third-party/ST-Prompt-Macros';
const SETTINGS_KEY = 'promptMacros';
const MACRO_CATEGORY = 'custom';

// Tracks which user macros are currently mid-expansion to catch circular references.
const expandingMacros = new Set();

const defaultSettings = {
    macros: [],
};

/** @type {Record<string, any>} */
const settings = extension_settings;

/**
 * Load settings from extension_settings, applying defaults.
 */
function loadSettings() {
    if (!settings[SETTINGS_KEY]) {
        settings[SETTINGS_KEY] = structuredClone(defaultSettings);
    }
    if (!Array.isArray(settings[SETTINGS_KEY].macros)) {
        settings[SETTINGS_KEY].macros = [];
    }
}

/**
 * @typedef {Object} MacroDef
 * @property {string} id
 * @property {string} name
 * @property {string} content
 * @property {boolean} enabled
 * @property {string} description
 */

/**
 * Get the macros array from settings.
 * @returns {MacroDef[]}
 */
function getMacros() {
    return settings[SETTINGS_KEY].macros;
}

/**
 * Save settings to the extension store and persist.
 */
function saveSettings() {
    saveSettingsDebounced();
}

/**
 * Generate a short unique ID.
 * @returns {string}
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ─── Macro Registry Management ───────────────────────────────────────────────

/**
 * Register a single user macro in the MacroRegistry.
 * @param {MacroDef} macro - The macro definition from settings.
 */
function registerSingleMacro(macro) {
    const content = macro.content;
    macros.register(macro.name, {
        category: MACRO_CATEGORY,
        description: macro.description || 'User-defined prompt macro',
        exampleUsage: [`{{${macro.name}}}`],
        handler: () => {
            if (expandingMacros.has(macro.name)) {
                /** @type {any} */ (window).toastr?.warning?.(`Macro loop detected: {{${macro.name}}} references itself.`);
                return '';
            }
            expandingMacros.add(macro.name);
            try {
                return substituteParams(content);
            } finally {
                expandingMacros.delete(macro.name);
            }
        },
    });
}

/**
 * Re-register all user macros with the MacroRegistry.
 * Unregisters any previously registered user macros first.
 */
function registerAllMacros() {
    for (const macro of getMacros()) {
        if (macro.name) {
            try {
                macros.registry.unregisterMacro(macro.name);
            } catch {
                // Not registered, ignore
            }
        }
    }

    const registeredNames = new Set();
    for (const macro of getMacros()) {
        if (!macro.enabled || !macro.name) continue;
        const key = macro.name.toLowerCase();
        if (registeredNames.has(key)) {
            /** @type {any} */ (window).toastr?.warning?.(`Duplicate enabled macro "{{${macro.name}}}" — only the first one will be used.`);
            continue;
        }
        registeredNames.add(key);
        registerSingleMacro(macro);
    }
}

// ─── UI: Compact List ────────────────────────────────────────────────────────

/**
 * Render the list of macro rows into the container.
 */
function renderMacroList() {
    const container = document.getElementById('prompt_macros_list');
    if (!container) return;

    const macroList = getMacros();
    container.innerHTML = '';

    if (macroList.length === 0) {
        container.innerHTML = '<div class="prompt-macro-no-macros">No macros defined yet. Click "Add Macro" to create one.</div>';
        return;
    }

    for (const macro of macroList) {
        container.appendChild(createMacroRow(macro));
    }
}

/**
 * Create a single compact row for a macro.
 * @param {MacroDef} macro
 * @returns {HTMLElement}
 */
function createMacroRow(macro) {
    const row = document.createElement('div');
    row.className = 'prompt-macro-row';
    row.dataset.id = macro.id;

    // ── Name ──
    const nameSpan = document.createElement('span');
    nameSpan.className = 'macro-name';
    nameSpan.textContent = `{{${macro.name || '(unnamed)'}}}`;

    // ── Content preview ──
    const previewSpan = document.createElement('span');
    previewSpan.className = 'macro-preview';
    const previewText = (macro.content || '(empty)').replace(/\n/g, ' ');
    previewSpan.textContent = previewText.length > 80 ? previewText.substring(0, 80) + '…' : previewText;

    // ── Actions group ──
    const actions = document.createElement('div');
    actions.className = 'macro-row-actions';

    // Enable/disable toggle
    const toggleBtn = document.createElement('div');
    toggleBtn.className = 'menu_button menu_button_icon small';
    toggleBtn.title = macro.enabled ? 'Enabled – click to disable' : 'Disabled – click to enable';
    toggleBtn.innerHTML = macro.enabled
        ? '<i class="fa-solid fa-toggle-on"></i>'
        : '<i class="fa-solid fa-toggle-off opacity50p"></i>';
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        macro.enabled = !macro.enabled;
        saveSettings();
        registerAllMacros();
        renderMacroList();
    });

    // Edit button
    const editBtn = document.createElement('div');
    editBtn.className = 'menu_button menu_button_icon small';
    editBtn.title = 'Edit macro';
    editBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditor(macro);
    });

    // Delete button
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'menu_button menu_button_icon small';
    deleteBtn.title = 'Delete macro';
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (macro.name) {
            try { macros.registry.unregisterMacro(macro.name); } catch { /* not registered */ }
        }
        const list = getMacros();
        const idx = list.findIndex(m => m.id === macro.id);
        if (idx !== -1) list.splice(idx, 1);
        saveSettings();
        renderMacroList();
    });

    actions.append(toggleBtn, editBtn, deleteBtn);
    row.append(nameSpan, previewSpan, actions);
    return row;
}

// ─── UI: Popup Editor ────────────────────────────────────────────────────────

/**
 * Build the HTML content for the popup editor.
 * @param {MacroDef} macro
 * @returns {string}
 */
function buildEditorHtml(macro) {
    return `
        <div class="prompt-macro-editor-popup">
            <input id="pm-popup-name" class="text_pole" type="text"
                   placeholder="Macro Name"
                   value="${(macro.name || '').replace(/"/g, '&quot;')}" />
            <input id="pm-popup-desc" class="text_pole" type="text"
                   placeholder="Description (Optional - for auto complete)"
                   value="${(macro.description || '').replace(/"/g, '&quot;')}" />
            <textarea id="pm-popup-content" class="text_pole" rows="20"
                   data-macros data-macros-autocomplete="always"
                   data-macros-autocomplete-style="expanded">${(macro.content || '').replace(/</g, '&lt;')}</textarea>
        </div>
    `;
}

/**
 * Open a large popup editor for a macro's content.
 * @param {MacroDef} macro - The macro definition to edit.
 */
async function openEditor(macro) {
    const contentHtml = buildEditorHtml(macro);

    const popup = new Popup(
        contentHtml,
        POPUP_TYPE.CONFIRM,
        '',
        {
            okButton: 'Save',
            cancelButton: 'Cancel',
            wide: true,
            large: true,
            onOpen: () => {
                setTimeout(() => enableMacroAutoCompleteById('pm-popup-content'), 0);
            },
            onClosing: (/** @type {Popup} */ popup) => {
                // Allow cancel through without validation
                if (popup.result === 0) return true;

                const nameInput = /** @type {HTMLInputElement | null} */ (document.getElementById('pm-popup-name'));
                const descInput = /** @type {HTMLInputElement | null} */ (document.getElementById('pm-popup-desc'));
                const contentInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('pm-popup-content'));
                const newName = (nameInput?.value || '').trim().toLowerCase();
                const newDesc = (descInput?.value || '').trim();
                const newContent = contentInput?.value || '';

                if (!newName) {
                    return false;
                }

                if (macro.name !== newName && macro.name) {
                    try { macros.registry.unregisterMacro(macro.name); } catch { /* not registered */ }
                }

                macro.name = newName;
                macro.description = newDesc;
                macro.content = newContent;

                saveSettings();
                registerAllMacros();
                renderMacroList();
                return true;
            },
        },
    );

    await popup.show();
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

function setupListeners() {
    $('#prompt_macros_add').off('click').on('click', addMacro);
}

/**
 * Add a new empty macro entry and scroll it into view.
 * The user clicks the edit button to open the editor when ready.
 */
async function addMacro() {
    const list = getMacros();
    const newMacro = {
        id: generateId(),
        name: '',
        content: '',
        enabled: true,
        description: '',
    };
    list.push(newMacro);
    saveSettings();
    registerAllMacros();
    renderMacroList();

    // Scroll the new entry into view
    setTimeout(() => {
        const entry = document.querySelector(`[data-id="${newMacro.id}"]`);
        entry?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
}

// ─── Extension Entry Point ────────────────────────────────────────────────────

/**
 * Called by SillyTavern when the extension is disabled or unloaded.
 */
export function clean() {
    for (const macro of getMacros()) {
        if (macro.name) {
            try { macros.registry.unregisterMacro(macro.name); } catch { /* not registered */ }
        }
    }
}

/**
 * Called by SillyTavern when the extension is activated.
 */
export async function init() {
    loadSettings();

    const settingsHtml = await renderExtensionTemplateAsync(MODULE_NAME, 'settings');
    $('#extensions_settings2').append(settingsHtml);

    setupListeners();
    renderMacroList();
    registerAllMacros();

    const enabledCount = getMacros().filter(m => m.enabled).length;
    console.log(`Prompt Macros: loaded ${getMacros().length} macros (${enabledCount} active)`);
}
