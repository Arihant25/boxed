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
const hoursInput = document.getElementById('hours');
const minutesInput = document.getElementById('minutes');
const timerCancel = document.getElementById('timer-cancel');
const timerOk = document.getElementById('timer-ok');
const timerSound = document.getElementById('timer-sound');

// Application state
let isEditMode = true;
let currentFilePath = null;
let hasUnsavedChanges = false;
let countdownInterval = null;
let countdown = 0;
let fonts = ['Inter', 'Lora', 'Fira Sans'];
let currentFontIndex = 0;

// Random prompts
const prompts = [
  '# Write about a memory that changed your perspective on life',
  '# Describe a place that feels like home to you',
  '# If you could talk to your younger self, what would you say?',
  '# What would you do if you knew you couldn\'t fail?',
  '# Write about a skill you\'ve always wanted to learn'
];

// Initialize
function init() {
  updateWordCount();
  setupEventListeners();
  applySystemTheme();
}

// Setup event listeners
function setupEventListeners() {
  // Editor events
  markdownEditor.addEventListener('input', updateWordCount);
  document.addEventListener('keydown', handleKeyDown);

  // Status bar events
  editToggle.addEventListener('click', toggleEditMode);
  timerToggle.addEventListener('click', showTimerDialog);
  promptToggle.addEventListener('click', insertRandomPrompt);
  fontToggle.addEventListener('click', cycleFont);

  // Timer dialog events
  timerCancel.addEventListener('click', hideTimerDialog);
  timerOk.addEventListener('click', startTimer);
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
  // Simple Markdown to HTML conversion
  let html = markdownEditor.value
    // Headers
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
    .replace(/^##### (.*$)/gm, '<h5>$1</h5>')
    .replace(/^###### (.*$)/gm, '<h6>$1</h6>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Lists
    .replace(/^\s*\*\s(.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gm, '<ul>$1</ul>')// Blockquotes
    .replace(/^\>(.*$)/gm, '<blockquote>$1</blockquote>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Paragraphs
    .replace(/^\s*(\n)?(.+)/gm, function (m) {
      return /\<(\/)?(h1|h2|h3|ul|ol|li|blockquote|pre|code)/.test(m) ? m : '<p>' + m + '</p>';
    })
    // Clean up
    .replace(/<\/ul>\s?<ul>/g, '')
    .replace(/<\/p><p>/g, '</p>\n<p>');
  previewContainer.innerHTML = html;

  // Add event listeners to links in the preview
  const links = previewContainer.querySelectorAll('a');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openExternal(link.getAttribute('href'));
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

// Update timer display
function updateTimerDisplay() {
  const hours = Math.floor(countdown / 3600);
  const minutes = Math.floor((countdown % 3600) / 60);
  const seconds = countdown % 60;

  timerToggle.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Insert random prompt
function insertRandomPrompt() {
  const randomIndex = Math.floor(Math.random() * prompts.length);
  const prompt = prompts[randomIndex];

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
}

// Cycle through fonts
function cycleFont() {
  currentFontIndex = (currentFontIndex + 1) % fonts.length;
  const newFont = fonts[currentFontIndex];

  // Update editor and preview fonts
  markdownEditor.style.fontFamily = `var(--font-${newFont.toLowerCase().replace(' ', '-')})`;
  previewContainer.style.fontFamily = `var(--font-${newFont.toLowerCase().replace(' ', '-')})`;

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
