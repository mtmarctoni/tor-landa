import { Client } from "@notionhq/client";
import type {
  NotionPage,
  NotionResponse,
  NotionText,
  NotionTitleProperty,
} from "@/types/notion";
import type { QualityEntry, Photo } from "@/types";

class NotionService {
  private notion: Client;
  private qualityDbId: string;
  private birthdayPhotosDbId: string;

  constructor() {
    this.notion = new Client({ auth: process.env.NOTION_API_KEY! });
    this.qualityDbId = process.env.NOTION_DB_ID!;
    this.birthdayPhotosDbId = process.env.BIRTHDAY_PHOTOS_DB_ID!;
  }

  /**
   * Check if Notion is properly configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.NOTION_API_KEY &&
      process.env.NOTION_DB_ID &&
      process.env.NOTION_API_KEY !== "dummy_key" &&
      process.env.NOTION_DB_ID !== "dummy_db_id"
    );
  }

  /**
   * Check if birthday photos database is configured
   */
  isBirthdayPhotosConfigured(): boolean {
    return !!(
      process.env.NOTION_API_KEY &&
      process.env.BIRTHDAY_PHOTOS_DB_ID &&
      process.env.NOTION_API_KEY !== "dummy_key" &&
      process.env.BIRTHDAY_PHOTOS_DB_ID !== "dummy_db_id"
    );
  }

  /**
   * Fetch all quality messages from Notion database
   */
  async getQualityMessages(): Promise<QualityEntry[]> {
    if (!this.isConfigured()) {
      throw new Error("Notion is not properly configured");
    }

    try {
      const response: NotionResponse = (await this.notion.databases.query({
        database_id: this.qualityDbId,
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

      return qualities;
    } catch (error) {
      throw new Error(`Failed to fetch quality messages: ${error}`);
    }
  }

  /**
   * Fetch birthday photos from Notion database
   */
  async getBirthdayPhotos(): Promise<Photo[]> {
    if (!this.isBirthdayPhotosConfigured()) {
      throw new Error("Birthday photos database is not properly configured");
    }

    try {
      const response = await this.notion.databases.query({
        database_id: this.birthdayPhotosDbId,
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
      const photos: Photo[] = response.results.map((p) => {
        const page = p as NotionPage;
        // Extract caption
        let caption = "";
        const captionProp = page.properties.Caption;
        if (
          captionProp &&
          captionProp.type === "rich_text" &&
          Array.isArray(captionProp.rich_text)
        ) {
          caption = captionProp.rich_text
            .map((text) => ("plain_text" in text ? text.plain_text : ""))
            .join("");
        }

        // Extract image URL
        let url = "";
        const imageProp = page.properties.Image;
        if (
          imageProp &&
          "files" in imageProp &&
          Array.isArray(imageProp.files) &&
          imageProp.files.length > 0
        ) {
          const file = imageProp.files[0];
          if (file.type === "external") {
            url = file.external.url;
          } else if (file.type === "file") {
            url = file.file.url;
          }
        }

        const photo: Photo = {
          url,
          caption: caption || "Un momento especial 💖",
        };
        return photo;
      });

      // Filter out photos without URLs
      return photos.filter((photo) => photo.url);
    } catch (error) {
      throw new Error(`Failed to fetch birthday photos: ${error}`);
    }
  }
}

// Export a singleton instance
export const notionService = new NotionService();
