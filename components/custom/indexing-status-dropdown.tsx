"use client"

import {AlertCircle, CheckCircle, Database, RefreshCw} from 'lucide-react'
import {useEffect, useState} from 'react'

import {Button} from "../ui/button"
import {DropdownMenu, DropdownMenuContent, DropdownMenuTrigger} from "../ui/dropdown-menu"
import {Progress} from "../ui/progress"

type IndexingStatus = {
    status: 'completed' | 'in_progress' | 'failed'
    message: string
    progress: number
}

type IndexingStatuses = {
    [key: string]: IndexingStatus
}

export function IndexingStatusDropdown() {
    const [statuses, setStatuses] = useState<IndexingStatuses>({})
    const [error, setError] = useState<string | null>(null)
    useEffect(() => {
        const fetchStatuses = async () => {
            try {
                const response = await fetch('/api/indexer?path=repos')
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }
                const data = await response.json()
                const initialStatuses: IndexingStatuses = {}
                data.repositories.forEach((repo: string) => {
                    initialStatuses[repo] = {
                        status: 'completed',
                        message: 'No recent indexing',
                        progress: 100
                    }
                })
                setStatuses(initialStatuses)

                // Set up SSE for each repository
                data.repositories.forEach((repo: string) => {
                    const eventSource = new EventSource(`/api/indexer?path=sse&repo=${repo}`)

                    eventSource.onmessage = (event) => {
                        const data = JSON.parse(event.data)
                        if (data.event === 'indexing_status') {
                            setStatuses(prevStatuses => ({
                                ...prevStatuses,
                                [repo]: {
                                    status: data.data.status,
                                    message: data.data.message,
                                    progress: (data.data.processed_count / (data.data.total_files || 1)) * 100
                                }
                            }))
                        }
                    }

                    eventSource.onerror = () => {
                        eventSource.close()
                    }
                })
            } catch (error) {
                console.error('Error fetching repositories:', error)
                setError('Failed to fetch repositories')
            }
        }

        fetchStatuses()
    }, [])
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="size-4 text-green-500"/>
            case 'in_progress':
                return <RefreshCw className="size-4 text-blue-500 animate-spin"/>
            case 'failed':
                return <AlertCircle className="size-4 text-red-500"/>
            default:
                return null
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Database className="size-4"/>
                    <span className="sr-only">View indexing status</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                <div className="p-2">
                    <h3 className="font-semibold text-sm mb-2">Indexing Status</h3>
                    {error ? (
                        <p className="text-sm text-red-500">{error}</p>
                    ) : Object.entries(statuses).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No repositories found.</p>
                    ) : (
                        Object.entries(statuses).map(([repo, status]) => (
                            <div key={repo} className="flex items-center justify-between py-1">
                                <div className="flex items-center">
                                    {getStatusIcon(status.status)}
                                    <span className="ml-2 text-sm">{repo}</span>
                                </div>
                                {status.status === 'in_progress' ? (
                                    <Progress value={status.progress} className="w-16"/>
                                ) : (
                                    <span className="text-xs text-muted-foreground">{status.message}</span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
