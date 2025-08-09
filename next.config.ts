import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NOTION_API_KEY: process.env.NOTION_API_KEY,
    NOTION_DB_ID: process.env.NOTION_DB_ID,
  },
  /* config options here */
};

export default nextConfig;
