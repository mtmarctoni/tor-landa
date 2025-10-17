import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import type {
  NotionResponse,
  NotionText,
  NotionTitleProperty,
} from "@/types/notion";
import type { QualityEntry } from "@/types";

const notion = new Client({ auth: process.env.NOTION_API_KEY! });
const databaseId = process.env.NOTION_DB_ID!;

// Mock data for demonstration when Notion is not configured
const mockQualities: QualityEntry[] = [
  {
    week: 1,
    year: 2024,
    message:
      "El arte de comenzar cada día con la curiosidad de un niño y la sabiduría de quien ha vivido.",
  },
  {
    week: 5,
    year: 2024,
    message:
      "La paciencia no es la capacidad de esperar, sino la capacidad de mantener una buena actitud mientras se espera.",
  },
  {
    week: 12,
    year: 2024,
    message:
      "Los sueños no tienen fecha de vencimiento. Solo requieren el coraje de perseguirlos cada día.",
  },
  {
    week: 18,
    year: 2024,
    message:
      "La verdadera fortaleza no se mide por lo que puedes cargar, sino por lo que puedes dejar ir.",
  },
  {
    week: 25,
    year: 2024,
    message:
      "Cada conversación es una oportunidad de construir puentes o de crear distancias. Elige sabiamente.",
  },
  {
    week: 30,
    year: 2024,
    message:
      "La creatividad florece en los espacios donde el juicio se suspende y la curiosidad toma el control.",
  },
  {
    week: 2,
    year: 2025,
    message:
      "El año nuevo no es solo un cambio de calendario, sino una invitación a reescribir tu historia.",
  },
  {
    week: 8,
    year: 2025,
    message:
      "La gratitud transforma lo que tenemos en suficiente, y lo suficiente en abundancia.",
  },
  {
    week: 43,
    year: 2025,
    message:
      "En este día especial, celebramos no solo tu existencia, sino la luz que traes al mundo. Cada momento contigo es un regalo que transforma lo ordinario en extraordinario. ¡Feliz cumpleaños, Landa! Que este nuevo año de vida esté lleno de sueños cumplidos, sonrisas compartidas y el amor que tanto mereces. 🎂✨💖",
  },
];

export async function GET() {
  // Check if we have valid Notion configuration
  if (
    !process.env.NOTION_API_KEY ||
    !process.env.NOTION_DB_ID ||
    process.env.NOTION_API_KEY === "dummy_key" ||
    process.env.NOTION_DB_ID === "dummy_db_id"
  ) {
    // Return mock data for demonstration
    return NextResponse.json({ qualities: mockQualities });
  }

  try {
    const response: NotionResponse = (await notion.databases.query({
      database_id: databaseId,
      sorts: [
        { property: "Year", direction: "descending" },
        { property: "Week", direction: "descending" },
      ],
      page_size: 100,
    })) as NotionResponse;
    const qualities: QualityEntry[] = response.results.map((page) => {
      const week =
        page.properties["Week"] && page.properties["Week"].type === "number"
          ? page.properties["Week"].number
          : null;
      const year =
        page.properties["Year"] && page.properties["Year"].type === "number"
          ? page.properties["Year"].number
          : null;
      const messageProp = page.properties["Message"] as NotionTitleProperty;
      let message: string = "";
      if (
        messageProp &&
        messageProp.type === "title" &&
        messageProp.title.length > 0
      ) {
        message = messageProp.title
          .map((t: NotionText) => t.plain_text)
          .join("");
      }
      return {
        week,
        year,
        message,
      };
    }) as QualityEntry[];
    return NextResponse.json({ qualities });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to fetch quality messages: ${error}` },
      { status: 500 }
    );
  }
}
