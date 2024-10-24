import { useEffect, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface IndexingStatus {
    status: 'not_started' | 'in_progress' | 'completed' | 'failed'
    message: string
    last_updated: number
    files_to_index: string[]
    current_file: string
    processed_files: string[]
    total_files: number
    processed_count: number
}

export function IndexerClient() {
    const [repositories, setRepositories] = useState<string[]>([])
    const [selectedRepo, setSelectedRepo] = useState<string>('')
    const [indexingStatus, setIndexingStatus] = useState<IndexingStatus | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchRepositories()
    }, [])

    useEffect(() => {
        if (selectedRepo) {
            const eventSource = new EventSource('/api/indexer/sse')

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data)
                if (data.repository === selectedRepo) {
                    setIndexingStatus(data)
                }
            }

            eventSource.onerror = (error) => {
                console.error('EventSource failed:', error)
                eventSource.close()
            }

            return () => {
                eventSource.close()
            }
        }
    }, [selectedRepo])

    const fetchRepositories = async () => {
        try {
            const response = await fetch('/api/indexer/repos')
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()
            setRepositories(data.repositories || [])
        } catch (error) {
            console.error('Error fetching repositories:', error)
            setError('Failed to fetch repositories')
            setRepositories([])
        }
    }

    const startIndexing = async () => {
        if (!selectedRepo) return

        try {
            const response = await fetch(`/api/indexer/index/${selectedRepo}`, { method: 'POST' })
            if (!response.ok) throw new Error('Failed to start indexing')
            setIndexingStatus({
                status: 'in_progress',
                message: 'Indexing started',
                last_updated: Date.now(),
                files_to_index: [],
                current_file: '',
                processed_files: [],
                total_files: 0,
                processed_count: 0
            })
        } catch (error) {
            console.error('Error starting indexing:', error)
            setError('Failed to start indexing')
        }
    }

    const progress = indexingStatus
        ? (indexingStatus.processed_count / indexingStatus.total_files) * 100
        : 0

    return (
        <div className="flex flex-col space-y-4 w-full">
            <div className="flex items-center space-x-2">
                <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                    <SelectTrigger className="flex-grow">
                        <SelectValue placeholder="Select a repository" />
                    </SelectTrigger>
                    <SelectContent>
                        {repositories.map((repo) => (
                            <SelectItem key={repo} value={repo}>
                                {repo}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button onClick={startIndexing} disabled={!selectedRepo || indexingStatus?.status === 'in_progress'}>
                    Start Indexing
                </Button>
            </div>

            {indexingStatus && indexingStatus.status === 'in_progress' && (
                <div className="space-y-2">
                    <Progress value={progress} className="w-full" />
                    <p className="text-sm text-gray-500">
                        {indexingStatus.processed_count} / {indexingStatus.total_files} files processed
                    </p>
                    <p className="text-sm text-gray-500">Current file: {indexingStatus.current_file}</p>
                </div>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    )
}
