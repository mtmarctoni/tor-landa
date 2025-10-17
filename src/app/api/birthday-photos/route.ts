import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY! });
const birthdayPhotosDbId = process.env.BIRTHDAY_PHOTOS_DB_ID!;

interface Photo {
  url: string;
  caption: string;
}

export async function GET() {
  try {
    // Query the birthday photos database
    const response = await notion.databases.query({
      database_id: birthdayPhotosDbId,
      filter: {
        property: "Active",
        checkbox: {
          equals: true,
        },
      },
      sorts: [
        {
          property: "Order",
          direction: "ascending",
        },
      ],
    });

    // Process the results
    const photos: Photo[] = response.results.map((page: any) => {
      // Extract caption
      let caption = "";
      if (page.properties.Caption && page.properties.Caption.rich_text) {
        caption = page.properties.Caption.rich_text
          .map((text: any) => text.plain_text)
          .join("");
      }

      // Extract image URL
      let url = "";
      if (
        page.properties.Image &&
        page.properties.Image.files &&
        page.properties.Image.files.length > 0
      ) {
        const file = page.properties.Image.files[0];
        // Check if it's an external file or Notion-hosted file
        if (file.type === "external") {
          url = file.external.url;
        } else if (file.type === "file") {
          url = file.file.url;
        }
      }

      return {
        url,
        caption: caption || "Un momento especial 💖",
      };
    });

    // Filter out photos without URLs
    const validPhotos = photos.filter((photo) => photo.url);

    return NextResponse.json({
      photos: validPhotos,
      count: validPhotos.length,
    });
  } catch (error) {
    console.error("Error fetching birthday photos:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch birthday photos",
        photos: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}
