import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Natiivsed / WASM-põhised lugemiskomponendid jäävad väliseks pakettideks (ei pakita kokku)
  serverExternalPackages: ["tesseract.js", "@napi-rs/canvas", "mammoth", "word-extractor", "xlsx", "unpdf", "@anthropic-ai/sdk"],
};

export default nextConfig;
