// Tauri API imports
const { invoke } = window.__TAURI__.tauri;
const { open, save } = window.__TAURI__.dialog;
const { readTextFile, writeTextFile } = window.__TAURI__.fs;
const { open: openExternal } = window.__TAURI__.shell;

// DOM elements
const markdownEditor = document.getElementById('markdown-editor');
const previewContainer = document.getElementById('preview-container');
const statusBar = document.getElementById('status-bar');
const editToggle = document.getElementById('edit-toggle');
const timerToggle = document.getElementById('timer-toggle');
const promptToggle = document.getElementById('prompt-toggle');
const wordCount = document.getElementById('word-count');
const fontToggle = document.getElementById('font-toggle');
const timerDialog = document.getElementById('timer-dialog');
const promptDialog = document.getElementById('prompt-dialog');
const hoursInput = document.getElementById('hours');
const minutesInput = document.getElementById('minutes');
const timerCancel = document.getElementById('timer-cancel');
const timerOk = document.getElementById('timer-ok');
const timerSound = document.getElementById('timer-sound');
const fictionOption = document.getElementById('fiction-option');
const nonfictionOption = document.getElementById('nonfiction-option');
const promptCancel = document.getElementById('prompt-cancel');

// Application state
let isEditMode = true;
let currentFilePath = null;
let hasUnsavedChanges = false;
let countdownInterval = null;
let countdown = 0;
let fonts = ['Signika', 'Merriweather', 'Delius', 'IBM Plex Mono'];
let currentFontIndex = 0;

// Prompts
let prompts = {
  fiction: [],
  nonfiction: []
};

// Initialize
async function init() {
  updateWordCount();
  await loadPrompts();
  setupEventListeners();
  applySystemTheme();
}

// Load prompts from JSON file
async function loadPrompts() {
  try {
    const promptsJson = await readTextFile('src/prompt.json');
    const promptsData = JSON.parse(promptsJson);
    prompts.fiction = promptsData.fiction;
    prompts.nonfiction = promptsData.nonfiction;
  } catch (err) {
    console.error('Error loading prompts:', err);
    // Fallback to default prompts if file can't be loaded
    prompts.fiction = [
      '# Write a story about a character who discovers a hidden door in their house'
    ];
    prompts.nonfiction = [
      '# Write about a memory that changed your perspective on life'
    ];
  }
}

// Setup event listeners
function setupEventListeners() {
  // Editor events
  markdownEditor.addEventListener('input', updateWordCount);
  document.addEventListener('keydown', handleKeyDown);

  // Status bar events
  editToggle.addEventListener('click', toggleEditMode);
  timerToggle.addEventListener('click', showTimerDialog);
  promptToggle.addEventListener('click', showPromptDialog);
  fontToggle.addEventListener('click', cycleFont);

  // Timer dialog events
  timerCancel.addEventListener('click', hideTimerDialog);
  timerOk.addEventListener('click', startTimer);

  // Prompt dialog events
  promptCancel.addEventListener('click', hidePromptDialog);
  fictionOption.addEventListener('click', () => insertRandomPrompt('fiction'));
  nonfictionOption.addEventListener('click', () => insertRandomPrompt('nonfiction'));
}

// Toggle between edit and preview mode
function toggleEditMode() {
  isEditMode = !isEditMode;

  if (isEditMode) {
    markdownEditor.classList.remove('hidden');
    previewContainer.classList.add('hidden');
    editToggle.textContent = 'Edit';
  } else {
    renderMarkdown();
    markdownEditor.classList.add('hidden');
    previewContainer.classList.remove('hidden');
    editToggle.textContent = 'Preview';
  }
}

