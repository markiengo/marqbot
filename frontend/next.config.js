const path = require("path");

/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

const nextConfig = {
  // Static export is production-only; dev mode needs rewrites for the API proxy.
  ...(!isDev && { output: "export" }),
  images: { unoptimized: true },
  experimental: {
    // Turbopack's filesystem cache fails in this OneDrive-backed Windows workspace.
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Rewrites only apply during `next dev` (not static export).
  // In production, Flask serves the static files and handles /api routes itself.
  ...(isDev && {
    async rewrites() {
      return [
        { source: "/api/courses", destination: "http://localhost:5000/api/courses" },
        { source: "/api/programs", destination: "http://localhost:5000/api/programs" },
        { source: "/api/program-buckets", destination: "http://localhost:5000/api/program-buckets" },
        { source: "/api/recommend", destination: "http://localhost:5000/api/recommend" },
        { source: "/api/can-take", destination: "http://localhost:5000/api/can-take" },
        { source: "/api/validate-prereqs", destination: "http://localhost:5000/api/validate-prereqs" },
        { source: "/api/health", destination: "http://localhost:5000/api/health" },
      ];
    },
  }),
};

module.exports = nextConfig;
