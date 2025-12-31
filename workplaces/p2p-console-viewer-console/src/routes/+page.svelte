<script lang="ts">
	import { messages } from '$lib/stores/messages.store.ts';
	import { P2PSignalingClient, RestClient } from 'p2p-console-viewer-lib';

	const restClient = new RestClient('http://localhost:3000/api');

	const client = new P2PSignalingClient('http://localhost:3000');

	const remotePeers = [];

	const connect = () => {
		console.log('connecting...');
		client.connect();
		client.whenConnected(() => {
			console.log('Connected to signaling server');
		});
	};

	const getRemotePeers = async () => {
		const peers = await restClient.get<string[]>('/peers');
		remotePeers.push(...peers);
	};
</script>

<main>
	<h1>P2P Console Viewer</h1>
	<div>
		{#if client.assignedId}
			<span>Assigned ID: {client.assignedId}</span>
			<button on:click={getRemotePeers}>Remote Peers</button>
		{:else}
			<button on:click={connect}>Connect</button>
		{/if}
	</div>
	<section>
		{#each $messages as message (message.timestamp)}
			<div class="message {message.direction}">
				<div>{message.timestamp}</div>
				<div>{message.content}</div>
			</div>
		{/each}
	</section>
</main>

<style>
	.message {
		margin: 10px;
		padding: 10px;
		border-radius: 5px;
	}

	.inbound {
		background-color: #f0f0f0;
	}

	.outbound {
		background-color: #d0f0ff;
	}
</style>
