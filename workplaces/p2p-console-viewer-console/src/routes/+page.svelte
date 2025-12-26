<script lang="ts">
	import { messages } from '$lib/stores/messages.store.ts';
	import { P2PSignalingClient } from 'p2p-console-viewer-lib';
	import { get } from "svelte/store";

	const client = new P2PSignalingClient('http://localhost:3000');

	const connect = () => {
		console.log('connecting...');
		client.connect();
		client.whenConnected(() => {
			console.log('Connected to signaling server');
		});
		client.onMessage((message: string) => {
			messages.update(() => {
				return [
					...get(messages),
					{
						timestamp: new Date().getTime(),
						content: message as string,
						direction: 'inbound'
					}
				];
			});
		});
	};
</script>

<main>
	<h1>P2P Console Viewer</h1>
	<button on:click={connect}>Connect</button>
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
