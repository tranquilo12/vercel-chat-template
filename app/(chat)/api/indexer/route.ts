// app/api/indexer/route.ts
import {NextResponse} from 'next/server'

import {auth} from '@/app/(auth)/auth'


export async function GET(request: Request) {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    }

    const {searchParams} = new URL(request.url)
    const path = searchParams.get('path')
    const repo = searchParams.get('repo')

    // Base URL for the Python backend
    const PYTHON_SERVER = 'http://localhost:7779'

    // Handle SSE connections
    if (path === 'sse') {
        try {
            const response = await fetch(`${PYTHON_SERVER}/api/indexer/sse?repo=${repo}`)
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

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

    // Handle repository listing
    if (path === 'repos') {
        try {
            const response = await fetch(`${PYTHON_SERVER}/api/indexer/repos`)
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

            const data = await response.json()
            return NextResponse.json(data)
        } catch (error) {
            console.error('Error fetching repositories:', error)
            return NextResponse.json({error: 'Failed to fetch repositories'}, {status: 500})
        }
    }

    // Handle comparison endpoint
    if (path === 'comparison') {
        try {
            const response = await fetch(`${PYTHON_SERVER}/api/indexer/comparison`)
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

            const data = await response.json()
            return NextResponse.json(data)
        } catch (error) {
            console.error('Error fetching comparison data:', error)
            return NextResponse.json({error: 'Failed to fetch comparison data'}, {status: 500})
        }
    }

    return NextResponse.json({error: 'Invalid path'}, {status: 400})
}

export async function POST(request: Request) {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    }

    const {searchParams} = new URL(request.url)
    const repo = searchParams.get('repo')

    if (!repo) {
        return NextResponse.json({error: 'Repository not specified'}, {status: 400})
    }

    try {
        const response = await fetch(`http://localhost:7779/api/indexer/index/${repo}`, {
            method: 'POST'
        })

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Error starting indexing:', error)
        return NextResponse.json({error: 'Failed to start indexing'}, {status: 500})
    }
}
