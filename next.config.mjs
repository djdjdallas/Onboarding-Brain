/** @type {import('next').NextConfig} */
const nextConfig = {
  // The methodology page reads content/methodology.md at runtime — make sure it
  // ships in the serverless bundle on Vercel.
  outputFileTracingIncludes: {
    "/docs/methodology": ["./content/**"],
  },
}

export default nextConfig

