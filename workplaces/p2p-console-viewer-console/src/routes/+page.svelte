<script lang="ts">
	import { messages, type P2PMessage } from '$lib/stores/messages.store';
	import { parseP2PMessage, serializeP2PMessage } from '$lib/utils/p2p-client';
	import { P2PSignalingClient } from 'p2p-console-viewer-lib';
	import { get } from 'svelte/store';

	const client = new P2PSignalingClient('http://localhost:3000');
	let inputMessage = '';
	let isConnected = false;

	const connect = () => {
		console.log('connecting...');
		client.connect();
		client.whenConnected(() => {
			console.log('Connected to signaling server');
			isConnected = true;
		});
		client.onMessage((message: string) => {
			const parsedMessage = parseP2PMessage(message, 'inbound');
			messages.update((msgs) => [...msgs, parsedMessage]);
		});
	};

	const sendMessage = () => {
		if (!inputMessage.trim() || !isConnected) return;

		// Create outbound message
		const outboundMsg: P2PMessage = {
			id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
			timestamp: Date.now(),
			direction: 'outbound',
			type: 'text',
			content: inputMessage,
			payload: undefined,
			namespace: null
		};

		// Add to messages store
		messages.update((msgs) => [...msgs, outboundMsg]);

		// NOTE: Actual P2P transmission requires P2PConnection integration
		// This would be: connection.send(serializeP2PMessage(outboundMsg))
		// For now, this demonstrates the message structure and UI
		console.log('Message prepared for sending:', inputMessage);
		console.warn('P2PConnection.send() integration pending - message stored locally only');

		inputMessage = '';
	};

	const formatTimestamp = (timestamp: number): string => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString();
	};
</script>

<main>
	<h1>P2P Console Viewer</h1>
	<div class="controls">
		<button on:click={connect} disabled={isConnected}>
			{isConnected ? 'Connected' : 'Connect'}
		</button>
	</div>
	
	<div class="message-input">
		<input
			type="text"
			bind:value={inputMessage}
			on:keypress={(e) => e.key === 'Enter' && sendMessage()}
			placeholder="Type a message..."
			disabled={!isConnected}
		/>
		<button on:click={sendMessage} disabled={!isConnected}>Send</button>
	</div>

	<section class="messages">
		{#each $messages as message (message.id)}
			<div class="message {message.direction} {message.type}">
				<div class="message-header">
					<span class="timestamp">{formatTimestamp(message.timestamp)}</span>
					<span class="type">{message.type}</span>
					<span class="direction">{message.direction}</span>
					{#if message.namespace}
						<span class="namespace">[{message.namespace}]</span>
					{/if}
				</div>
				<div class="message-content">{message.content}</div>
				{#if message.payload && message.payload.length > 0}
					<div class="message-payload">
						<details>
							<summary>Payload ({message.payload.length} items)</summary>
							<pre>{JSON.stringify(message.payload, null, 2)}</pre>
						</details>
					</div>
				{/if}
			</div>
		{/each}
	</section>
</main>

<style>
	main {
		padding: 20px;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
	}

	.controls {
		margin-bottom: 20px;
	}

	button {
		padding: 8px 16px;
		font-size: 14px;
		cursor: pointer;
		border: 1px solid #ccc;
		background: white;
		border-radius: 4px;
	}

	button:hover:not(:disabled) {
		background: #f0f0f0;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.message-input {
		display: flex;
		gap: 10px;
		margin-bottom: 20px;
	}

	.message-input input {
		flex: 1;
		padding: 8px 12px;
		font-size: 14px;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	.messages {
		max-height: 600px;
		overflow-y: auto;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 10px;
	}

	.message {
		margin: 10px 0;
		padding: 12px;
		border-radius: 6px;
		border-left: 4px solid;
	}

	.message-header {
		font-size: 12px;
		margin-bottom: 8px;
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.timestamp {
		color: #666;
	}

	.type {
		font-weight: bold;
		text-transform: uppercase;
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 10px;
	}

	.direction {
		color: #999;
		font-style: italic;
	}

	.namespace {
		color: #007acc;
		font-weight: 500;
	}

	.message-content {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 14px;
		line-height: 1.5;
	}

	.message-payload {
		margin-top: 8px;
		font-size: 12px;
	}

	.message-payload pre {
		margin: 4px 0 0 0;
		padding: 8px;
		background: rgba(0, 0, 0, 0.05);
		border-radius: 4px;
		overflow-x: auto;
		font-size: 11px;
	}

	/* Direction-based styling */
	.inbound {
		background-color: #f0f7ff;
		border-left-color: #0066cc;
	}

	.outbound {
		background-color: #f0fff4;
		border-left-color: #00aa44;
	}

	/* Type-based styling */
	.log .type {
		background-color: #e0e0e0;
		color: #333;
	}

	.info .type {
		background-color: #d0e7ff;
		color: #0066cc;
	}

	.warn .type {
		background-color: #fff3cd;
		color: #856404;
	}

	.error .type {
		background-color: #f8d7da;
		color: #721c24;
	}

	.debug .type {
		background-color: #e7d5ff;
		color: #6b21a8;
	}

	.text .type {
		background-color: #e0e0e0;
		color: #555;
	}

	/* Enhanced error styling */
	.error {
		background-color: #fff5f5;
		border-left-color: #dc3545;
	}

	.error .message-content {
		color: #721c24;
	}

	/* Enhanced warning styling */
	.warn {
		background-color: #fffef0;
		border-left-color: #ffc107;
	}

	.warn .message-content {
		color: #856404;
	}
</style>
