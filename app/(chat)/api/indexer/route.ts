import {NextResponse} from 'next/server'

export async function GET(request: Request) {
    const {searchParams} = new URL(request.url)
    const path = searchParams.get('path')

    if (path === 'repos') {
        try {
            const response = await fetch('http://localhost:7779/repos-in-container')
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()
            return NextResponse.json(data)
        } catch (error) {
            console.error('Error fetching repositories:', error)
            return NextResponse.json({error: 'Failed to fetch repositories'}, {status: 500})
        }
    }

    if (path === 'sse') {
        try {
            const response = await fetch('http://localhost:7779/sse')
            return new NextResponse(response.body, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            })
        } catch (error) {
            console.error('Error setting up SSE connection:', error)
            return NextResponse.json({error: 'Failed to set up SSE connection'}, {status: 500})
        }
    }

    return NextResponse.json({error: 'Invalid path'}, {status: 400})
}

export async function POST(request: Request) {
    const {searchParams} = new URL(request.url)
    const repo = searchParams.get('repo')

    if (repo) {
        try {
            const response = await fetch(`http://localhost:7779/index/${repo}`, {method: 'POST'})
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()
            return NextResponse.json(data)
        } catch (error) {
            console.error('Error starting indexing:', error)
            return NextResponse.json({error: 'Failed to start indexing'}, {status: 500})
        }
    }

    return NextResponse.json({error: 'Repository not specified'}, {status: 400})
}
