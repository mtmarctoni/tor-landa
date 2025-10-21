# 🎁 Birthday Easter Egg Feature - Documentation

## Overview

A magical, hidden birthday experience that Landa can discover on her special day. The feature includes a password-protected secret gallery accessible only through a subtle hint in the birthday week message.

## 🔐 How It Works

### Step 1: The Hint

When navigating to **Week 43, 2025** (Landa's birthday week), the birthday message reads:

> "En este día especial, celebramos la luz que traes al mundo. Cada momento contigo transforma lo ordinario en extraordinario. ¡Feliz cumpleaños, Landa! Que este año esté lleno de aventuras inolvidables, y que descubras **Berlín** en todo su esplendor. 🎂✨💖"

The word **"Berlín"** appears in golden, glowing text with a sparkling ✨ animation, indicating it's clickable.

### Step 2: The Password Modal

Clicking "Berlín" triggers a beautiful modal:

- **Title**: "El Secreto de Landa"
- **Subtitle**: "Descubre algo especial preparado solo para ti"
- **Lock icon** with animated sparkles
- **Password input field** with hint: "¿Cuál es la palabra mágica? ✨"
- **Bottom hint**: "Pista: El mensaje tiene la respuesta 💫"

### Step 3: Password Entry

- **Correct password**: `berlin` (case-insensitive)
- **Attempts**: 3 maximum
- **Wrong answer feedback**: "Mmm... no es esa. Piensa en un lugar especial ✨"
- **After 3 failed attempts**: "Casi lo logras... tal vez mañana tengas más suerte 💫" (modal closes after 3 seconds)
- **Shake animation** on incorrect password

### Step 4: Success! 🎉

When the correct password is entered:

1. **Confetti explosion** - 30 animated emojis fall from top: 🎂🎉🎁✨💖🌟🎈
2. **Secret modal closes** smoothly
3. **Gallery modal opens** with celebration

### Step 5: The Secret Gallery

A full-screen immersive experience featuring:

#### Header

- Gradient background (rose → pink → amber)
- Animated title: "🎂 Para Ti, Landa 💖"
- Subtitle: "Momentos especiales capturados con amor"

#### Photo Carousel

- Beautiful image slider with smooth transitions
- Navigation arrows (left/right)
- Keyboard support (arrow keys + Escape to close)
- Photo counter (e.g., "1 / 3")
- Each photo has a personalized caption

#### Current Placeholder Photos

1. **dali1.webp** - "Cada momento contigo es un regalo ✨"
2. **dali2.webp** - "Los mejores recuerdos están por venir 💖"
3. **thekiss.jpg** - "Feliz cumpleaños, mi amor 🎂"

#### Footer Message

> "Feliz cumpleaños, mi amor. Estos son solo algunos de los momentos mágicos que hemos vivido juntos. Que este nuevo año esté lleno de más aventuras, risas y amor. Te quiero infinitamente. 💖✨"

## 🎨 Visual Design

### Color Palette

- **Primary**: Rose (#f43f5e), Pink (#ec4899), Amber (#fbbf24)
- **Backgrounds**: Soft gradients from rose-50 to pink-50
- **Text**: Rose-700 for headers, Rose-600 for body

### Animations

- **Confetti**: 30 emojis with random delays and positions
- **Password modal**: Spring animation on open, shake on error
- **Gallery**: Slide transitions between photos
- **Sparkles**: Rotating golden sparkle on "Berlín"
- **Hearts**: Pulsing decorations throughout

### Responsive Design

- Adapts to mobile, tablet, and desktop
- Touch-friendly on mobile devices
- Keyboard navigation for desktop users

## 🔧 Technical Implementation

### Files Created

1. **`src/components/BirthdaySecretModal.tsx`**

   - Password entry modal
   - 3-attempt limit system
   - Shake animation on error
   - Success callback to trigger gallery

2. **`src/components/BirthdayGalleryModal.tsx`**
   - Full-screen photo gallery
   - Carousel with navigation
   - Confetti celebration on open
   - Keyboard controls

### Files Modified

1. **`src/app/api/quality/route.ts`**

   - Updated week 43 message with Berlin hint
   - Message format: `**Berlín**` for clickable word

2. **`src/components/QualityCard.tsx`**
   - Added modal state management
   - `renderMessage()` function to parse **Berlín**
   - Click handler to open secret modal
   - Golden glow styling for clickable word

## 🎯 User Flow

```
Birthday Week (Week 43, 2025)
    ↓
Sees special birthday message
    ↓
Notices glowing "Berlín" word with sparkle ✨
    ↓
Clicks "Berlín"
    ↓
Password modal appears
    ↓
Enters "berlin"
    ↓
✨ SUCCESS! ✨
    ↓
Confetti explosion
    ↓
Gallery modal opens
    ↓
Browse photos with captions
    ↓
Feel loved 💖
```

## 📸 Next Steps: Notion Integration

### To Replace Placeholder Photos

1. **Create Notion Database** with columns:

   - `Image` (Files & media)
   - `Caption` (Text)
   - `Order` (Number)
   - `Active` (Checkbox)

2. **Update Gallery Component**:

```typescript
// In BirthdayGalleryModal.tsx
const [photos, setPhotos] = useState<Photo[]>([]);

useEffect(() => {
  const fetchPhotos = async () => {
    const response = await fetch("/api/birthday-photos");
    const data = await response.json();
    setPhotos(data.photos);
  };

  if (isOpen) {
    fetchPhotos();
  }
}, [isOpen]);
```

3. **Create API Route** (`src/app/api/birthday-photos/route.ts`):

```typescript
import { Client } from "@notionhq/client";

export async function GET() {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const dbId = process.env.BIRTHDAY_PHOTOS_DB_ID;

  const response = await notion.databases.query({
    database_id: dbId,
    filter: { property: "Active", checkbox: { equals: true } },
    sorts: [{ property: "Order", direction: "ascending" }],
  });

  // Process and return photos
}
```

## 🎁 Customization Options

### Change Password

In `BirthdaySecretModal.tsx`, line 23:

```typescript
if (password.toLowerCase().trim() === 'berlin') {
```

### Change Attempt Limit

Line 27:

```typescript
if (attempts >= 2) { // Change to desired limit - 1
```

### Customize Messages

Edit the footer message in `BirthdayGalleryModal.tsx`, lines 168-171

### Add More Photos

Simply add more objects to the `photos` array or integrate with Notion

## 🧪 Testing Instructions

### Manual Testing

1. Start dev server: `pnpm run dev`
2. Navigate to `http://localhost:3001`
3. Click navigation to go to **Week 43, 2025**
4. Look for golden "Berlín" in the message
5. Click it
6. Try wrong password first: "test"
7. See error message and shake animation
8. Enter correct password: "berlin"
9. Watch confetti celebration
10. Browse through photo gallery
11. Use arrow keys for navigation
12. Press Escape or click X to close

### Edge Cases Tested

- ✅ Case-insensitive password
- ✅ Whitespace trimming
- ✅ Maximum attempts limit
- ✅ Modal backdrop click to close
- ✅ Keyboard navigation
- ✅ Mobile touch support
- ✅ Animation performance

## 🌟 Special Features

### Subtle Discovery

- Word stands out but doesn't scream "click me"
- Only visible during birthday week
- Encourages curiosity and exploration

### Celebration Feel

- Confetti makes success feel rewarding
- Warm color palette feels loving
- Smooth animations feel polished

### Personal Touch

- Custom messages for each photo
- Heartfelt footer message
- Berlin reference is deeply personal

## 📝 Future Enhancements

- [ ] Add background music option
- [ ] Include video messages
- [ ] Add download option for photos
- [ ] Create shareable memory card
- [ ] Add voice message recording
- [ ] Include timeline of memories
- [ ] Add interactive elements (scratch cards, etc.)

---

**Password**: `berlin` (Don't tell Landa! 🤫)  
**Week**: 43, 2025  
**Trigger**: Click the golden "Berlín" in the birthday message

🎂✨💖
