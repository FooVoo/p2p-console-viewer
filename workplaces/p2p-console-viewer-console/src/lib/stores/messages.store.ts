import  { type Subscriber, type Unsubscriber, type Updater, writable, type Writable } from 'svelte/store';

export interface P2PMessage {
	timestamp: number;
	direction: 'inbound' | 'outbound';
	content: string;
}

export const messages = writable<P2PMessage[]>();
