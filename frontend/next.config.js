const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Rewrites only apply during `next dev` (not static export).
  // In production, Flask serves the static files and handles /api routes itself.
  ...(process.env.NODE_ENV !== "production" && {
    async rewrites() {
      return [
        { source: "/api/courses", destination: "http://localhost:5000/api/courses" },
        { source: "/api/programs", destination: "http://localhost:5000/api/programs" },
        { source: "/api/recommend", destination: "http://localhost:5000/api/recommend" },
        { source: "/api/can-take", destination: "http://localhost:5000/api/can-take" },
        { source: "/api/validate-prereqs", destination: "http://localhost:5000/api/validate-prereqs" },
        { source: "/api/health", destination: "http://localhost:5000/api/health" },
      ];
    },
  }),
};

module.exports = nextConfig;
