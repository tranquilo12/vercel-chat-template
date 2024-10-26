"use client"
import {AlertCircle, CheckCircle, GitCompareArrows, XCircle} from 'lucide-react'
import {useEffect, useState} from 'react'

import {Badge} from "@/components/ui/badge"
import {Button} from "@/components/ui/button"
import {DropdownMenu, DropdownMenuContent, DropdownMenuTrigger} from "@/components/ui/dropdown-menu"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"

// Import REPO_CONFIGS definition
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

interface RepoComparison {
    name: string
    in_container: boolean
    in_qdrant: boolean
    indexing_status: string
    last_indexed?: number
    indexed_files?: number
    total_files?: number
}

export function IndexingComparison() {
    const [comparison, setComparison] = useState<RepoComparison[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchComparison = async () => {
            try {
                // Fetch status for each repository
                const statuses = await Promise.all(
                    Object.keys(REPO_CONFIGS).map(async (repoName) => {
                        const response = await fetch(`http://localhost:7779/indexer/status/${repoName}`)
                        if (!response.ok) {
                            throw new Error(`Failed to fetch status for ${repoName}`)
                        }
                        const status = await response.json()
                        return {
                            name: repoName,
                            ...status
                        }
                    })
                )

                // Transform into comparison format
                const comparisonData = statuses.map(status => ({
                    name: status.name,
                    in_container: true, // Since it's in REPO_CONFIGS
                    in_qdrant: status.status !== 'not_started',
                    indexing_status: status.status,
                    indexed_files: status.processed_count,
                    total_files: status.total_files,
                    last_indexed: status.last_updated
                }))

                setComparison(comparisonData)
            } catch (error) {
                console.error('Error fetching comparison:', error)
                setError('Failed to fetch comparison data')
            }
        }

        fetchComparison()
        const interval = setInterval(fetchComparison, 30000) // Update every 30 seconds

        return () => clearInterval(interval)
    }, [])

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="size-4 text-green-500"/>
            case 'in_progress':
                return <AlertCircle className="size-4 text-yellow-500"/>
            case 'failed':
                return <XCircle className="size-4 text-red-500"/>
            default:
                return <CheckCircle className="size-4 text-gray-500"/>
        }
    }

    if (error) {
        return <div className="text-red-500">{error}</div>
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <GitCompareArrows className="size-4"/>
                    <span className="sr-only">Compare Repositories</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[600px]">
                <div className="p-4">
                    <h3 className="font-semibold text-sm mb-2">Repository Comparison</h3>
                    <div className="max-h-[400px] overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[120px]">Repository</TableHead>
                                    <TableHead className="w-[100px]">Container</TableHead>
                                    <TableHead className="w-[100px]">Qdrant</TableHead>
                                    <TableHead className="w-[120px]">Status</TableHead>
                                    <TableHead className="w-[120px]">Progress</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {comparison.map((repo) => (
                                    <TableRow key={repo.name}>
                                        <TableCell className="font-medium">{repo.name}</TableCell>
                                        <TableCell>{repo.in_container ?
                                            <CheckCircle className="size-4 text-green-500"/> :
                                            <XCircle className="size-4 text-red-500"/>}
                                        </TableCell>
                                        <TableCell>{repo.in_qdrant ?
                                            <CheckCircle className="size-4 text-green-500"/> :
                                            <XCircle className="size-4 text-red-500"/>}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(repo.indexing_status)}
                                                <span className="capitalize">{repo.indexing_status}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {repo.indexed_files !== undefined && repo.total_files !== undefined ? (
                                                <Badge variant="outline">
                                                    {repo.indexed_files} / {repo.total_files} files
                                                </Badge>
                                            ) : (
                                                'N/A'
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
