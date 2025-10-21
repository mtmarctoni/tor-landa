# 🎁 Birthday Easter Egg - Quick Start Guide

## 🚀 How to Test Right Now

### Step 1: Start the App

```bash
pnpm run dev
```

Open: `http://localhost:3001`

### Step 2: Navigate to Birthday Week

- Click **"Siguiente semana →"** multiple times until you reach **Week 43, 2025**
- Or use keyboard: Press **Right Arrow** repeatedly

### Step 3: Look for the Hint

You'll see the birthday message:

> "...y que descubras **Berlín** en todo su esplendor..."

**"Berlín"** will be displayed in **golden glowing text** with a ✨ sparkle animation.

### Step 4: Click "Berlín"

- A beautiful modal appears: **"El Secreto de Landa"**
- It asks for a password

### Step 5: Test Wrong Password First

- Type: `test` or `wrong`
- Click **"Descubrir el secreto"**
- See the shake animation and error message
- Try 2 more wrong passwords to see the lockout

### Step 6: Enter Correct Password

- Refresh the page and navigate back to Week 43
- Click "Berlín" again
- Type: `berlin`
- Click **"Descubrir el secreto"**

### Step 7: Enjoy the Magic! ✨

- **Confetti explosion** with 30 falling emojis
- **Secret gallery opens** automatically
- Browse photos with arrow keys or navigation buttons
- Read the personalized captions
- Close with X button or Escape key

## 🎨 What to Look For

### Visual Highlights

- ✅ Golden glowing "Berlín" text
- ✅ Rotating sparkle ✨ on the word
- ✅ Password modal with lock icon
- ✅ Shake animation on wrong password
- ✅ Confetti celebration on success
- ✅ Smooth transitions between modals
- ✅ Beautiful photo carousel
- ✅ Heart-decorated captions

### Interactive Elements

- ✅ Hover effect on "Berlín"
- ✅ Click/tap to open modal
- ✅ Input field with auto-focus
- ✅ Button states (enabled/disabled)
- ✅ Keyboard navigation (arrows, escape)
- ✅ Touch-friendly on mobile

## 🔐 Important Information

**Password**: `berlin` (case-insensitive)  
**Max Attempts**: 3  
**Week**: 43, 2025  
**Trigger**: Click golden "Berlín" in birthday message

## 📱 Testing Checklist

### Desktop

- [ ] Navigate to Week 43
- [ ] See golden "Berlín"
- [ ] Hover shows scale effect
- [ ] Click opens password modal
- [ ] Wrong password shows error + shake
- [ ] Correct password triggers confetti
- [ ] Gallery opens smoothly
- [ ] Arrow keys work for navigation
- [ ] Escape closes gallery
- [ ] X button works

### Mobile

- [ ] Navigate to Week 43
- [ ] "Berlín" is clearly visible
- [ ] Tap opens password modal
- [ ] Keyboard appears for input
- [ ] Touch navigation works
- [ ] Swipe gestures work
- [ ] Gallery is responsive

### Edge Cases

- [ ] Case-insensitive: "BERLIN", "Berlin", "berlin" all work
- [ ] Whitespace: " berlin " works
- [ ] 3 failed attempts locks modal
- [ ] Can retry after page refresh
- [ ] Multiple photos in gallery work
- [ ] Captions display correctly

## 🎯 Expected Behavior

### On Correct Password

1. ✨ Modal fades out
2. 🎉 Confetti starts falling (5 seconds)
3. 🖼️ Gallery fades in
4. 💖 Heart decorations appear
5. 📸 Can browse photos
6. ✅ Can reopen anytime during birthday week

### On Wrong Password

1. ⚠️ Modal shakes
2. ❌ Error message shows
3. 🔄 Input clears
4. 📊 Attempt counter increments
5. 🚫 After 3 attempts, modal closes

## 🐛 Troubleshooting

### "Berlín" not clickable?

- Make sure you're on Week 43, 2025
- Check that the word appears in golden color
- Try clicking directly on the word

### Modal not opening?

- Check browser console for errors
- Ensure JavaScript is enabled
- Try refreshing the page

### Password not working?

- Type exactly: `berlin`
- Check for extra spaces
- Make sure Caps Lock is off
- Try lowercase: `berlin`

### Gallery photos not loading?

- Currently using placeholder images
- Check `/public/images/` folder
- For Notion integration, see EASTER_EGG_DOCS.md

## 🎨 Customization

### Change Password

Edit `src/components/BirthdaySecretModal.tsx`, line 23:

```typescript
if (password.toLowerCase().trim() === 'berlin') {
```

### Add More Photos

Edit `src/components/BirthdayGalleryModal.tsx`, lines 16-28:

```typescript
const photos: Photo[] = [
  { url: "/path/to/photo.jpg", caption: "Your caption" },
  // Add more...
];
```

### Modify Messages

- Birthday message: `src/app/api/quality/route.ts`
- Gallery footer: `src/components/BirthdayGalleryModal.tsx`
- Modal text: `src/components/BirthdaySecretModal.tsx`

## 📸 Screenshot Moments

Take screenshots of:

1. Golden "Berlín" with sparkle
2. Password modal appearance
3. Error message with shake
4. Confetti explosion
5. Gallery with first photo
6. All captions

---

**Ready to test?** Run `pnpm run dev` and navigate to Week 43! 🎂✨

🎉 Have fun discovering the secret! 💖
