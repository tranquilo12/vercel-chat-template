import { Separator } from "@radix-ui/react-dropdown-menu";
import { ChevronRight, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

import { cn } from "@/lib/utils";
import { Fork } from "@/types/fork";

interface ForkChainProps {
	forkChain: Fork[];
	currentForkId: string;
	chatId: string;
	onForkSelect: (fork: Fork) => void;
}

export function ForkChain({ forkChain, currentForkId, chatId, onForkSelect }: ForkChainProps) {
	const router = useRouter();
	const [allForks, setAllForks] = useState<Fork[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		async function fetchAllForks() {
			setLoading(true);
			try {
				const res = await fetch(`/api/fork?chatId=${chatId}`);
				if (res.ok) {
					const data = await res.json();
					setAllForks(data.forks);
				}
			} catch (error) {
				console.error("Failed to fetch forks:", error);
			} finally {
				setLoading(false);
			}
		}
		fetchAllForks();
	}, [chatId]);

	const handleDeleteFork = async (forkId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		try {
			await fetch("/api/fork", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: forkId }),
			});
			setAllForks((prev) => prev.filter((f) => f.id !== forkId));
			if (currentForkId === forkId) {
				router.push(`/chat/${chatId}`);
			}
		} catch (error) {
			console.error("Error deleting fork:", error);
		}
	};

	return (
		<div className="flex flex-col h-full">
			<div className="flex-1 overflow-y-auto">
				{/* Original Chat Link */}
				<div className="px-2 py-1">
					<button
						onClick={() => router.push(`/chat/${chatId}`)}
						className={cn(
							"w-full text-left px-3 py-2 rounded-md hover:bg-accent/50 transition-colors",
							!currentForkId && "bg-accent text-accent-foreground"
						)}
					>
						<div className="flex items-center">
							<ChevronRight className="size-4 mr-2" />
							<span>Original Chat</span>
						</div>
					</button>
				</div>

				<Separator className="my-2" />

				{/* Forks Section */}
				<div className="px-2 py-1">
					<h3 className="text-sm font-medium px-3 mb-2">Forks</h3>
					{loading ? (
						<p className="text-xs text-muted-foreground px-3">Loading...</p>
					) : allForks.length > 0 ? (
						<div className="space-y-1">
							{allForks.map((fork) => (
								<button
									key={fork.id}
									onClick={() => onForkSelect(fork)}
									className={cn(
										"w-full text-left px-3 py-2 rounded-md hover:bg-accent/50 transition-colors group",
										fork.id === currentForkId && "bg-accent text-accent-foreground"
									)}
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center">
											<ChevronRight className="size-4 mr-2" />
											<div className="flex flex-col">
												<span className="text-sm">{fork.title || "Untitled Fork"}</span>
												<span className="text-xs text-muted-foreground">
													{new Date(fork.createdAt).toLocaleDateString()}
												</span>
											</div>
										</div>
										<button
											title="Delete Fork"
											onClick={(e) => handleDeleteFork(fork.id, e)}
											className={cn(
												"opacity-0 group-hover:opacity-100 transition-opacity",
												"p-1 hover:bg-destructive/10 rounded-sm"
											)}
										>
											<Trash2 className="size-4 text-destructive" />
										</button>
									</div>
								</button>
							))}
						</div>
					) : (
						<p className="text-xs text-muted-foreground px-3">No forks yet</p>
					)}
				</div>
			</div>
		</div>
	);
} 