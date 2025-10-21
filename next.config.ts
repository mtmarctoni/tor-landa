import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NOTION_API_KEY: process.env.NOTION_API_KEY,
    NOTION_DB_ID: process.env.NOTION_DB_ID,
    BIRTHDAY_PHOTOS_DB_ID: process.env.BIRTHDAY_PHOTOS_DB_ID,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "prod-files-secure.s3.us-west-2.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
