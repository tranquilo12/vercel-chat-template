/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {},
    images: {
        remotePatterns: [],
    },
    async rewrites() {
        return [
            {
                source: '/api/indexer/repos',
                destination: 'http://localhost:7779/repos-in-container',
            },
            {
                source: '/api/indexer/sse',
                destination: 'http://localhost:7779/sse',
            },
            {
                source: '/api/indexer/index/:repo',
                destination: 'http://localhost:7779/index/:repo',
            },
        ]
    },
};

export default nextConfig;
