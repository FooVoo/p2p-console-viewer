import type { P2PMessage } from '$lib/stores/messages.store';

/**
 * Helper to parse incoming P2P messages
 * Supports both structured console messages and plain text
 */
export function parseP2PMessage(data: string, direction: 'inbound' | 'outbound'): P2PMessage {
	try {
		const parsed = JSON.parse(data);
		
		// Check if it's a structured console message (from P2pMessageHelper)
		if (parsed && typeof parsed === 'object' && 'level' in parsed && 'timestamp' in parsed) {
			return {
				id: parsed.id || `${Date.now()}-${Math.random()}`,
				timestamp: parsed.timestamp,
				direction,
				type: parsed.level as 'log' | 'info' | 'warn' | 'error' | 'debug',
				content: parsed.text || '',
				payload: parsed.payload,
				namespace: parsed.namespace
			};
		}
		
		// If it's JSON but not a console message, stringify it
		return {
			id: `${Date.now()}-${Math.random()}`,
			timestamp: Date.now(),
			direction,
			type: 'text',
			content: JSON.stringify(parsed),
			payload: undefined,
			namespace: null
		};
	} catch (e) {
		// Plain text message
		return {
			id: `${Date.now()}-${Math.random()}`,
			timestamp: Date.now(),
			direction,
			type: 'text',
			content: data,
			payload: undefined,
			namespace: null
		};
	}
}

/**
 * Helper to serialize outbound messages
 * Converts message objects to JSON strings for transmission
 */
export function serializeP2PMessage(message: any): string {
	if (typeof message === 'string') {
		return message;
	}
	return JSON.stringify(message);
}

export class P2pClient {
	private readonly connections = new Map<string, RTCPeerConnection>();

	addConnection(id: string, connection: RTCPeerConnection): void {
		this.connections.set(id, connection);
	}

	clear(): void {
		this.connections.clear();
	}

	isHasConnection(id: string): boolean {
		return this.connections.has(id);
	}
}
