import { NextResponse } from "next/server";
import { notionService } from "@/services/notionService";

export async function GET() {
  try {
    // Check if birthday photos database is configured
    if (!notionService.isBirthdayPhotosConfigured()) {
      return NextResponse.json(
        {
          error: "Birthday photos database is not configured",
          photos: [],
          count: 0,
        },
        { status: 500 }
      );
    }

    const photos = await notionService.getBirthdayPhotos();

    return NextResponse.json({
      photos,
      count: photos.length,
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
