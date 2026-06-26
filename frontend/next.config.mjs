/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/graphql/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/graphql"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
