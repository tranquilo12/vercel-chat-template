import { useRouter } from "next/navigation";

import { Fork } from "@/types/fork";



interface ForkChainProps {
	forkChain: Fork[];
	currentForkId: string;
	chatId: string;
	onForkSelect: (fork: Fork) => void;
}

interface ForkChainControlsProps {
	onForkSelect: (fork: Fork) => void;
	onToggleDiff: (diffId: string) => void;
	isDiffExpanded: (diffId: string) => boolean;
	isSubmitting: boolean;
}

export function ForkChainControls({
	onForkSelect,
	onToggleDiff,
	isDiffExpanded,
	isSubmitting
}: ForkChainControlsProps) {
	return (
		<div className="flex flex-col space-y-2">
			<button
				onClick={() => onToggleDiff('current')}
				disabled={isSubmitting}
				className="text-sm px-2 py-1 rounded hover:bg-accent disabled:opacity-50"
			>
				{isDiffExpanded('current') ? 'Hide Changes' : 'Show Changes'}
			</button>
		</div>
	);
}

export function ForkChain({ forkChain, currentForkId, chatId, onForkSelect }: ForkChainProps) {
	const router = useRouter();

	const handleForkSelect = (fork: Fork) => {
		onForkSelect(fork);
		router.push(`/chat/${chatId}/fork/${fork.id}`);
	};

	return (
		<div className="flex flex-col space-y-2 p-4 bg-muted rounded-lg">
			<h3 className="text-sm font-medium">Fork History</h3>
			<div className="flex flex-col space-y-1">
				<button
					onClick={() => router.push(`/chat/${chatId}`)}
					className={`text-left px-3 py-2 rounded-md hover:bg-accent ${!currentForkId ? 'bg-accent' : ''
						}`}
				>
					Original Chat
				</button>
				{forkChain.map((fork, index) => (
					<div key={fork.id} className="flex flex-col">
						<div className="flex items-center space-x-2">
							<div className="w-4 border-l-2 h-full" />
							<button
								onClick={() => handleForkSelect(fork)}
								className={`flex-1 text-left px-3 py-2 rounded-md hover:bg-accent ${fork.id === currentForkId ? 'bg-accent' : ''
									}`}
							>
								<span className="text-sm">{fork.title}</span>
								<span className="text-xs text-muted-foreground block">
									{new Date(fork.createdAt).toLocaleDateString()}
								</span>
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
} 