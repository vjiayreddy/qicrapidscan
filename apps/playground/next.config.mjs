/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@qicrapidscan/core", "@qicrapidscan/react"],
  // OpenCV.js (via @techstark/opencv-js) references Node built-ins; stub them
  // out for the browser bundle. See https://github.com/TechStark/opencv-js
  serverExternalPackages: ["@techstark/opencv-js"],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
