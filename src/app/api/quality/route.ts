
import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import type { NotionResponse, NotionText, NotionTitleProperty } from '@/types/notion';
import type { QualityEntry } from '@/types';

const notion = new Client({ auth: process.env.NOTION_API_KEY! });
const databaseId = process.env.NOTION_DB_ID!;

export async function GET() {
    try {
        const response: NotionResponse = await notion.databases.query({
            database_id: databaseId,
            sorts: [
                { property: 'Year', direction: 'descending' },
                { property: 'Week', direction: 'descending' },
            ],
            page_size: 100,
        }) as NotionResponse;
        const qualities: QualityEntry[] = response.results.map(page => {
            const week = page.properties['Week'] && page.properties['Week'].type === 'number' ? page.properties['Week'].number : null;
            const year = page.properties['Year'] && page.properties['Year'].type === 'number' ? page.properties['Year'].number : null;
            const messageProp = page.properties['Message'] as NotionTitleProperty;
            let message: string = '';
            if (messageProp && messageProp.type === 'title' && messageProp.title.length > 0) {
                message = messageProp.title.map((t: NotionText) => t.plain_text).join('');
            }
            return {
                week,
                year,
                message,
            };
        }) as QualityEntry[];
        return NextResponse.json({ qualities });
    } catch (error) {
        return NextResponse.json({ error: `Failed to fetch quality messages: ${error}` }, { status: 500 });
    }
}
