

## Fix: Hero Card Background Missing

### Problem
The Home hero card uses a CSS class `hero-purple` that was never defined in `src/index.css`. Without it, the card has no background — white text renders on the cream page background, making it invisible.

### Solution

**`src/index.css`** — Add the missing class:
```css
.hero-purple {
  background: #6B21A8;
}
```

That's it — one line fix. The rest of the hero card markup (white text, decorative circle, Live pill, Talk button) is already correct and will become visible once the purple background is applied.

