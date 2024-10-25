"use client"

import { useState, useEffect } from 'react'

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function IndexerClient() {
    const [repositories, setRepositories] = useState<string[]>([])
    const [selectedRepo, setSelectedRepo] = useState<string>('')
    const [indexingStatus, setIndexingStatus] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchRepositories()
    }, [])

    useEffect(() => {
        if (selectedRepo) {
            const eventSource = new EventSource(`/api/indexer/sse?repo=${selectedRepo}`)

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data)
                if (data.event === 'indexing_status') {
                    setIndexingStatus(data.data)
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
            const response = await fetch('/api/indexer?path=repos')
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
            setIndexingStatus({
                status: 'in_progress',
                message: 'Starting indexing process...',
                last_updated: Date.now(),
                files_to_index: [],
                current_file: '',
                processed_files: [],
                total_files: null,
                processed_count: 0
            })

            const response = await fetch(`/api/indexer/index/${selectedRepo}`, { method: 'POST' })
            if (!response.ok) throw new Error('Failed to start indexing')

            const result = await response.json()
            if (result.status === 'no_changes') {
                setIndexingStatus({
                    status: 'completed',
                    message: 'No changes detected. Indexing not required.',
                    last_updated: Date.now(),
                    files_to_index: [],
                    current_file: '',
                    processed_files: [],
                    total_files: 0,
                    processed_count: 0
                })
            }
        } catch (error) {
            console.error('Error starting indexing:', error)
            setError('Failed to start indexing')
            setIndexingStatus(null)
        }
    }

    const renderStatusMessage = () => {
        if (!indexingStatus) return null

        if (indexingStatus.status === 'completed' && indexingStatus.total_files === 0) {
            return <p className="text-sm text-green-500">No changes detected. Indexing not required.</p>
        }

        if (indexingStatus.status === 'in_progress') {
            return (
                <>
                    <Progress value={(indexingStatus.processed_count / (indexingStatus.total_files || 1)) * 100} className="w-full" />
                    <p className="text-sm text-gray-500">
                        {indexingStatus.processed_count} / {indexingStatus.total_files ?? 'Unknown'} files processed
                    </p>
                    {indexingStatus.current_file && (
                        <p className="text-sm text-gray-500">Current file: {indexingStatus.current_file}</p>
                    )}
                </>
            )
        }

        return null
    }

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

            {renderStatusMessage()}

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    )
}
