<script lang="ts">
	import { messages, type P2PMessage } from '$lib/stores/messages.store';
	import { parseP2PMessage, serializeP2PMessage } from '$lib/utils/p2p-client';
	import { P2PSignalingClient, RestSignalingClient } from 'p2p-console-viewer-lib';
	import { onMount } from 'svelte';

	type Protocol = 'ws' | 'rest';

	let protocol: Protocol = 'ws';
	let serverUrl = 'ws://localhost:3000';
	let roomName = '';
	let inputMessage = '';
	let isConnected = false;
	let connectionState = 'disconnected';
	let autoReconnect = true;
	let reconnectInterval = 3000;
	let roomPeers: string[] = [];
	let stateUpdateInterval: ReturnType<typeof setInterval>;

	let wsClient: P2PSignalingClient | null = null;
	let restClient: RestSignalingClient | null = null;

	onMount(() => {
		stateUpdateInterval = setInterval(() => {
			if (protocol === 'ws' && wsClient) {
				connectionState = wsClient.getConnectionState();
				isConnected = wsClient.isConnected();
				roomPeers = wsClient.getRoomPeers();
			} else if (protocol === 'rest' && restClient) {
				isConnected = restClient.isConnected();
				connectionState = isConnected ? 'connected' : 'disconnected';
				roomPeers = restClient.getRoomPeers();
			}
		}, 1000);

		return () => {
			if (stateUpdateInterval) {
				clearInterval(stateUpdateInterval);
			}
		};
	});

	const switchProtocol = (newProtocol: Protocol) => {
		if (newProtocol === protocol) return;
		if (isConnected) {
			disconnect();
		}
		protocol = newProtocol;
		serverUrl = protocol === 'ws' ? 'ws://localhost:3000' : 'http://localhost:3000';
		wsClient = null;
		restClient = null;
	};

	const setupPeerMessageHandler = (client: P2PSignalingClient | RestSignalingClient) => {
		client.onPeerMessage((_peerId: string, message: string) => {
			const parsedMessage = parseP2PMessage(message, 'inbound');
			messages.update((msgs) => [...msgs, parsedMessage]);
		});
	};

	const connect = async () => {
		console.log(`Connecting via ${protocol.toUpperCase()}...`);

		if (protocol === 'ws') {
			wsClient = new P2PSignalingClient(serverUrl, { room: roomName || undefined });
			setupPeerMessageHandler(wsClient);
			wsClient.connect();
			wsClient.whenConnected(() => {
				console.log('Connected to signaling server via WebSocket');
				isConnected = true;
				connectionState = 'open';
				roomPeers = wsClient!.getRoomPeers();
			});
		} else {
			if (!roomName.trim()) {
				console.warn('Room name is required for REST connections');
				return;
			}
			restClient = new RestSignalingClient(serverUrl);
			setupPeerMessageHandler(restClient);
			try {
				const data = await restClient.connect({ room: roomName });
				console.log('Connected to signaling server via REST, room:', data.room);
				isConnected = true;
				connectionState = 'connected';
				roomPeers = restClient.getRoomPeers();
			} catch (e) {
				console.error('Failed to connect via REST:', e);
				connectionState = 'disconnected';
			}
		}
	};

	const disconnect = async () => {
		console.log('Disconnecting...');
		if (protocol === 'ws' && wsClient) {
			wsClient.disconnect();
		} else if (protocol === 'rest' && restClient) {
			await restClient.disconnect();
		}
		isConnected = false;
		connectionState = 'disconnected';
		roomPeers = [];
	};

	const forceReconnect = () => {
		if (protocol === 'ws' && wsClient) {
			console.log('Force reconnecting...');
			wsClient.forceReconnect();
		}
	};

	const joinRoom = () => {
		if (protocol === 'ws' && wsClient && roomName.trim()) {
			wsClient.joinRoom(roomName);
		}
	};

	const leaveRoom = () => {
		if (protocol === 'ws' && wsClient) {
			wsClient.leaveRoom();
			roomPeers = [];
		}
	};

	const toggleAutoReconnect = () => {
		autoReconnect = !autoReconnect;
		if (wsClient) {
			if (autoReconnect) {
				wsClient.enableAutoReconnect();
			} else {
				wsClient.disableAutoReconnect();
			}
		}
	};

	const updateReconnectInterval = () => {
		if (reconnectInterval > 0 && wsClient) {
			wsClient.setReconnectInterval(reconnectInterval);
		}
	};

	const sendMessage = () => {
		if (!inputMessage.trim() || !isConnected) return;

		const outboundMsg: P2PMessage = {
			id:
				typeof crypto !== 'undefined' && crypto.randomUUID
					? crypto.randomUUID()
					: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
			timestamp: Date.now(),
			direction: 'outbound',
			type: 'text',
			content: inputMessage,
			payload: undefined,
			namespace: null
		};

		messages.update((msgs) => [...msgs, outboundMsg]);

		const client = protocol === 'ws' ? wsClient : restClient;
		if (client) {
			client.sendMessage(serializeP2PMessage(outboundMsg));
		}

		inputMessage = '';
	};

	const formatTimestamp = (timestamp: number): string => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString();
	};
</script>

