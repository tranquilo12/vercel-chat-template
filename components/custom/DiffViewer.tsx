import { DiffEditor } from "@monaco-editor/react";

import { MessageDiff } from "@/types/fork";

interface DiffViewerProps {
	diff: MessageDiff;
	isExpanded: boolean;
}

export function DiffViewer({ diff, isExpanded }: DiffViewerProps) {
	if (!isExpanded) {
		return (
			<div className="text-sm text-muted-foreground">
				<span className="font-medium">Changed message:</span> {diff.id}
			</div>
		);
	}

	return (
		<div className="border rounded-lg p-4">
			<div className="mb-2 text-sm font-medium">Message Changes</div>
			<DiffEditor
				original={diff.content}
				modified={diff.newContent}
				language="markdown"
				height={200}
				options={{
					readOnly: true,
					renderSideBySide: true,
				}}
			/>
		</div>
	);
}

interface DiffViewerControlsProps {
	diff: MessageDiff;
	isExpanded: boolean;
	onToggle: () => void;
	isSubmitting?: boolean;
}

export function DiffViewerControls({
	diff,
	isExpanded,
	onToggle,
	isSubmitting
}: DiffViewerControlsProps) {
	return (
		<div className="flex items-center justify-between p-2 bg-muted">
			<span className="text-sm font-medium">
				{isExpanded ? 'Changes' : 'Message modified'}
			</span>
			<button
				onClick={onToggle}
				disabled={isSubmitting}
				className="text-xs px-2 py-1 rounded hover:bg-accent disabled:opacity-50"
			>
				{isExpanded ? 'Hide' : 'Show'}
			</button>
		</div>
	);
} 