# 🎂 Notion Integration for Birthday Photos

## ✅ Setup Complete!

I've successfully created the Notion database and API integration for Landa's birthday photo gallery.

## 📊 Notion Database Details

### Database Information

- **Database Name**: "Landa Birthday Gallery"
- **Database ID**: `28f3914189d381be9ec1f8ee3c1780c1`
- **Parent Page**: "Tor Landa - Birthday Photos"
- **Notion URL**: https://www.notion.so/28f3914189d381be9ec1f8ee3c1780c1

### Database Schema

| Property    | Type          | Description                            |
| ----------- | ------------- | -------------------------------------- |
| **Name**    | Title         | Name/identifier for the photo          |
| **Image**   | Files & media | The actual photo file                  |
| **Caption** | Rich text     | Personal message/caption for the photo |
| **Order**   | Number        | Display order (1, 2, 3, etc.)          |
| **Active**  | Checkbox      | Toggle to show/hide photo in gallery   |

### Sample Entries Created

I've created 3 placeholder entries to demonstrate the structure:

1. **Photo 1 - Placeholder**

   - Caption: "Cada momento contigo es un regalo ✨"
   - Order: 1
   - Active: ✅

2. **Photo 2 - Placeholder**

   - Caption: "Los mejores recuerdos están por venir 💖"
   - Order: 2
   - Active: ✅

3. **Photo 3 - Placeholder**
   - Caption: "Feliz cumpleaños, mi amor 🎂"
   - Order: 3
   - Active: ✅

## 🔧 Technical Implementation

### API Route Created

**File**: `/src/app/api/birthday-photos/route.ts`

**Endpoint**: `GET /api/birthday-photos`

**Features**:

- Fetches photos from Notion database
- Filters only active photos (`Active = true`)
- Sorts by Order number (ascending)
- Returns both external and Notion-hosted images
- Graceful error handling
- Falls back to placeholder images if API fails

**Response Format**:

```json
{
  "photos": [
    {
      "url": "https://image-url.com/photo.jpg",
      "caption": "Cada momento contigo es un regalo ✨"
    }
  ],
  "count": 3
}
```

### Gallery Component Updated

**File**: `/src/components/BirthdayGalleryModal.tsx`

**New Features**:

- Fetches photos from API when modal opens
- Loading state with animated spinner
- Error handling with fallback to placeholders
- Empty state message
- Dynamic photo count and captions
- Safe navigation (handles missing photos)

## 📸 How to Add Photos to Notion

### Step 1: Open the Database

Visit: https://www.notion.so/28f3914189d381be9ec1f8ee3c1780c1

Or navigate in Notion:

- Workspace: MTM
- Page: vs-code-notion → Tor Landa - Birthday Photos → Landa Birthday Gallery

### Step 2: Add a New Entry

1. Click **"+ New"** button in the database
2. Fill in the fields:
   - **Name**: Give it a descriptive name (e.g., "Paris Trip 2024")
   - **Image**: Click to upload a photo
     - You can upload from your computer
     - Or paste an image URL (external link)
   - **Caption**: Write a personal message
     - Example: "Nuestra primera aventura juntos 🗼✨"
   - **Order**: Enter a number (1, 2, 3, etc.)
     - This controls the display order
     - Lower numbers appear first
   - **Active**: Check the box ✅
     - Only checked photos will appear in the gallery
     - Uncheck to hide a photo temporarily

### Step 3: Organize Photos

- Photos are displayed in **Order** (1, 2, 3...)
- You can reorder anytime by changing the Order number
- Use **Active** checkbox to control visibility:
  - ✅ Checked = Visible in gallery
  - ☐ Unchecked = Hidden

### Step 4: Test

1. Save your changes in Notion
2. Navigate to Week 43, 2025 in the app
3. Click "Berlín" → Enter password "berlin"
4. Your new photos should appear! 🎉

## 🎨 Caption Ideas

Here are some caption suggestions:

### Romantic

- "Cada momento contigo es eterno 💖"
- "Mi lugar favorito es junto a ti ✨"
- "Contigo, hasta el silencio es hermoso 🌙"
- "Eres mi hogar, donde sea que estemos 🏠💕"

### Fun & Playful

- "Aventuras contigo = las mejores aventuras 🎢"
- "Juntos somos imparables 🚀"
- "Partner in crime favorito 🕵️‍♂️💕"
- "Risas garantizadas siempre 😄✨"

### Memories

- "Nuestro primer [evento] juntos 🎭"
- "El día que [momento especial] 📸"
- "Recordando cuando [historia] 💭"
- "Este momento quedará por siempre 🌟"

### Birthday Special

- "Un año más de amarte 🎂💖"
- "Celebrando a mi persona favorita 🎉"
- "Feliz cumpleaños al amor de mi vida 🎈"
- "Que vengan muchos años más juntos ✨"

## 🔐 Environment Variables

Added to `.env.local`:

```bash
BIRTHDAY_PHOTOS_DB_ID=28f3914189d381be9ec1f8ee3c1780c1
```

This is also hardcoded as fallback in the API route, so it works even without the env var.

## 🧪 Testing the Integration

### Test API Endpoint

```bash
# Start dev server
pnpm run dev

# Test API (in another terminal)
curl http://localhost:3001/api/birthday-photos
```

Expected response:

```json
{
  "photos": [],
  "count": 0
}
```

(Empty until you add images to the photos in Notion)

### Test in the App

1. Navigate to Week 43, 2025
2. Click golden "Berlín"
3. Enter password: `berlin`
4. Gallery opens
5. If no images in Notion → Shows placeholder images
6. If images added → Shows your photos from Notion!

## 📋 Notion Database Checklist

Before the birthday (October 23):

- [ ] Add at least 3-5 real photos
- [ ] Write personal captions for each
- [ ] Set Order numbers (1, 2, 3...)
- [ ] Check Active checkbox for all photos
- [ ] Test in the app to verify they load
- [ ] Adjust captions if needed
- [ ] Final check on October 22

## 🎯 Image Guidelines

### Recommended Image Specs

- **Format**: JPG, PNG, WebP
- **Size**: Up to 5MB per image (Notion limit)
- **Resolution**: 1920x1080 or higher recommended
- **Aspect Ratio**: Any (gallery auto-resizes)
- **Orientation**: Portrait or landscape both work

### Upload Tips

1. **Use high-quality photos** - They look better in the gallery
2. **Mix orientations** - Variety keeps it interesting
3. **Tell a story** - Order photos chronologically or thematically
4. **Personal moments** - Choose photos with special meaning
5. **Balance** - Mix close-ups, landscapes, and group photos

## 🚨 Troubleshooting

### Photos not loading?

- Check that Active checkbox is checked ✅
- Verify images are uploaded to Notion
- Check browser console for errors
- Ensure NOTION_API_KEY is valid

### Wrong order?

- Check Order numbers in Notion
- Lower numbers appear first (1, 2, 3...)

### Photos disappear?

- Check Active checkbox status
- Verify you're looking at the right database

### API errors?

- Check .env.local has correct database ID
- Restart dev server after env changes
- Verify Notion API key has access to database

## 🎉 Ready to Use!

Everything is set up and ready. Just add your photos to the Notion database and they'll automatically appear in the birthday gallery!

**Notion Database**: https://www.notion.so/28f3914189d381be9ec1f8ee3c1780c1

---

Made with 💖 for Landa's birthday