<main>
	<h1>P2P Console Viewer</h1>

	<div class="connection-panel">
		<div class="protocol-switcher">
			<span class="status-label">Protocol:</span>
			<button
				class="protocol-btn"
				class:active={protocol === 'ws'}
				onclick={() => switchProtocol('ws')}
				disabled={isConnected}
			>
				WebSocket
			</button>
			<button
				class="protocol-btn"
				class:active={protocol === 'rest'}
				onclick={() => switchProtocol('rest')}
				disabled={isConnected}
			>
				REST
			</button>
		</div>

		<div class="settings-grid" style="margin-bottom: 12px;">
			<div class="setting">
				<label>
					Server URL:
					<input
						type="text"
						bind:value={serverUrl}
						placeholder={protocol === 'ws' ? 'ws://localhost:3000' : 'http://localhost:3000'}
						disabled={isConnected}
					/>
				</label>
			</div>
			<div class="setting">
				<label>
					Room:
					<input
						type="text"
						bind:value={roomName}
						placeholder="Enter room name"
						disabled={isConnected}
					/>
				</label>
			</div>
		</div>

		<div class="connection-status">
			<span class="status-label">Status:</span>
			<span class="status-badge {connectionState}">{connectionState}</span>
		</div>

		<div class="controls">
			<button onclick={connect} disabled={isConnected}> Connect </button>
			<button onclick={disconnect} disabled={!isConnected}> Disconnect </button>
			{#if protocol === 'ws'}
				<button onclick={forceReconnect} disabled={!isConnected}> Force Reconnect </button>
				<button onclick={joinRoom} disabled={!isConnected || !roomName.trim()}> Join Room </button>
				<button onclick={leaveRoom} disabled={!isConnected}> Leave Room </button>
			{/if}
		</div>

		{#if roomPeers.length > 0}
			<div class="room-peers">
				<span class="status-label">Room Peers ({roomPeers.length}):</span>
				<ul>
					{#each roomPeers as peer}
						<li>{peer}</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if protocol === 'ws'}
			<div class="advanced-controls">
				<details>
					<summary>Advanced Connection Settings</summary>
					<div class="settings-grid">
						<div class="setting">
							<label>
								<input type="checkbox" checked={autoReconnect} onchange={toggleAutoReconnect} />
								Auto-reconnect
							</label>
						</div>
						<div class="setting">
							<label>
								Reconnect interval (ms):
								<input
									type="number"
									bind:value={reconnectInterval}
									onchange={updateReconnectInterval}
									min="100"
									step="100"
								/>
							</label>
						</div>
					</div>
				</details>
			</div>
		{/if}
	</div>

	<div class="message-input">
		<input
			type="text"
			bind:value={inputMessage}
			onkeypress={(e) => e.key === 'Enter' && sendMessage()}
			placeholder="Type a message..."
			disabled={!isConnected}
		/>
		<button onclick={sendMessage} disabled={!isConnected}>Send</button>
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
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
	}

	.connection-panel {
		background: #f8f9fa;
		border: 1px solid #dee2e6;
		border-radius: 8px;
		padding: 16px;
		margin-bottom: 20px;
	}

	.protocol-switcher {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
	}

	.protocol-btn {
		padding: 6px 16px;
		font-size: 13px;
		font-weight: 600;
		border: 2px solid #dee2e6;
		border-radius: 6px;
		background: white;
		color: #495057;
		cursor: pointer;
		transition: all 0.2s;
	}

	.protocol-btn.active {
		background: #0066cc;
		color: white;
		border-color: #0066cc;
	}

	.protocol-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.connection-status {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
	}

	.status-label {
		font-weight: 600;
		color: #495057;
	}

	.status-badge {
		padding: 4px 12px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
	}

	.status-badge.disconnected {
		background: #e9ecef;
		color: #6c757d;
	}

	.status-badge.connecting {
		background: #fff3cd;
		color: #856404;
		animation: pulse 1.5s infinite;
	}

	.status-badge.open,
	.status-badge.connected {
		background: #d1e7dd;
		color: #0f5132;
	}

	.status-badge.closing {
		background: #f8d7da;
		color: #842029;
	}

	.status-badge.closed {
		background: #e9ecef;
		color: #6c757d;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}

	.controls {
		display: flex;
		gap: 8px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}

	.room-peers {
		margin-top: 12px;
		padding: 8px;
		background: white;
		border: 1px solid #dee2e6;
		border-radius: 4px;
	}

	.room-peers ul {
		list-style: none;
		padding: 0;
		margin: 4px 0 0 0;
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.room-peers li {
		padding: 2px 8px;
		background: #e9ecef;
		border-radius: 4px;
		font-size: 12px;
		font-family: monospace;
	}

	.advanced-controls {
		margin-top: 12px;
	}

	.advanced-controls details {
		background: white;
		border: 1px solid #dee2e6;
		border-radius: 4px;
		padding: 8px;
	}

	.advanced-controls summary {
		cursor: pointer;
		font-weight: 500;
		color: #495057;
		user-select: none;
	}

	.advanced-controls summary:hover {
		color: #0066cc;
	}

	.settings-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
		margin-top: 12px;
	}

	.setting label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: #495057;
	}

	.setting input[type='checkbox'] {
		cursor: pointer;
	}

	.setting input[type='number'] {
		padding: 4px 8px;
		border: 1px solid #ced4da;
		border-radius: 4px;
		font-size: 14px;
		width: 100px;
	}

	.setting input[type='text'] {
		padding: 4px 8px;
		border: 1px solid #ced4da;
		border-radius: 4px;
		font-size: 14px;
		width: 200px;
	}

	button {
		padding: 8px 16px;
		font-size: 14px;
		cursor: pointer;
		border: 1px solid #ccc;
		background: white;
		border-radius: 4px;
		transition: all 0.2s;
	}

	button:hover:not(:disabled) {
		background: #f0f0f0;
		border-color: #999;
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
