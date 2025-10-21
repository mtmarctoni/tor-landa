import { NextResponse } from "next/server";
import { notionService } from "@/services/notionService";
import { mockQualities } from "@/data/mockQualities";

export async function GET() {
  // Check if we have valid Notion configuration
  if (!notionService.isConfigured()) {
    // Return mock data for demonstration
    return NextResponse.json({ qualities: mockQualities });
  }

  try {
    const qualities = await notionService.getQualityMessages();
    return NextResponse.json({ qualities });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to fetch quality messages: ${error}` },
      { status: 500 }
    );
  }
}
