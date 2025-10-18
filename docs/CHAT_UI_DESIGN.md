# CodeArt Chat UI - Visual Design Preview

## Mode Selector Design

```
┌─────────────────────────────────────────────────────────────┐
│                  Mode Selector Buttons                       │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌───────────┐              │
│  │  ● Agent  │  │  ◐  Ask   │  │  ▢  Plan  │              │
│  │  [ACTIVE] │  │           │  │           │              │
│  └───────────┘  └───────────┘  └───────────┘              │
│       │                                                      │
│       └──▼── Tooltip appears on hover:                     │
│             ┌────────────────────────────────┐             │
│             │ Agent Mode                     │             │
│             │ Iterative plan-act workflow    │             │
│             │ with full tool access, ...     │             │
│             └────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

### Mode Button States

**Default State (Inactive):**

```
┌─────────────┐
│  ◐  Ask     │  ← Subtle background
└─────────────┘     Semi-transparent icon
```

**Hover State:**

```
┌─────────────┐
│  ◐  Ask     │  ← Highlighted background
└─────────────┘     Border appears
                    Tooltip slides up
```

**Active State:**

```
┌─────────────┐
│  ● Agent    │  ← Accent color background
└─────────────┘     Full opacity icon
                    White text
```

## Model Selector Design

```
┌─────────────────────────────────────────────────────────────┐
│                     Model Selector                           │
├─────────────────────────────────────────────────────────────┤
│  🖥️ Model for this turn:  [Use default model ▼]           │
│                                                               │
│  When dropdown is opened:                                    │
│  ┌──────────────────────────────────────┐                   │
│  │ Use default model                    │ ← Default option  │
│  ├──────────────────────────────────────┤                   │
│  │ OpenAI                               │ ← Provider group  │
│  │   GPT-4o                             │                   │
│  │   GPT-4o Mini                        │                   │
│  │   O1                                 │                   │
│  ├──────────────────────────────────────┤                   │
│  │ Anthropic                            │                   │
│  │   Claude Sonnet 4                    │                   │
│  │   Claude 3.7 Sonnet                  │                   │
│  │   Claude 3.5 Sonnet                  │                   │
│  ├──────────────────────────────────────┤                   │
│  │ Google                               │                   │
│  │   Gemini 2.0 Flash                   │                   │
│  │   Gemini Exp 1206                    │                   │
│  └──────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## Complete Chat Input Area

```
┌─────────────────────────────────────────────────────────────────┐
│                      CodeArt Chat Input                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃            MODE SELECTOR (with tooltips)                  ┃  │
│  ┃  ┌───────────┐  ┌───────────┐  ┌───────────┐            ┃  │
│  ┃  │ ● Agent   │  │  ◐  Ask   │  │  ▢  Plan  │            ┃  │
│  ┃  └───────────┘  └───────────┘  └───────────┘            ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                                                   │
│  ⚠️  Read-only mode: editing actions are disabled              │
│  (Only shown when in Ask or Plan mode)                          │
│                                                                   │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃              MODEL SELECTOR                               ┃  │
│  ┃  🖥️ Model for this turn: [Claude Sonnet 4    ▼]        ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📎 README.md  ✕                                          │  │
│  │  File attachments appear here                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                             │  │
│  │  Ask anything...                                            │  │
│  │  (Type @ to reference files, # to search prompts)          │  │
│  │                                                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  [📝] [➕] [📥]                                          [✈️]  │
│  New  Attach Export                                    Send     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Color Scheme (VS Code Dark Theme)

```
Mode Buttons:
├─ Inactive: rgba(255, 255, 255, 0.04)
├─ Hover: rgba(255, 255, 255, 0.08)
├─ Active: rgba(14, 99, 156, 0.8)  [Blue accent]
└─ Text: #ffffff / #cccccc

Tooltips:
├─ Background: #252526  [Dark gray]
├─ Border: rgba(204, 204, 204, 0.2)
├─ Text: #cccccc
└─ Shadow: rgba(0, 0, 0, 0.4)

