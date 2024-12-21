import { useState, useCallback } from 'react';

import { Fork } from '@/types/fork';

interface UseForkStateProps {
	initialFork?: Fork;
	forkChain?: Fork[];
}

export function useForkState({ initialFork, forkChain = [] }: UseForkStateProps) {
	const [activeFork, setActiveFork] = useState<Fork | undefined>(initialFork);
	const [expandedDiffs, setExpandedDiffs] = useState<Set<string>>(new Set());
	const [isSubmitting, setIsSubmitting] = useState(false);

	const toggleDiffExpansion = useCallback((diffId: string) => {
		setExpandedDiffs(prev => {
			const next = new Set(prev);
			if (next.has(diffId)) {
				next.delete(diffId);
			} else {
				next.add(diffId);
			}
			return next;
		});
	}, []);

	const handleForkSelect = useCallback((fork: Fork) => {
		setActiveFork(fork);
		// Reset expanded diffs when switching forks
		setExpandedDiffs(new Set());
	}, []);

	const isDiffExpanded = useCallback((diffId: string) => {
		return expandedDiffs.has(diffId);
	}, [expandedDiffs]);

	return {
		activeFork,
		isSubmitting,
		setIsSubmitting,
		toggleDiffExpansion,
		handleForkSelect,
		isDiffExpanded,
		forkChain
	};
} 