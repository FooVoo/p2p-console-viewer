import  { type Subscriber, type Unsubscriber, type Updater, writable, type Writable } from 'svelte/store';

/**
 * Message type for P2P console messages
 * Supports both structured console messages and plain text
 */
export interface P2PMessage {
	id: string;
	timestamp: number;
	direction: 'inbound' | 'outbound';
	type: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'text';
	content: string;
	payload?: any[];
	namespace?: string | null;
}

export const messages = writable<P2PMessage[]>([]);
