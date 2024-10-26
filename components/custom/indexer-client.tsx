"use client"

import {useEffect, useState} from 'react'

import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Progress} from "@/components/ui/progress"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"

export default function IndexerClient() {
    const [repositories, setRepositories] = useState<string[]>([])
    const [selectedRepo, setSelectedRepo] = useState<string>('')
    const [indexingStatus, setIndexingStatus] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    // Based on your Python backend's repo_configs.py
    const REPO_CONFIGS = {
        "IntoTheDeep": {
            "path": "/volumes/IntoTheDeep",
            "language": "python"
        },
        "ParationalAddOn": {
            "path": "/volumes/ParationalAddOn",
            "language": "typescript"
        }
    }

    useEffect(() => {
        fetchRepositories()
    }, [])

    useEffect(() => {
        if (selectedRepo) {
            const eventSource = new EventSource(`http://localhost:7779/indexer/sse?repo=${selectedRepo}`)

            eventSource.addEventListener('indexing_status', (event) => {
                try {
                    const data = JSON.parse(event.data)
                    setIndexingStatus({
                        status: data.status,
                        message: data.message,
                        progress: data.progress,
                        current_file: data.current_file,
                        processed_count: data.processed_count,
                        total_files: data.total_files
                    })
                } catch (error) {
                    console.error('Error parsing SSE data:', error)
                }
            })

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
            const response = await fetch('http://localhost:7779/indexer/status')
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()
            const repos = Object.keys(REPO_CONFIGS || {})
            setRepositories(repos)
        } catch (error) {
            console.error('Error fetching repositories:', error)
            setError('Failed to fetch repositories')
            setRepositories([])
        }
    }

    const startIndexing = async () => {
        if (!selectedRepo) return

        try {
            // Reset current status
            setIndexingStatus({
                status: 'in_progress',
                message: 'Starting indexing process...',
                progress: 0,
                current_file: '',
                processed_count: 0,
                total_files: 0
            })

            const response = await fetch(`http://localhost:7779/indexer/${selectedRepo}`, {
                method: 'POST'
            })

            if (!response.ok) throw new Error('Failed to start indexing')

            const result = await response.json()
            console.log('Indexing started:', result)

        } catch (error) {
            console.error('Error starting indexing:', error)
            setError('Failed to start indexing')
            setIndexingStatus(null)
        }
    }

    const getProgressPercentage = () => {
        if (!indexingStatus?.total_files) return 0
        return (indexingStatus.processed_count / indexingStatus.total_files) * 100
    }

    const renderStatusMessage = () => {
        if (!indexingStatus) return null

        if (indexingStatus.status === 'completed' && indexingStatus.total_files === 0) {
            return (
                <Alert>
                    <AlertTitle>Completed</AlertTitle>
                    <AlertDescription>No changes detected. Indexing not required.</AlertDescription>
                </Alert>
            )
        }

        if (indexingStatus.status === 'in_progress') {
            return (
                <div className="space-y-2">
                    <Progress value={getProgressPercentage()} className="w-full"/>
                    <div className="text-sm text-gray-500 space-y-1">
                        <p>Status: {indexingStatus.message}</p>
                        <p>Progress: {indexingStatus.processed_count} / {indexingStatus.total_files || '?'} files</p>
                        {indexingStatus.current_file && (
                            <p>Current file: {indexingStatus.current_file}</p>
                        )}
                    </div>
                </div>
            )
        }

        if (indexingStatus.status === 'failed') {
            return (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{indexingStatus.message}</AlertDescription>
                </Alert>
            )
        }

        if (indexingStatus.status === 'completed') {
            return (
                <Alert>
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{indexingStatus.message}</AlertDescription>
                </Alert>
            )
        }

        return null
    }

    return (
        <div className="flex flex-col space-y-4 w-full">
            <div className="flex items-center space-x-2">
                <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                    <SelectTrigger className="flex-grow">
                        <SelectValue placeholder="Select a repository"/>
                    </SelectTrigger>
                    <SelectContent>
                        {repositories.map((repo) => (
                            <SelectItem key={repo} value={repo}>
                                {repo}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    onClick={startIndexing}
                    disabled={!selectedRepo || indexingStatus?.status === 'in_progress'}
                >
                    Start Indexing
                </Button>
            </div>

            {renderStatusMessage()}

            {error && !indexingStatus && (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    )
}
