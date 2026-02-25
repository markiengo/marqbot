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
        { source: "/api/courses", destination: "http://localhost:5000/courses" },
        { source: "/api/programs", destination: "http://localhost:5000/programs" },
        { source: "/api/recommend", destination: "http://localhost:5000/recommend" },
        { source: "/api/can-take", destination: "http://localhost:5000/can-take" },
        { source: "/api/health", destination: "http://localhost:5000/health" },
      ];
    },
  }),
};

module.exports = nextConfig;
