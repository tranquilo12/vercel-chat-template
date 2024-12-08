import { highlight, languages } from 'prismjs';

export function highlightCode(code: string, language: string): string {
	try {
		return highlight(
			code,
			languages[language] || languages.plaintext,
			language
		);
	} catch (e) {
		console.error('Syntax highlighting failed:', e);
		return code;
	}
} 