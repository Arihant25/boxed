# boxed | unbox your ideas

A minimal Markdown text editor built with Tauri and vanilla web technologies.

## Features

- **Simple Interface**: Clean, distraction-free writing environment
- **Markdown Support**: Write in Markdown and preview rendered content
- **File Operations**: Open and save .md files
- **Timer**: Set writing timers with audio notification when time's up
- **Writing Prompts**: Insert random writing prompts to get started
- **Font Cycling**: Choose between beautiful fonts for your writing

## Keyboard Shortcuts

- `Ctrl+E`: Toggle between edit and preview modes
- `Ctrl+O`: Open a Markdown file
- `Ctrl+S`: Save current content as a Markdown file

## Development

This application is built with:

- Tauri (Rust backend)
- HTML, CSS, and JavaScript (Frontend)
- No external dependencies

To run the development version:

```
npm run dev
```

To build for production:

```
npm run tauri build
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