Model Selector:
├─ Background: rgba(255, 255, 255, 0.04)
├─ Border: rgba(255, 255, 255, 0.08)
├─ Hover: rgba(100, 150, 255, 0.5)  [Blue]
└─ Text: VS Code foreground color

Warnings:
├─ Background: rgba(241, 194, 27, 0.12)  [Amber]
├─ Border: rgba(241, 194, 27, 0.25)
├─ Text: #f1c21b
└─ Icon: #f1c21b
```

## Interactive Behavior

### Mode Switching Flow

```
User Action:        Visual Feedback:               System Action:
────────────────────────────────────────────────────────────────
1. Hover on "Ask"   → Highlight button            → Show tooltip
                    → Brighten icon                  after 0.2s

2. Click "Ask"      → Immediate active state      → Send mode
                    → Remove other active states     change to
                    → Show warning if read-only      extension

3. Leave hover      → Fade tooltip                → Update chat
                    → Return to active state         history UI
```

### Model Selection Flow

```
User Action:        Visual Feedback:               System Action:
────────────────────────────────────────────────────────────────
1. Focus dropdown   → Border highlight            → Request models
                    → Show dropdown arrow            if not loaded

2. Open dropdown    → Show grouped models         → Display all
                    → Scroll if needed               available models

3. Select model     → Update dropdown text        → Store selection
                    → Highlight selection            temporarily

4. Type message     → Normal input behavior       → Prepare message
                                                     with model

5. Send message     → Reset to "Use default"      → Override model
                    → Clear input                    for this turn

6. Response arrives → Show response               → Restore default
                                                     model
```

## Responsive Design

### Normal Width (>600px)

```
┌──────────────────────────────────────────┐
│  [Agent] [Ask] [Plan]                    │
│  🖥️ Model: [dropdown]                   │
│  ┌────────────────────────────────────┐ │
│  │ Input area...                       │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Narrow Width (<600px)

```
┌──────────────────────┐
│  [Agent]             │
│  [Ask] [Plan]        │
│                       │
│  🖥️ Model:          │
│  [dropdown]          │
│                       │
│  ┌─────────────────┐ │
│  │ Input...        │ │
│  └─────────────────┘ │
└──────────────────────┘
```

## Accessibility Features

### Keyboard Navigation

```
Tab Order:
1. Agent button     ← Press Enter to activate
2. Ask button       ← Press Enter to activate
3. Plan button      ← Press Enter to activate
4. Model selector   ← Arrow keys to navigate options
5. Input field      ← Type message
6. Action buttons   ← Tab through buttons
7. Send button      ← Press Enter to send
```

### Screen Reader Announcements

```
On mode change:
"Switched to Agent mode. Full editing capabilities enabled."

On read-only mode:
"Warning: Read-only mode active. Editing actions are disabled."

On model selection:
"Model for this turn: Claude Sonnet 4 selected from Anthropic provider."

On send:
"Message sent using Claude Sonnet 4. Model reset to default."
```

## Animation Timings

```
Transitions:
├─ Button hover: 0.2s ease
├─ Tooltip appear: 0.2s ease
├─ Tooltip slide: 0.2s ease (translateY(-12px))
├─ Mode switch: 0.2s ease
├─ Dropdown open: 0.15s ease
└─ Warning fade: 0.3s ease

Delays:
├─ Tooltip show: 0ms (instant)
├─ Tooltip hide: 0ms (instant)
└─ Reset model: 0ms (after send)
```

## Edge Cases Handled

1. **No models loaded**: Shows "Use default model" only
2. **Model unavailable**: Falls back to default silently
3. **Mode blocked action**: Shows info message to switch modes
4. **Rapid mode switching**: Debounced to prevent spam
5. **Model mid-response**: Cannot change until complete
6. **Connection loss**: Model override still applied locally

## Browser Compatibility

✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+
✅ VS Code Webview (Electron)

All features use standard CSS and JavaScript - no polyfills required.