// Render markdown to HTML
function renderMarkdown() {
  // Advanced Markdown to HTML conversion
  let html = markdownEditor.value
    // Escape HTML tags for safety (except for already processed content)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

    // Headers
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
    .replace(/^##### (.*$)/gm, '<h5>$1</h5>')
    .replace(/^###### (.*$)/gm, '<h6>$1</h6>')

    // Horizontal rules
    .replace(/^\s*(\*\*\*|\-\-\-|\_\_\_)\s*$/gm, '<hr />')

    // Bold (both ** and __ syntax)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\_\_(.*?)\_\_/g, '<strong>$1</strong>')

    // Italic (both * and _ syntax)
    .replace(/\*([^\*]+)\*/g, '<em>$1</em>')
    .replace(/\_([^\_]+)\_/g, '<em>$1</em>')    // Strikethrough
    .replace(/\~\~(.*?)\~\~/g, '<del>$1</del>')    // Superscript - using ^ for superscript text
    .replace(/\^([^\^]+)\^/g, '<sup>$1</sup>')

    // Subscript - using ~ for subscript (single tilde, different from strikethrough's double tilde)
    .replace(/\~([^~]+)\~/g, '<sub>$1</sub>')

    // Code blocks with language support
    .replace(/```(\w*)\n([^`]+)```/g, function (match, lang, code) {
      return '<pre class="language-' + (lang || 'plaintext') + '"><code>' + code.trim() + '</code></pre>';
    })

    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')    // Task lists
    .replace(/^\s*- \[ \] (.*$)/gm, '<li class="task-list-item"><input type="checkbox" disabled> $1</li>')
    .replace(/^\s*- \[x\] (.*$)/gmi, '<li class="task-list-item"><input type="checkbox" checked disabled> $1</li>')

    // Unordered lists (*, -, +)
    .replace(/^\s*[\*\-\+]\s(.*$)/gm, '<li>$1</li>')    // Wrap lists properly
    .replace(/((^<li>.*<\/li>\s*)+)/gm, function (match) {
      // Check if the list contains task items
      if (match.includes('task-list-item')) {
        return '<ul class="task-list">' + match + '</ul>';
      }
      else {
        return '<ul>' + match + '</ul>';
      }
    })

    // Preserve numbered lists as paragraph text with original numbers
    .replace(/^\s*(\d+)\. (.*$)/gm, '<p>$1. $2</p>')// Blockquotes - process multiple lines together

    // Images
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">')

    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

    // Tables (basic support)
    .replace(/^\|(.+)\|$/gm, function (match, content) {
      const cells = content.split('|').map(cell => cell.trim());
      const row = cells.map(cell => `<td>${cell}</td>`).join('');
      return `<tr>${row}</tr>`;
    })
    .replace(/(^<tr>.+<\/tr>\s*)+/gm, function (match) {
      // Check if the table has a header row (contains '---')
      if (/\|\s*\-+\s*\|/.test(match)) {
        // Extract header and body
        const rows = match.trim().split('\n');
        const headerRow = rows[0];
        // Skip the separator row
        const bodyRows = rows.slice(2).join('\n');
        // Convert header cells from <td> to <th>
        const header = headerRow.replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
        return `<table><thead>${header}</thead><tbody>${bodyRows}</tbody></table>`;
      } else {
        return `<table><tbody>${match}</tbody></table>`;
      }
    })
    .replace(/\|\s*[\-:]+\s*\|/g, '') // Remove table header separator row    // Paragraphs (excluding elements that shouldn't be wrapped)
    .replace(/^\s*(\n)?(.+)/gm, function (m) {
      return /\<(\/)?(h\d|ul|ol|li|blockquote|pre|code|hr|table|tr|td|th|thead|tbody)/.test(m) ? m : '<p>' + m + '</p>';
    })

    // Clean up duplicated tags
    .replace(/<\/ul>\s?<ul>/g, '')
    .replace(/<\/ol>\s?<ol>/g, '')
    .replace(/<\/p><p>/g, '</p>\n<p>')
    .replace(/<\/blockquote><blockquote>/g, '<br>')

    // Restore certain safe HTML tags
    .replace(/&lt;br&gt;/g, '<br>')
    .replace(/&lt;hr&gt;/g, '<hr>'); previewContainer.innerHTML = html;

  // Add event listeners to links in the preview
  const links = previewContainer.querySelectorAll('a');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openExternal(link.getAttribute('href'));
    });
  });

  // Add event listeners to checkboxes in task lists (for visual feedback only)
  const checkboxes = previewContainer.querySelectorAll('.task-list-item input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent actual toggle since we want it to remain as in the markdown
    });
  });
}

// Update word count
function updateWordCount() {
  const text = markdownEditor.value.trim();
  const wordArray = text === '' ? [] : text.split(/\s+/);
  const count = wordArray.length;
  wordCount.textContent = `${count} word${count === 1 ? '' : 's'}`;

  // Set unsaved changes flag and update file name display
  if (currentFilePath) {
    hasUnsavedChanges = true;
    updateFileNameDisplay();
  }
}

// Handle keyboard shortcuts
function handleKeyDown(e) {
  // Ctrl+E: Toggle edit mode
  if (e.ctrlKey && e.key === 'e') {
    e.preventDefault();
    toggleEditMode();
  }

  // Ctrl+O: Open file
  if (e.ctrlKey && e.key === 'o') {
    e.preventDefault();
    openFile();
  }

  // Ctrl+S: Save file
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    saveFile();
  }
}

// Open file dialog
async function openFile() {
  try {
    // Show open dialog
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Markdown',
        extensions: ['md', 'markdown']
      }]
    });

    if (selected) {
      // Read file content
      const content = await readTextFile(selected);

      // Update editor with file content
      markdownEditor.value = content;
      currentFilePath = selected;
      hasUnsavedChanges = false;
      updateWordCount();
      updateFileNameDisplay();

      // Switch to edit mode
      if (!isEditMode) {
        toggleEditMode();
      }
    }
  } catch (err) {
    console.error('Error opening file:', err);
  }
}

// Save file dialog
async function saveFile() {
  try {
    // If file was already saved once, save directly to the same path
    if (currentFilePath) {
      await writeTextFile(currentFilePath, markdownEditor.value);
      hasUnsavedChanges = false;
      updateFileNameDisplay();
      return;
    }

    // Show save dialog if first save
    const filePath = await save({
      filters: [{
        name: 'Markdown',
        extensions: ['md']
      }],
      defaultPath: currentFilePath
    });

    if (filePath) {
      // Save content to file
      await writeTextFile(filePath, markdownEditor.value);
      currentFilePath = filePath;
      hasUnsavedChanges = false;
      updateFileNameDisplay();
    }
  } catch (err) {
    console.error('Error saving file:', err);
  }
}

// Update file name display in status bar
function updateFileNameDisplay() {
  if (currentFilePath) {
    const fileName = currentFilePath.split(/[\/\\]/).pop();
    const fileNameElement = document.getElementById('file-name') || document.createElement('span');

    if (!document.getElementById('file-name')) {
      fileNameElement.id = 'file-name';
      document.querySelector('.status-left').appendChild(fileNameElement);
    }

    // Add asterisk (*) if there are unsaved changes
    fileNameElement.textContent = hasUnsavedChanges ? `${fileName} *` : fileName;
  }
}

// Show timer dialog
function showTimerDialog() {
  timerDialog.classList.remove('hidden');
}

// Hide timer dialog
function hideTimerDialog() {
  timerDialog.classList.add('hidden');
}

// Start timer
function startTimer() {
  const hours = parseInt(hoursInput.value) || 0;
  const minutes = parseInt(minutesInput.value) || 0;

  if (hours === 0 && minutes === 0) {
    hideTimerDialog();
    return;
  }

  // Clear existing timer
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  // Calculate total seconds
  countdown = (hours * 60 * 60) + (minutes * 60);

  // Update timer display
  updateTimerDisplay();

  // Start countdown
  countdownInterval = setInterval(() => {
    countdown--;

    if (countdown <= 0) {
      clearInterval(countdownInterval);
      timerSound.play();
      timerToggle.textContent = 'Timer';
    } else {
      updateTimerDisplay();
    }
  }, 1000);
  hideTimerDialog();
}

// Show prompt dialog
function showPromptDialog() {
  promptDialog.classList.remove('hidden');
}

// Hide prompt dialog
function hidePromptDialog() {
  promptDialog.classList.add('hidden');
}

// Update timer display
function updateTimerDisplay() {
  const hours = Math.floor(countdown / 3600);
  const minutes = Math.floor((countdown % 3600) / 60);
  const seconds = countdown % 60;

  timerToggle.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Insert random prompt
function insertRandomPrompt(promptType) {
  if (!promptType || !prompts[promptType] || !prompts[promptType].length) {
    console.error('Invalid prompt type or no prompts available');
    return;
  }

  const promptArray = prompts[promptType];
  const randomIndex = Math.floor(Math.random() * promptArray.length);
  const prompt = promptArray[randomIndex];

  // Insert at cursor position or beginning
  const cursorPos = markdownEditor.selectionStart;
  const textBefore = markdownEditor.value.substring(0, cursorPos);
  const textAfter = markdownEditor.value.substring(cursorPos);

  markdownEditor.value = textBefore + prompt + '\n\n' + textAfter;
  updateWordCount();

  // Switch to edit mode if in preview
  if (!isEditMode) {
    toggleEditMode();
  }

  // Focus editor
  markdownEditor.focus();

  // Hide the prompt dialog
  hidePromptDialog();
}

// Cycle through fonts
function cycleFont() {
  currentFontIndex = (currentFontIndex + 1) % fonts.length;
  const newFont = fonts[currentFontIndex];

  // Transform font name to match CSS variable format
  let fontVar = newFont.toLowerCase().replace(/\s+/g, '-');

  // Update editor and preview fonts
  markdownEditor.style.fontFamily = `var(--font-${fontVar})`;
  previewContainer.style.fontFamily = `var(--font-${fontVar})`;

  // Update font toggle text
  fontToggle.textContent = newFont;
}

// Call init function when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Apply system theme (dark or light)
function applySystemTheme() {
  // Check if system prefers dark mode
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', prefersDarkMode ? 'dark' : 'light');

  // Listen for changes in the system theme
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
  });
}
