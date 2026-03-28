# Style Guide — PF Fitness Tracker

## Design Philosophy
- **Mobile-first**: Design for phone screens at the gym, scale up to desktop
- **Fast interactions**: Logging a set should take < 3 taps
- **Clear hierarchy**: The most important action is always obvious
- **Encouraging tone**: Celebrate progress, never shame

## Color Palette

### Primary
| Name | Hex | Usage |
|------|-----|-------|
| Purple 600 | `#7C3AED` | Primary buttons, active states, brand accent |
| Purple 700 | `#6D28D9` | Primary hover |
| Purple 50 | `#F5F3FF` | Primary backgrounds |

### Secondary
| Name | Hex | Usage |
|------|-----|-------|
| Emerald 500 | `#10B981` | Success, goal achieved, PR badges |
| Amber 500 | `#F59E0B` | Warnings, streak fire icon |
| Red 500 | `#EF4444` | Errors, destructive actions |

### Neutrals
| Name | Hex | Usage |
|------|-----|-------|
| Slate 950 | `#020617` | Primary text |
| Slate 600 | `#475569` | Secondary text |
| Slate 400 | `#94A3B8` | Placeholder text |
| Slate 200 | `#E2E8F0` | Borders, dividers |
| Slate 50 | `#F8FAFC` | Page background |
| White | `#FFFFFF` | Card backgrounds |

### Why Purple?
Planet Fitness uses purple/yellow branding. We lean into the purple to feel familiar to PF members without using their exact branding or trademarked yellow.

## Typography

Using the default system font stack via Tailwind for performance:

```css
font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
```

| Element | Class | Size | Weight |
|---------|-------|------|--------|
| Page title | `text-2xl font-bold` | 24px | 700 |
| Section heading | `text-lg font-semibold` | 18px | 600 |
| Card title | `text-base font-semibold` | 16px | 600 |
| Body text | `text-sm` | 14px | 400 |
| Caption / label | `text-xs text-slate-600` | 12px | 400 |
| Numbers (weight, reps) | `text-lg font-mono font-bold` | 18px | 700 |

## Spacing & Layout

- Page padding: `px-4 py-6` (mobile), `px-8 py-8` (desktop)
- Card padding: `p-4`
- Gap between cards: `gap-4`
- Max content width: `max-w-lg` (mobile-optimized, centered on desktop)
- Border radius: `rounded-xl` for cards, `rounded-lg` for buttons/inputs

## Components

### Buttons
```
Primary:    bg-purple-600 text-white hover:bg-purple-700 rounded-lg px-4 py-2.5 font-medium
Secondary:  bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 rounded-lg px-4 py-2.5
Danger:     bg-red-500 text-white hover:bg-red-600 rounded-lg px-4 py-2.5
Ghost:      text-purple-600 hover:bg-purple-50 rounded-lg px-4 py-2.5
```
- Full width on mobile (`w-full`), auto-width on desktop
- Minimum tap target: 44px height

### Cards
```
bg-white rounded-xl border border-slate-200 p-4 shadow-sm
```

### Inputs
```
w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm
focus:ring-2 focus:ring-purple-600 focus:border-purple-600
```

### Number Inputs (for reps/weight)
- Large, easy-to-tap: `text-center text-2xl font-mono font-bold w-20 h-12`
- Increment/decrement buttons flanking the input
- Quick-select chips below for common values

### Badges / Tags
```
Muscle group:  bg-purple-50 text-purple-700 rounded-full px-2.5 py-0.5 text-xs font-medium
PR badge:      bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-0.5 text-xs font-medium
Streak:        bg-amber-50 text-amber-700 rounded-full px-2.5 py-0.5 text-xs font-medium
```

### Navigation
- Bottom tab bar on mobile (4 tabs: Dashboard, Workouts, Log, Goals)
- Sidebar on desktop
- Active tab: purple icon + text
- Inactive tab: slate-400 icon

## Iconography
Use Lucide React icons (included with shadcn/ui):
- Consistent size: `w-5 h-5` in nav, `w-4 h-4` inline
- Stroke width: default (2)

Key icons:
- Dashboard: `LayoutDashboard`
- Workouts: `Dumbbell`
- Log/Activity: `ClipboardList`
- Goals: `Target`
- Profile: `User`
- Timer: `Timer`
- Weight: `Scale`
- Streak: `Flame`
- PR: `Trophy`

## Motion & Animation
- Page transitions: none (keep it fast)
- Micro-interactions: subtle scale on button press (`active:scale-95 transition-transform`)
- Progress bars: animate width with `transition-all duration-500`
- Skeleton loaders: `animate-pulse` on loading states
- Rest timer: smooth countdown ring animation

## Responsive Breakpoints
| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Default | < 640px | Single column, bottom nav |
| `sm` | 640px | Slight padding increase |
| `md` | 768px | Two-column where useful |
| `lg` | 1024px | Sidebar nav, wider cards |

## Tone of Voice (UI Copy)
- **Encouraging**: "Great workout!" not "Workout saved."
- **Simple**: "Add exercise" not "Configure exercise parameters"
- **Direct**: "Log weight" not "Enter your current body weight measurement"
- **Celebratory**: Celebrate PRs, streaks, milestones with clear visual feedback
- No fitness jargon without explanation (tooltip for terms like RPE, 1RM)

## Dark Mode
Not in v1. Design with light mode only. When added later, use Tailwind `dark:` variants with Slate-based dark palette.
