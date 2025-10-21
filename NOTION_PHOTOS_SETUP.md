# 🎁 Notion Birthday Photos Integration - Complete Guide

## ✅ Setup Complete!

The Notion database for birthday photos has been successfully created and integrated with the application.

## 📊 Database Information

- **Database Name**: Landa Birthday Gallery
- **Database ID**: `28f3914189d381be9ec1f8ee3c1780c1`
- **Parent Page**: Tor Landa - Birthday Photos
- **Notion URL**: https://www.notion.so/28f3914189d381be9ec1f8ee3c1780c1

## 🗂️ Database Schema

The database has the following properties:

| Property    | Type          | Description                    |
| ----------- | ------------- | ------------------------------ |
| **Name**    | Title         | Photo name/identifier          |
| **Image**   | Files & Media | The photo file(s)              |
| **Caption** | Rich Text     | Personal caption for the photo |
| **Order**   | Number        | Display order (1, 2, 3, etc.)  |
| **Active**  | Checkbox      | Show/hide photo in gallery     |

## 📝 Current Entries

Three placeholder entries have been created:

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

## 🔌 API Integration

### Endpoint

```
GET /api/birthday-photos
```

### Response Format

```json
{
  "photos": [
    {
      "url": "https://notion-hosted-url...",
      "caption": "Cada momento contigo es un regalo ✨"
    }
  ],
  "count": 3
}
```

### Features

- ✅ Fetches only active photos (Active checkbox = true)
- ✅ Sorts by Order property (ascending)
- ✅ Supports both external and Notion-hosted images
- ✅ Falls back to placeholder images if no photos found
- ✅ Handles errors gracefully

## 📸 How to Add Real Photos

### Step 1: Open the Notion Database

Visit: https://www.notion.so/28f3914189d381be9ec1f8ee3c1780c1

### Step 2: Add a New Entry

1. Click **"+ New"** button in the database
2. Set the **Name** (e.g., "Nuestro viaje a Barcelona")
3. Click on **Image** property and upload your photo
4. Add a heartfelt **Caption** (e.g., "El día que me robaste el corazón 💕")
5. Set **Order** number (e.g., 4 for the fourth photo)
6. Check **Active** to make it visible

### Step 3: Edit Existing Entries

1. Click on any existing entry to open it
2. Click on the Image property
3. Upload your actual photo (replaces placeholder)
4. Update caption if desired
5. Save changes

### Step 4: Test the Integration

```bash
curl http://localhost:3000/api/birthday-photos
```

Photos will appear in the gallery instantly! ✨

## 🎨 Caption Ideas

Here are some romantic caption suggestions:

- "El primer día que nos conocimos 💫"
- "Nuestro viaje a [lugar] 🌍"
- "El momento en que supe que eras especial ✨"
- "Risas, aventuras y amor infinito 💕"
- "Contigo, cada día es una celebración 🎉"
- "Mi persona favorita en todo el mundo 💖"
- "Creando recuerdos que durarán para siempre 📸"
- "Gracias por llenar mi vida de color 🌈"
- "El amor de mi vida 💝"
- "Juntos somos imparables 🚀"

## 🔧 Advanced Configuration

### Changing Order

- Simply update the **Order** number
- Photos will automatically sort in the gallery
- Lower numbers appear first (1, 2, 3...)

### Hiding Photos Temporarily

- Uncheck the **Active** checkbox
- Photo will be hidden from gallery
- Can be re-enabled anytime

### Replacing Photos

1. Click on the image thumbnail
2. Click **"Replace"**
3. Upload new photo
4. Old photo is replaced

### Multiple Photos per Entry

- The database supports multiple files
- Currently, only the first photo is used
- Future enhancement: support for multiple photos

## 🌟 Best Practices

### Photo Guidelines

- ✅ Use high-quality images (at least 1920x1080)
- ✅ JPEG or PNG format
- ✅ Keep file size under 5MB for faster loading
- ✅ Landscape orientation works best

### Caption Guidelines

- ✅ Keep it personal and heartfelt
- ✅ 1-2 sentences is ideal
- ✅ Use emojis to add personality 💖
- ✅ Mention the occasion/memory if relevant

### Organization Tips

- Order photos chronologically or by theme
- Use meaningful names for easy reference
- Deactivate old photos instead of deleting
- Back up special photos elsewhere too

## 🚀 Implementation Details

### Files Created

1. **`/src/app/api/birthday-photos/route.ts`**
   - API endpoint for fetching photos
   - Processes Notion database responses
   - Handles errors and fallbacks

### Files Modified

1. **`/src/components/BirthdayGalleryModal.tsx`**

   - Fetches photos from API on modal open
   - Shows loading state while fetching
   - Falls back to placeholders on error
   - Displays photos with captions

2. **`/next.config.ts`**

   - Added `BIRTHDAY_PHOTOS_DB_ID` to env config

3. **`/.env.local`**
   - Added birthday photos database ID

## 🧪 Testing Checklist

### API Testing

- [x] Endpoint returns valid JSON
- [x] Photos are sorted by Order
- [x] Only active photos are returned
- [x] Captions are extracted correctly
- [x] Image URLs are valid
- [x] Error handling works

### Frontend Testing

- [ ] Navigate to Week 43, 2025
- [ ] Click golden "Berlín" word
- [ ] Enter password: "berlin"
- [ ] Gallery opens with photos
- [ ] Photos load correctly
- [ ] Captions display properly
- [ ] Navigation arrows work
- [ ] Loading state appears briefly
- [ ] Can close and reopen

## 🎯 Next Steps

### Immediate Actions

1. ✅ Database created
2. ✅ API endpoint working
3. ✅ Frontend integration complete
4. 🔄 **Add your actual photos** to the Notion database
5. 🔄 Test the full flow
6. 🔄 Add more photos as desired

### Future Enhancements

- [ ] Support for video messages
- [ ] Support for multiple photos per entry
- [ ] Add date/location metadata
- [ ] Create photo upload form in the app
- [ ] Add photo download feature
- [ ] Create shareable photo album link

## 📖 Environment Variables

Required in `.env.local`:

```bash
NOTION_API_KEY=your_notion_api_key
NOTION_DB_ID=your_main_database_id
BIRTHDAY_PHOTOS_DB_ID=28f3914189d381be9ec1f8ee3c1780c1
```

## 🔐 Security Notes

- ✅ Photos are hosted by Notion with signed URLs
- ✅ URLs expire after 1 hour (automatically refreshed)
- ✅ Only active photos are accessible
- ✅ API checks for valid Notion connection
- ✅ Error messages don't expose sensitive data

## 📞 Support

### Common Issues

**Q: Photos not loading?**

- Check that images are uploaded in Notion
- Verify Active checkbox is checked
- Ensure Order numbers are set
- Test API endpoint directly

**Q: Wrong order?**

- Update Order property in Notion
- Lower numbers appear first
- Refresh the page

**Q: Caption not showing?**

- Check Caption property has text
- Ensure it's not just emojis
- Try re-saving the entry

**Q: Gallery is empty?**

- Check if any photos have Active=true
- Verify database ID in .env.local
- Test API endpoint response

## 🎉 Success!

Your birthday photo gallery is now powered by Notion!

**Notion Database**: https://www.notion.so/28f3914189d381be9ec1f8ee3c1780c1

Simply add your photos there, and they'll appear in the secret gallery automatically! 💖✨
