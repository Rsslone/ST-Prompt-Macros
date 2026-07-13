# ST-Prompt-Macros

A [SillyTavern](https://github.com/SillyTavern/SillyTavern) extension that lets you define reusable `{{macroName}}` text blocks and drop them into any macro-enabled prompt field. Edit the macro once, it updates everywhere it's used. No more editing the same text blocks between profiles, set once, edit once.

## Features

- Editor to define and recall macros with the `{{macroName}}` syntax.
- Works in any macro-enabled field: Main Prompt, Post-History Instructions, Author's Note, and more.
- Macros can reference other SillyTavern macros (e.g. `{{char}}`, `{{user}}`), they are expanded at generation time, they can even reference other user defined macros.
- Per-macro enable/disable toggle — disable a macro without deleting it.
- Optional description field per macro, shown in SillyTavern's autocomplete.
- Full autocomplete support inside the macro editor.

## Installation

1. In SillyTavern, open **Extensions** (the plug icon in the top bar)
2. Click **Install Extension**
3. Paste the URL of this repository: `https://github.com/rsslone/ST-Prompt-Macros`
4. Click **Install** and reload if prompted

The extension will appear in the **Extensions** panel under **Prompt Macros**.

## Usage

### Creating a macro

1. Open the **Extensions** panel and expand **Prompt Macros**
2. Click **Add Macro**
3. Click the edit (pen) icon on the new entry to open the editor
4. Enter a **name** — this becomes `{{macroName}}` (lowercase, no spaces)
5. Optionally add a **description**, this appears in autocomplete hints
6. Write your content
7. Click **Save**

### Using a macro

Type `{{macroName}}` in any macro-enabled prompt field. The macro's content will be substituted at generation time.

### Example

Create a macro named `writing_style` with the content:

```
Write in a terse, literary style. Avoid adverbs. Prefer short sentences.
```

Then in your Main Prompt:

```
{{writing_style}}

Continue the story as {{char}}.
```

### Managing macros

| Button | Action |
|--------|--------|
| Toggle icon | Enable or disable the macro |
| Pen icon | Open the full editor |
| Trash icon | Delete the macro permanently |

## License

GPL-3.0 — see [LICENSE](LICENSE)
